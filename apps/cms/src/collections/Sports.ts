import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const Sports: CollectionConfig = {
  slug: 'sports',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'seasonType', 'sortOrder'],
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            if (data?.name) return slugify(data.name)
            return value
          },
        ],
      },
    },
    {
      name: 'seasonType',
      type: 'select',
      required: true,
      options: [
        { label: 'Fall', value: 'Fall' },
        { label: 'Winter', value: 'Winter' },
        { label: 'Spring', value: 'Spring' },
      ],
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'heroVideoId',
      type: 'text',
      admin: {
        description:
          'YouTube video ID (the part after "v=" in the URL) to play muted/looped as this sport\'s hub-page hero background. Leave blank to fall back to a plain background.',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Background photo for this sport\'s tile on the /sports grid. Leave blank to fall back to a plain dark tile.',
      },
    },
  ],
}
