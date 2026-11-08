/**
 * One-off import of the markdown content (../src/content) and its media (../public/media) into the
 * dataset. Run from the studio folder:
 *
 *   npm run import            (refuses if projects already exist)
 *   npm run import -- --force (re-imports, overwriting documents with the same id)
 *
 * Documents get stable ids (project-<file name>), so re-running never duplicates.
 */
import {createReadStream, existsSync, readdirSync, readFileSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {getCliClient} from 'sanity/cli'
import {parse as parseYaml} from 'yaml'
import {marked, type Token, type Tokens} from 'marked'

const client = getCliClient({apiVersion: '2026-11-08'})
const root = resolve(process.cwd(), '..') // run from the studio folder
const force = process.argv.includes('--force')

let keyCounter = 0
const key = () => `k${(keyCounter++).toString(36)}${Math.random().toString(36).slice(2, 8)}`

function readMarkdown(file: string): {data: Record<string, any>; body: string} {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  return match ? {data: parseYaml(match[1]) ?? {}, body: match[2]} : {data: {}, body: text}
}

// ---------- markdown -> portable text ----------

type Span = {_type: 'span'; _key: string; text: string; marks: string[]}
type MarkDef = {_type: 'link'; _key: string; [k: string]: unknown}

function inline(tokens: Token[], marks: string[], spans: Span[], markDefs: MarkDef[], linkExtras: (href: string) => object) {
  for (const t of tokens) {
    switch (t.type) {
      case 'text': {
        const tt = t as Tokens.Text
        if (tt.tokens?.length) inline(tt.tokens, marks, spans, markDefs, linkExtras)
        else spans.push({_type: 'span', _key: key(), text: tt.text, marks})
        break
      }
      case 'escape':
        spans.push({_type: 'span', _key: key(), text: (t as Tokens.Escape).text, marks})
        break
      case 'strong':
        inline((t as Tokens.Strong).tokens, [...marks, 'strong'], spans, markDefs, linkExtras)
        break
      case 'em':
        inline((t as Tokens.Em).tokens, [...marks, 'em'], spans, markDefs, linkExtras)
        break
      case 'link': {
        const lt = t as Tokens.Link
        const def: MarkDef = {_type: 'link', _key: key(), href: lt.href, ...linkExtras(lt.href)}
        markDefs.push(def)
        inline(lt.tokens, [...marks, def._key], spans, markDefs, linkExtras)
        break
      }
      case 'br':
        spans.push({_type: 'span', _key: key(), text: '\n', marks})
        break
      default:
        spans.push({_type: 'span', _key: key(), text: (t as any).text ?? t.raw, marks})
    }
  }
}

function block(tokens: Token[], style: string, linkExtras: (href: string) => object = () => ({}), extra: object = {}) {
  const spans: Span[] = []
  const markDefs: MarkDef[] = []
  inline(tokens, [], spans, markDefs, linkExtras)
  return {_type: 'block', _key: key(), style, markDefs, children: spans.length ? spans : [{_type: 'span', _key: key(), text: '', marks: []}], ...extra}
}

function toBlocks(md: string, linkExtras?: (href: string) => object) {
  const out: object[] = []
  for (const t of marked.lexer(md)) {
    if (t.type === 'paragraph') out.push(block((t as Tokens.Paragraph).tokens, 'normal', linkExtras))
    else if (t.type === 'heading') out.push(block((t as Tokens.Heading).tokens, 'h2', linkExtras))
    else if (t.type === 'blockquote') {
      for (const p of (t as Tokens.Blockquote).tokens) if (p.type === 'paragraph') out.push(block((p as Tokens.Paragraph).tokens, 'blockquote', linkExtras))
    } else if (t.type === 'list') {
      const lt = t as Tokens.List
      for (const item of lt.items) {
        const inner = item.tokens.flatMap((x) => ((x as any).tokens ? (x as any).tokens : [x]))
        out.push(block(inner, 'normal', linkExtras, {listItem: lt.ordered ? 'number' : 'bullet', level: 1}))
      }
    } else if (t.type !== 'space') {
      console.warn(`  skipped markdown token "${t.type}"`)
    }
  }
  return out
}

// ---------- assets ----------

const uploaded = new Map<string, string>()
async function upload(src: string): Promise<{kind: 'image' | 'file'; ref: string}> {
  const file = join(root, 'public', src.replace(/^\//, ''))
  if (!existsSync(file)) throw new Error(`Missing media file ${src}`)
  const kind = /\.(mp4|webm|mov)$/i.test(src) ? 'file' : 'image'
  let ref = uploaded.get(file)
  if (!ref) {
    const asset = await client.assets.upload(kind, createReadStream(file), {filename: basename(file)})
    ref = asset._id
    uploaded.set(file, ref)
    console.log(`  uploaded ${src}`)
  }
  return {kind, ref}
}

async function mediaItem(m: {src: string; caption?: string; alt?: string}) {
  const {kind, ref} = await upload(m.src)
  const asset = {_type: 'reference', _ref: ref}
  return kind === 'file'
    ? {_type: 'video', _key: key(), asset, ...(m.caption ? {caption: m.caption} : {})}
    : {_type: 'photo', _key: key(), asset, ...(m.caption ? {caption: m.caption} : {}), ...(m.alt ? {alt: m.alt} : {})}
}

// ---------- run ----------

async function main() {
  const existing = await client.fetch<number>('count(*[_type == "project"])')
  if (existing > 0 && !force) {
    console.log(`The dataset already has ${existing} projects. Run with --force to overwrite them.`)
    return
  }

  const workDir = join(root, 'src', 'content', 'work')
  const files = readdirSync(workDir).filter((f) => f.endsWith('.md'))
  const tx = client.transaction()

  for (const f of files) {
    const slug = f.replace(/\.md$/, '')
    const {data, body} = readMarkdown(join(workDir, f))
    console.log(`project ${slug}`)
    const media = []
    for (const m of data.media ?? []) media.push(await mediaItem(m))
    const cover = data.thumb ? [await mediaItem({src: data.thumb})] : []
    const id = `project-${createHash('sha1').update(slug).digest('hex').slice(0, 10)}`
    tx.createOrReplace({
      _id: id,
      _type: 'project',
      title: data.title ?? slug,
      slug: {_type: 'slug', current: slug},
      date: data.date || undefined,
      category: data.category ?? 'projects',
      order: data.order ?? 99,
      featured: !!data.featured,
      body: toBlocks(body),
      media,
      cover,
    })
  }

  // Home intro: first paragraph is the name, the rest is the intro.
  const home = readFileSync(join(root, 'src', 'content', 'home.md'), 'utf8').replace(/\r\n/g, '\n').trim()
  const [nameLine, ...rest] = home.split(/\n\s*\n/)
  const previews: Record<string, string> = {
    'heronpreston.com': '/media/heron_preston_studio_ids/20261001_104100.jpg',
    'bstroy.us': '/media/bstroy_digital_clock/woodrenderv2.png',
  }
  const previewRefs: Record<string, string> = {}
  for (const [host, src] of Object.entries(previews)) previewRefs[host] = (await upload(src)).ref
  const linkExtras = (href: string) => {
    const host = Object.keys(previewRefs).find((h) => href.includes(h))
    return host ? {preview: {_type: 'image', asset: {_type: 'reference', _ref: previewRefs[host]}}} : {}
  }

  tx.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    name: nameLine.trim(),
    role: 'Design Engineer',
    intro: toBlocks(rest.join('\n\n'), linkExtras),
    description: 'Syed Feroze Ali is a design engineer based in DC and New York.',
    instagram: 'https://www.instagram.com/feroze_ali585',
    linkedin: 'https://www.linkedin.com/in/ferozeali1/',
  })

  await tx.commit()
  console.log(`Imported ${files.length} projects and the home settings.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
