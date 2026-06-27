// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://libredb.org',
  redirects: {
    '/databases': '/providers',
  },
  integrations: [sitemap({
    lastmod: new Date(),
  })],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    assets: 'assets'
  }
});
