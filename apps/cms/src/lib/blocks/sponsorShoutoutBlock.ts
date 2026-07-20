import type { Block } from 'payload'

export const SponsorShoutoutBlock: Block = {
  slug: 'sponsorShoutout',
  labels: { singular: 'Sponsor Shoutout', plural: 'Sponsor Shoutouts' },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      filterOptions: { mimeType: { in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } },
    },
    { name: 'message', type: 'textarea' },
    { name: 'url', type: 'text', admin: { description: 'Optional — the sponsor\'s website.' } },
  ],
}
