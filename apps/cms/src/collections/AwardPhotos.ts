import type { CollectionConfig } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'

// Finished NE8 award card artwork (one designed image per athlete, used by
// AwardSeasons.ts), plus any season cover photos — kept out of the main
// Media library on purpose: ~120 cards a school year would bury the logos,
// hero photos, and documents editors actually browse Media for.
//
// Unlike Media, alt text isn't required up front — it's filled in from the
// filename ("aaron-vandervort.png" → "Aaron Vandervort") so a whole season's
// cards can be dropped in at once from an award season's Quick fill,
// without stopping to type 40 alt texts. The site's card alt text comes
// from the award (name and honor), not from here.
//
// Files live under the existing media/ upload directory (already
// gitignored and on the server's disk), in their own subfolder.
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
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'NE8 Awards',
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
