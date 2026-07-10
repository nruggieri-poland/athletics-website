import type { CollectionConfig } from 'payload'

// Standard Payload auth-enabled collection. Only used for a small handful
// (1-2) of admin/communications accounts — no public-facing registration.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
