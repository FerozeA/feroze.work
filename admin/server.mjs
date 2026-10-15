// Local admin for feroze.work. Edits markdown in src/content and files in public/media.
// Run with `npm run admin`. Binds to 127.0.0.1 only.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'src', 'content');
const MEDIA = path.join(ROOT, 'public', 'media');
const TRASH = path.join(ROOT, '.trash');
const ADMIN_PUBLIC = path.join(ROOT, 'admin', 'public');
const PORT = Number(process.env.ADMIN_PORT || 4322);
const SITE_PORT = Number(process.env.SITE_PORT || 4321);
const TYPES = ['work', 'library'];
const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.mp4', '.webm', '.mov', '.pdf']);
const MAX_UPLOAD = 500 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};

const SLUG = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const fail = (status, message) => Object.assign(new Error(message), { status });
const safeSlug = (s) => { if (!SLUG.test(s || '')) throw fail(400, 'Slug may only use lowercase letters, numbers, - and _'); return s; };
const safeType = (t) => { if (!TYPES.includes(t)) throw fail(400, 'Unknown content type'); return t; };
const safeFile = (n) => {
  const name = path.basename(String(n || ''));
  const ext = path.extname(name).toLowerCase();
  if (!name || name.startsWith('.') || !MEDIA_EXT.has(ext)) throw fail(400, `Unsupported file type: ${ext || 'none'}`);
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');
};
const exists = (p) => fsp.access(p).then(() => true, () => false);

// ---------- markdown + frontmatter ----------
function parseMd(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw.trim() };
  return { data: YAML.parse(m[1]) || {}, body: m[2].trim() };
}
function stringifyMd(data, body) {
  // keep `date` even when empty (the site reads it); drop other empty values
  const clean = Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== undefined && v !== null && (v !== '' || k === 'date')));
  const yml = YAML.stringify(clean, { lineWidth: 0 }).trimEnd();
  return `---\n${yml}\n---\n\n${body.trim()}\n`;
}
const entryPath = (type, slug) => path.join(CONTENT, safeType(type), `${safeSlug(slug)}.md`);

async function moveToTrash(file, label) {
  await fsp.mkdir(TRASH, { recursive: true });
  const dest = path.join(TRASH, `${new Date().toISOString().replace(/[:.]/g, '-')}__${label}`);
  await fsp.rename(file, dest);
  return dest;
}

// ---------- API ----------
async function listEntries() {
  const out = {};
  for (const type of TYPES) {
    const dir = path.join(CONTENT, type);
    const files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.md'));
    out[type] = [];
    for (const f of files) {
      const { data } = parseMd(await fsp.readFile(path.join(dir, f), 'utf8'));
      out[type].push({ slug: f.replace(/\.md$/, ''), title: data.title || f, order: data.order ?? 99, category: data.category, draft: !!data.draft, featured: !!data.featured });
    }
    out[type].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.order - b.order);
  }
  return out;
}
async function listMedia(slug) {
  const dir = path.join(MEDIA, safeSlug(slug));
  if (!(await exists(dir))) return [];
  const names = (await fsp.readdir(dir)).filter((n) => MEDIA_EXT.has(path.extname(n).toLowerCase()));
  return Promise.all(names.map(async (name) => ({ name, src: `/media/${slug}/${name}`, size: (await fsp.stat(path.join(dir, name))).size })));
}
async function getEntry(type, slug) {
  const file = entryPath(type, slug);
  if (!(await exists(file))) throw fail(404, 'Not found');
  const { data, body } = parseMd(await fsp.readFile(file, 'utf8'));
  return { slug, data, body, files: await listMedia(slug) };
}
async function putEntry(type, slug, payload) {
  const file = entryPath(type, slug);
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  if (!String(data.title || '').trim()) throw fail(400, 'Title is required');
  if (type === 'work' && !['experiments', 'experience', 'projects'].includes(data.category)) throw fail(400, 'Choose a category');
  if (data.order !== undefined && data.order !== '') data.order = Number(data.order);
  for (const k of ['featured', 'draft']) if (!data[k]) delete data[k];
  if (type === 'work') data.media = (data.media || []).map((m) => ({ src: String(m.src), ...(m.caption ? { caption: String(m.caption) } : {}), ...(m.alt ? { alt: String(m.alt) } : {}) }));
  else delete data.media;
  await fsp.writeFile(file, stringifyMd(data, String(payload.body || '')), 'utf8');
  return getEntry(type, slug);
}
async function deleteEntry(type, slug, withMedia) {
  const file = entryPath(type, slug);
  if (!(await exists(file))) throw fail(404, 'Not found');
  await moveToTrash(file, `${type}-${slug}.md`);
  if (withMedia) {
    const dir = path.join(MEDIA, slug);
    if (await exists(dir)) await moveToTrash(dir, `media-${slug}`);
  }
  return { ok: true };
}
async function uploadMedia(slug, rawName, req) {
  const dir = path.join(MEDIA, safeSlug(slug));
  const name = safeFile(rawName);
  await fsp.mkdir(dir, { recursive: true });
  let final = name, n = 1;
  while (await exists(path.join(dir, final))) { const e = path.extname(name); final = `${path.basename(name, e)}-${++n}${e}`; }
  const dest = path.join(dir, final);
  let size = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    req.on('data', (c) => { size += c.length; if (size > MAX_UPLOAD) { req.destroy(); out.destroy(); reject(fail(413, 'File too large')); } });
    req.pipe(out);
    out.on('finish', resolve); out.on('error', reject); req.on('error', reject);
  }).catch(async (e) => { await fsp.rm(dest, { force: true }); throw e; });
  return { name: final, src: `/media/${slug}/${final}`, size };
}
async function deleteMedia(slug, name) {
  const file = path.join(MEDIA, safeSlug(slug), safeFile(name));
  if (!(await exists(file))) throw fail(404, 'Not found');
  await moveToTrash(file, `media-${slug}-${path.basename(file)}`);
  return { ok: true };
}

const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { cwd: ROOT, windowsHide: true, timeout: 120000 }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() })));
async function gitState() {
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || !inside.out.endsWith('true')) return { repo: false, changes: [] };
  const top = (await run('git', ['rev-parse', '--show-toplevel'])).out.replace(/\\/g, '/');
  if (path.resolve(top) !== ROOT) return { repo: false, changes: [] };
  const status = await run('git', ['status', '--porcelain', '--', 'src/content', 'public/media']);
  const remote = await run('git', ['remote']);
  return { repo: true, remote: remote.out.length > 0, changes: status.out ? status.out.split('\n') : [] };
}
async function publish(message) {
  const state = await gitState();
  if (!state.repo) throw fail(400, 'This folder is not a git repository yet. Run `git init` and add a remote first.');
  if (!state.changes.length) return { log: 'Nothing to publish.' };
  const log = [];
  for (const args of [['add', '--', 'src/content', 'public/media'], ['commit', '-m', String(message || 'Update content').slice(0, 200)], ...(state.remote ? [['push']] : [])]) {
    const r = await run('git', args);
    log.push(`$ git ${args[0]}\n${r.out}`);
    if (!r.ok) throw fail(500, log.join('\n'));
  }
  if (!state.remote) log.push('Committed locally. No remote is configured, so nothing was pushed.');
  return { log: log.join('\n') };
}

// ---------- http ----------
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = async (req) => { let s = ''; for await (const c of req) { s += c; if (s.length > 5e6) throw fail(413, 'Body too large'); } return s ? JSON.parse(s) : {}; };

async function serveFile(res, file, root) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(root + path.sep) || !(await exists(resolved)) || (await fsp.stat(resolved)).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(resolved).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    // Reject requests that don't originate from this page (blocks DNS rebinding and cross-site writes).
    const host = (req.headers.host || '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost') throw fail(403, 'Forbidden');
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = decodeURIComponent(url.pathname);
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (!origin || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) || req.headers['x-admin'] !== '1') throw fail(403, 'Forbidden');
    }
    const parts = p.split('/').filter(Boolean);

    if (parts[0] === 'api') {
      const [, a, b, c] = parts;
      if (a === 'config' && req.method === 'GET') return json(res, 200, { sitePort: SITE_PORT });
      if (a === 'entries' && req.method === 'GET') return json(res, 200, await listEntries());
      if (a === 'home') {
        const file = path.join(CONTENT, 'home.md');
        if (req.method === 'GET') return json(res, 200, { body: (await fsp.readFile(file, 'utf8')).trim() });
        if (req.method === 'PUT') { const { body } = await readJson(req); await fsp.writeFile(file, `${String(body).trim()}\n`, 'utf8'); return json(res, 200, { ok: true }); }
      }
      if (a === 'entry') {
        if (req.method === 'GET') return json(res, 200, await getEntry(b, c));
        if (req.method === 'PUT') return json(res, 200, await putEntry(b, c, await readJson(req)));
        if (req.method === 'DELETE') return json(res, 200, await deleteEntry(b, c, url.searchParams.get('media') === '1'));
      }
      if (a === 'media') {
        if (req.method === 'GET') return json(res, 200, await listMedia(b));
        if (req.method === 'POST') return json(res, 200, await uploadMedia(b, url.searchParams.get('name'), req));
        if (req.method === 'DELETE') return json(res, 200, await deleteMedia(b, c));
      }
      if (a === 'git' && req.method === 'GET') return json(res, 200, await gitState());
      if (a === 'publish' && req.method === 'POST') return json(res, 200, await publish((await readJson(req)).message));
      throw fail(404, 'Unknown endpoint');
    }
    if (req.method !== 'GET') throw fail(405, 'Method not allowed');
    if (parts[0] === 'media') return serveFile(res, path.join(MEDIA, ...parts.slice(1)), MEDIA);
    return serveFile(res, path.join(ADMIN_PUBLIC, p === '/' ? 'index.html' : p), ADMIN_PUBLIC);
  } catch (e) {
    json(res, e.status || 500, { error: e.status ? e.message : `Server error: ${e.message}` });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Admin:  http://127.0.0.1:${PORT}`);
  if (process.env.NO_SITE !== '1') {
    const site = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'dev', '--port', String(SITE_PORT)], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    const stop = () => { site.kill(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    console.log(`Site:   http://localhost:${SITE_PORT}`);
  }
});
