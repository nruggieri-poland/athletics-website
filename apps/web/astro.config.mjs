// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

// NE8 award card artwork is pulled from the CMS and re-served from this site
// at build time (see components/awards/AwardCard.astro) — the cards' foil
// and glare are CSS-masked to each artwork's outline, and browsers only
// apply masks from the page's own origin. Astro only optimizes remote
// images from hosts listed here, so allow the CMS's.
const payloadUrl = new URL(
  loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '').PAYLOAD_URL || 'http://localhost:3000',
);

// https://astro.build/config
export default defineConfig({
  // The real public origin — needed so Astro.site (used for canonical/
  // og:url below) resolves to the actual live domain rather than being
  // undefined at build time. Not www.polandbulldogs.com — that's the
  // district's separate Finalsite-powered site, a different domain entirely.
  site: 'https://polandathletics.com',
  image: {
    remotePatterns: [
      {
        protocol: payloadUrl.protocol.replace(':', ''),
        hostname: payloadUrl.hostname,
        ...(payloadUrl.port ? { port: payloadUrl.port } : {}),
      },
    ],
  },
  integrations: [
    sitemap({
      // Print views are the same content as their non-print page, just a
      // different stylesheet — excluding them avoids listing duplicate URLs.
      // /go/ redirects are deliberately unlisted (see Links.ts's slug
      // field) — excluding them here is part of that, not just sitemap
      // hygiene.
      filter: (page) => !page.endsWith('/print/') && !page.includes('/go/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});