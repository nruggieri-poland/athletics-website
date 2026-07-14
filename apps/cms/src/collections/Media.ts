import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  // Public read access — images/uploads need to be servable directly to the
  // Astro frontend without auth.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'alt',
  },
  // Native Payload folders, same as Documents — lets an admin drag uploads
  // into folders ("Opponent Logos", "Hero Photos", "Article Images") from
  // the media library UI instead of one flat list of everything.
  folders: true,
  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
      {
        name: 'card',
        width: 768,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
      {
        name: 'hero',
        width: 1600,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
    ],
    // Images (team/opponent logos, hero photos) and PDFs (documents, and
    // now PDF-type news articles) share this one upload collection.
    // Deliberately an explicit list, not 'image/*' — SVGs can carry inline
    // <script> tags. The app only ever renders uploads via <img src>, which
    // browsers don't execute SVG scripts through, but Media has public read
    // access (raw file URLs are directly browsable), so anyone who opens an
    // uploaded SVG's URL as a top-level navigation would execute it in the
    // CMS's own origin. Re-export any existing SVG logo as PNG/WebP instead.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
}
