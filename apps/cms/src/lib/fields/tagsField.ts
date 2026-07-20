import type { Field } from 'payload'

// The one shared definition of "this thing can be tagged" — spread into
// every taggable collection (Media, Links, Galleries, Articles, and
// whatever's added later) so the field name and shape never drift between
// them. That consistency is load-bearing, not cosmetic: Tags' reverse
// `taggedContent` join field (see Tags.ts) only works because every target
// collection uses this exact field name.
//
// Deliberately no `filterOptions` — tags are fully open. There's no `type`
// classification on Tags to filter by anymore; any tag can be used on
// anything.
export function tagsField(description?: string): Field {
  return {
    name: 'tags',
    type: 'relationship',
    relationTo: 'tags',
    hasMany: true,
    admin: {
      description: description ?? 'Tags for filtering and organization — used across the whole site, not just this collection.',
    },
  }
}
