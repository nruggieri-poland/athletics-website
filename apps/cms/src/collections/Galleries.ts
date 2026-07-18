import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { slugify } from '../lib/slugify.ts'

// A hand-curated, ordered collection of Media/Links items, grouped into
// optional named sections — e.g. "2024 Homecoming Photos", "Parent Forms".
// Looked up by slug and embedded on a specific page by a developer; there's
// no page-builder here, an admin doesn't create new routes, just the
// content of a gallery a developer has already wired up somewhere.
export const Galleries: CollectionConfig = {
  slug: 'galleries',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'isPublic'],
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Looked up by a developer-wired page to render this gallery.',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            if (data?.title) return slugify(data.title)
            return value
          },
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      label: 'Visible on the live site',
    },
    {
      name: 'sections',
      type: 'array',
      labels: {
        singular: 'Section',
        plural: 'Sections',
      },
      admin: {
        description: 'Optional groupings, e.g. "Fall Sports". Leave heading blank for one unlabeled group.',
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
        },
        {
          name: 'items',
          type: 'array',
          labels: {
            singular: 'Item',
            plural: 'Items',
          },
          fields: [
            {
              name: 'item',
              type: 'relationship',
              relationTo: ['media', 'links'],
              required: true,
              admin: {
                description: 'An uploaded photo/PDF (Media) or a video/external link (Links).',
              },
            },
            {
              name: 'caption',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
