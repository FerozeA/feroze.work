# feroze.work

Static portfolio site built with [Astro](https://astro.build). Content lives in [Sanity](https://www.sanity.io) (project `avk9byrq`, dataset `production`) and is read at build time.

```bash
npm install
npm run dev      # site at http://localhost:4321
npm run build    # outputs to dist/
npm run studio   # Sanity Studio at http://localhost:3333 (run `npm install` in studio/ first)
```

## Where things live

| Path | What |
|---|---|
| `src/lib/content.js` | The one Sanity query, plus how images, videos and rich text become HTML |
| `src/pages/` | Home, Work index (grid / list), project pages, 404, `/jrvrn` |
| `src/components/` | `Identity` (name block / back link), `Tile`, `Media` |
| `src/scripts/interactions.js` | All the client-side details: hover pill, cursor preview, view switch, image zoom, video hover-play, blur-up |
| `src/styles/global.css` | Colour and motion tokens at the top, then every style |
| `studio/` | The Sanity Studio (schemas in `studio/schemaTypes`) |

## Editing content

In the Studio:

- **Home & settings**: name, role, intro, search description, social links. In the intro, a link can have a **logo** (small square before the text) and a **preview** image (a little browser window that floats above the link on hover). Links with a preview but no logo get a monogram.
- **Projects**: title, URL name, date (free text), optional one-line summary (shown in the /work list view), body, media on the page, the tile image or video, category, order, and "Show on home". Projects in **Experiments** still get a page but aren't listed on /work.

The site is static, so a publish appears after the next build. To make that automatic, create a Deploy Hook in Vercel (Project → Settings → Git → Deploy Hooks) and add it as a webhook in Sanity (manage → API → Webhooks, trigger on create/update/delete).

## Deploying

Vercel: build command `npm run build`, output `dist`. The build fetches from Sanity's public API, so no token is needed. `PUBLIC_SANITY_PROJECT_ID` / `PUBLIC_SANITY_DATASET` override the defaults if you ever switch datasets.

Studio: `cd studio && npm run deploy` publishes it to `https://feroze-work.sanity.studio`.

## History

The content was imported once from the old markdown files with `studio/scripts/import-markdown.ts`. The markdown, `public/media` and the old local admin app were removed afterwards and are still in git history (before the `feat/sanity-dark-mode` branch).
