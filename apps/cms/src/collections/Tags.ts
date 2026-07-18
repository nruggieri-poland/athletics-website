import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { slugify } from '../lib/slugify.ts'

// Shared taxonomy for two unrelated needs: "audience" tags control which
// Resources page (Parents, Coaches, and any future audience) a Document
// shows on, and "topic" tags let an Article opt into a broad subject (e.g.
// "Booster Club") without being scoped to any team or sport. One collection,
// split by `type`, so adding a new audience or topic later is just a new
// row here — no code change or migration required.
export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type'],
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
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Audience (Documents)', value: 'audience' },
        { label: 'Topic (Articles)', value: 'topic' },
      ],
    },
  ],
}
