import type { CollectionConfig } from 'payload'

export const Seasons: CollectionConfig = {
  slug: 'seasons',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'year',
    defaultColumns: ['year', 'seasonType', 'isCurrent'],
  },
  fields: [
    {
      name: 'year',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "2025-2026"',
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
      name: 'isCurrent',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
