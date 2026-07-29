// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // The real public origin — needed so Astro.site (used for canonical/
  // og:url below) resolves to the actual live domain rather than being
  // undefined at build time. Not www.polandbulldogs.com — that's the
  // district's separate Finalsite-powered site, a different domain entirely.
  site: 'https://athletics.polandbulldogs.com',
  vite: {
    plugins: [tailwindcss()]
  }
});