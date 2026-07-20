import type { Block } from 'payload'

export const PhotoGridBlock: Block = {
  slug: 'photoGrid',
  labels: { singular: 'Photo Grid', plural: 'Photo Grids' },
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'Optional — leave blank to omit.' } },
    {
      name: 'photos',
      type: 'array',
      required: true,
      minRows: 2,
      labels: { singular: 'Photo', plural: 'Photos' },
      admin: { description: 'For a single inline photo, use the regular upload button in the toolbar instead — this block is for laying out several photos together (e.g. a game recap).' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } },
        },
        { name: 'caption', type: 'text' },
      ],
    },
  ],
}
