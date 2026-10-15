// Content is plain markdown in src/content. Frontmatter fields are documented in README.md.
const toEntries = (modules) =>
  Object.entries(modules).map(([path, mod]) => ({
    slug: path.split('/').pop().replace(/\.md$/, ''),
    ...mod.frontmatter,
    Content: mod.Content,
  }));

const work = toEntries(import.meta.glob('../content/work/*.md', { eager: true }));
const library = toEntries(import.meta.glob('../content/library/*.md', { eager: true }));

const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99);

export const allWork = work.sort(byOrder);
export const featuredWork = allWork.filter((w) => w.featured);
export const workByCategory = (category) => allWork.filter((w) => w.category === category);
export const allLibrary = library.sort(byOrder);

// Sections shown on /work. Projects tagged `experiments` still exist but are not listed there.
export const categories = [
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
];

export const site = {
  name: 'Feroze Ali',
  fullName: 'Syed Feroze Ali',
  instagram: 'https://www.instagram.com/feroze_ali585',
  linkedin: 'https://www.linkedin.com/in/ferozeali1/',
  demo: 'https://ferozea.github.io/',
};
