import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://feroze.work',
  trailingSlash: 'never',
  build: { format: 'file' },
});
