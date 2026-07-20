import type { Block } from 'payload'

// A curated embed, not a raw-HTML/iframe field — Media is public-read (see
// Media.ts's own comment on why SVG is excluded for the same reason), so
// letting an editor paste arbitrary iframe HTML into an article would be a
// stored injection hole reachable by anyone with Articles access. Instead,
// the editor pastes a normal share URL and the frontend (lib/lexical.ts)
// decides the iframe src itself from a small allowlist of known providers
// (YouTube, Vimeo) — any other host renders as a plain link card instead of
// an iframe, so there's no way to smuggle in arbitrary embed content.
export const EmbedBlock: Block = {
  slug: 'embed',
  labels: { singular: 'Video Embed', plural: 'Video Embeds' },
  fields: [
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: {
        description: 'A YouTube or Vimeo video URL. Other links still work, just show as a plain "Open" link instead of an embedded player.',
      },
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
}
