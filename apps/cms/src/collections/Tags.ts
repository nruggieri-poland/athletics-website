import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { slugify } from '../lib/slugify.ts'

// A single, open taxonomy shared across the whole site — Media, Links,
// Galleries, and Articles all point back here through the same `tags`
// field (see lib/fields/tagsField.ts). No collection-scoped "type" gates
// which tags are usable where anymore: any tag works anywhere.
//
// No reverse `join` field back to tagged content here — Payload's `join`
// field generates broken SQL (a bare `AS "tags"` with no column, causing a
// Postgres syntax error) when its `on` path is a `hasMany` relationship
// stored in a `_rels` table and `collection` is an array of multiple
// source collections, which is exactly this case. Confirmed against a real
// local Postgres instance: `GET /api/tags` 500s outright with the join
// field present. Browsing "what's tagged with X" has to go through each
// collection's own list view filtered by tag instead.
export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    group: 'Resources',
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
  ],
}
