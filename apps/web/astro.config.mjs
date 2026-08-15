// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // The real public origin — needed so Astro.site (used for canonical/
  // og:url below) resolves to the actual live domain rather than being
  // undefined at build time. Not www.polandbulldogs.com — that's the
  // district's separate Finalsite-powered site, a different domain entirely.
  site: 'https://polandathletics.com',
  integrations: [
    sitemap({
      // Print views are the same content as their non-print page, just a
      // different stylesheet — excluding them avoids listing duplicate URLs.
      // /go/ redirects are deliberately not public-listable at all (see
      // Redirects.ts) — excluding them here is part of that, not just
      // sitemap hygiene.
      filter: (page) => !page.endsWith('/print/') && !page.includes('/go/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});