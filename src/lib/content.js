/**
 * All site content comes from Sanity (project avk9byrq), read once at build time. The pages are
 * static, so a publish in the Studio shows up after the next build (see README for the deploy hook).
 */
import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import { toHTML, escapeHTML } from '@portabletext/to-html';

const client = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID || 'avk9byrq',
  dataset: import.meta.env.PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-11-08',
  useCdn: false,
});
const builder = imageUrlBuilder(client);

const IMAGE = `{ _type, alt, caption, crop, hotspot, "asset": asset->{ _id, url, mimeType, metadata { lqip, dimensions { width, height } } } }`;

const QUERY = `{
  "settings": *[_id == "siteSettings"][0]{
    name, role, description, instagram, linkedin,
    "intro": intro[]{ ..., markDefs[]{ ..., "logo": logo.asset->url, "preview": preview${IMAGE} } }
  },
  "projects": *[_type == "project" && defined(slug.current)] | order(order asc, title asc) {
    "slug": slug.current, title, date, summary, category, order, featured, body,
    "media": media[]${IMAGE},
    "cover": cover[0]${IMAGE}
  }
}`;

const WIDTHS = [400, 800, 1200, 1800];

/** A Sanity image or video as { type, src, srcset, w, h, blur, alt, caption }. */
function toMedia(item, fallbackAlt = '') {
  const asset = item?.asset;
  if (!asset) return null;
  if (item._type === 'video') {
    return { type: 'video', src: asset.url, alt: fallbackAlt, caption: item.caption ?? '' };
  }
  const size = asset.metadata?.dimensions ?? { width: 1600, height: 1000 };
  const crop = item.crop;
  const w = Math.round(size.width * (crop ? 1 - crop.left - crop.right : 1));
  const h = Math.round(size.height * (crop ? 1 - crop.top - crop.bottom : 1));
  // GIFs lose their animation when resized, so they are served as uploaded.
  if (asset.mimeType === 'image/gif') {
    return { type: 'image', src: asset.url, srcset: '', w, h, blur: asset.metadata?.lqip, alt: item.alt || fallbackAlt, caption: item.caption ?? '' };
  }
  const source = { asset: { _ref: asset._id }, crop: crop ?? undefined, hotspot: item.hotspot ?? undefined };
  const url = (width) => builder.image(source).width(width).auto('format').quality(82).url();
  const widths = WIDTHS.filter((x) => x < w).concat(Math.min(w, 2400));
  return {
    type: 'image',
    src: url(widths[widths.length - 1]),
    srcset: widths.map((x) => `${url(x)} ${x}w`).join(', '),
    w,
    h,
    blur: asset.metadata?.lqip,
    alt: item.alt || fallbackAlt,
    caption: item.caption ?? '',
  };
}

const attr = (s) => escapeHTML(String(s ?? ''));
const isExternal = (href) => /^https?:\/\//.test(href) && !href.includes('feroze.work');
const linkAttrs = (href) => `href="${attr(href)}"${isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}`;

const bodyComponents = {
  marks: {
    link: ({ children, value }) => `<a ${linkAttrs(value?.href)}>${children}</a>`,
  },
};

/** Intro links get an optional logo mark and a hover preview window. */
const introComponents = {
  block: { normal: ({ children }) => `<p>${children}</p>` },
  marks: {
    link: ({ children, value, text }) => {
      const href = value?.href ?? '';
      let host = '';
      try { host = new URL(href).hostname.replace(/^www\./, ''); } catch {}
      const preview = toMedia(value?.preview);
      // A logo if one was uploaded, otherwise a monogram for links that have a preview (companies).
      const mark = value?.logo
        ? `<span class="mark"><img src="${attr(value.logo)}?w=48&h=48&fit=crop" alt="" width="14" height="14" /></span>`
        : preview
          ? `<span class="mark mono" aria-hidden="true">${attr((text || host).trim().charAt(0).toUpperCase())}</span>`
          : '';
      const card = preview
        ? `<span class="preview" aria-hidden="true"><span class="preview-bar"><span class="lights"><i></i><i></i><i></i></span><span class="address">${attr(host)}</span></span><img src="${attr(builder.image({ asset: { _ref: value.preview.asset._id } }).width(512).height(320).fit('crop').auto('format').url())}" alt="" width="256" height="160" loading="lazy" decoding="async" /></span>`
        : '';
      return `<a class="co${preview ? ' has-preview' : ''}" ${linkAttrs(href)}>${mark}${children}${card}</a>`;
    },
  },
};

const data = await client.fetch(QUERY);
const s = data.settings ?? {};

export const site = {
  name: s.name || 'Syed Feroze Ali',
  shortName: 'Feroze Ali',
  role: s.role || 'Design Engineer',
  description: s.description || 'Syed Feroze Ali is a design engineer based in DC and New York.',
  introHtml: toHTML(s.intro ?? [], { components: introComponents }),
  instagram: s.instagram || 'https://www.instagram.com/feroze_ali585',
  linkedin: s.linkedin || 'https://www.linkedin.com/in/ferozeali1/',
  demo: 'https://ferozea.github.io/',
};

export const allWork = (data.projects ?? []).map((p) => ({
  slug: p.slug,
  title: p.title ?? p.slug,
  date: p.date ?? '',
  summary: p.summary ?? '',
  category: p.category ?? 'projects',
  featured: !!p.featured,
  bodyHtml: toHTML(p.body ?? [], { components: bodyComponents }),
  media: (p.media ?? []).map((m) => toMedia(m, p.title)).filter(Boolean),
  cover: toMedia(p.cover, p.title),
}));

export const featuredWork = allWork.filter((w) => w.featured);
export const workByCategory = (category) => allWork.filter((w) => w.category === category);

// Sections shown on /work. Projects tagged `experiments` still build their pages but are not listed.
export const categories = [
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
];
export const listedWork = categories.flatMap((c) => workByCategory(c.id));
