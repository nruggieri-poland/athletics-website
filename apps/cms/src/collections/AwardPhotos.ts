import type { CollectionConfig } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'

// Athlete photos for NE8 award cards (AwardSeasons.ts), kept out of the main
// Media library on purpose: ~120 headshots a school year would bury the
// logos, hero photos, and documents editors actually browse Media for.
//
// Unlike Media, alt text isn't required up front — it's filled in from the
// filename ("aaron-vandervort.jpg" → "Aaron Vandervort") so a whole season's
// photos can be dropped in at once from an award season's Quick fill,
// without stopping to type 40 alt texts. The card itself also reads the
// athlete's name from the award, not from here.
//
// Files live under the existing media/ upload directory (already
// gitignored and on the server's disk), in their own subfolder.
export const AwardPhotos: CollectionConfig = {
  slug: 'award-photos',
  labels: {
    singular: 'Award Photo',
    plural: 'Award Photos',
  },
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'NE8 Awards',
    description:
      'Photos used on NE8 award cards. Usually added from an award season\'s "Quick fill" box rather than here. Set a focal point on a photo to control how it\'s framed on its card.',
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
