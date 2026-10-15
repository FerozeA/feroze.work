# feroze.work

Static portfolio site built with [Astro](https://astro.build). Content is plain markdown, so there is no CMS or Framer dependency.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
```

## Where things live

| Path | What |
|---|---|
| `src/content/work/*.md` | One file per project page (`/work/<file name>`) |
| `src/content/library/*.md` | One file per library post (`/library/<file name>`) |
| `src/pages/` | Home, Work index, project and post templates, 404, `/jrvrn` |
| `src/styles/global.css` | All design tokens and styles (colors, type, spacing, radii from the design system) |
| `src/components/` | `Tile` (project thumbnail) and `Crumbs` (breadcrumb) |
| `public/media/` | Put images and videos here, e.g. `public/media/pen_plotter/1.jpg` |

## Adding a project

Create `src/content/work/<slug>.md`:

```md
---
title: "Project name"
date: "12 May 2026"
category: experience   # experiments | experience | projects
order: 7               # position within its category
featured: true         # optional: also shows on the home grid
thumb: "/media/<slug>/cover.jpg"   # optional tile image (jpg, png, gif, mp4, webm)
media:                 # optional: shown under the text
  - src: "/media/<slug>/1.jpg"
    caption: "Optional caption"
---

Write the page in markdown.
```

## Adding a library post

`src/content/library/<slug>.md` with `title`, `date`, `short` (dd/mm shown on the home list), `tag`, `order`. Add `draft: true` to list it on the home page without a link. Add `footer: "topic"` to append the "why an engineer is writing about..." note.

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages). Build command `npm run build`, output directory `dist`. The build produces `/work.html` style files, so use the host's clean-URL setting (on by default on Vercel, Netlify and Cloudflare Pages).

## Notes

- Fonts load from Google Fonts. Self-host Inter later if you want zero third-party requests.
- Text was migrated from the published Framer site. Images, videos and embedded YouTube/Substack content were not copied; add them with `media`/`thumb` above.

## Admin app

```bash
npm run admin
```

Opens the admin at http://127.0.0.1:4322 and starts the site at http://localhost:4321 so you can see changes live.

- Edit the home intro, projects and library posts (title, dates, category, order, "show on home", draft, body).
- Upload images and videos by dropping them on a page. For projects, tick "On page" to show a file under the text, pick the "Tile image" used on the grids, add captions and reorder.
- Deleting a page or file moves it to `.trash/` (git-ignored) instead of erasing it. Move it back to restore.
- Publish commits changes in `src/content` and `public/media` and pushes them. It needs this folder to be its own git repository with a remote; until then the panel says so and nothing is committed.
- The server only listens on 127.0.0.1 and rejects requests that don't come from its own page, so nothing else on your network or in your browser can write to it.
