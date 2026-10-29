import type { CollectionConfig } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'

// LEGACY — no longer used. NE8 award card images now live in the regular
// Media library (in whatever folders the editor likes) and are attached by the
// award season's "Match card images" button (endpoints/matchCards.ts).
//
// Kept, hidden, only so nothing uploaded here is deleted: migration
// 20261028_*_award_cards_in_media copied every file in this collection into
// Media (folder "NE8 Award Cards") and pointed the awards at the copies. The
// collection — and its media/award-photos/ files on disk — can be removed in
// a later cleanup once nobody needs the originals.
export const AwardPhotos: CollectionConfig = {
  slug: 'award-photos',
  labels: {
    singular: 'Card Image',
    plural: 'Card Images',
  },
  access: {
    read: () => true,
  },
  admin: {
    hidden: true,
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'NE8',
    description:
      'Finished NE8 award card images (1500 × 2100 px PNG — a trading card at 600 dpi — with anything outside the card shape left transparent) and season cover photos. Usually added from an award season\'s "Quick fill" box rather than here.',
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  upload: {
    staticDir: 'media/award-photos',
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
        width: 800,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
    ],
    adminThumbnail: 'thumbnail',
    // Same explicit list (and the same reason for no SVG) as Media.ts.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      admin: {
        description: 'Filled in from the filename if left blank.',
      },
      hooks: {
        beforeChange: [
          ({ value, data }) => {
            if (value) return value
            const filename = typeof data?.filename === 'string' ? data.filename : ''
            return (
              filename
                .replace(/\.[a-z0-9]+$/i, '')
                .replace(/[-_]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, (letter: string) => letter.toUpperCase()) || value
            )
          },
        ],
      },
    },
  ],
}
