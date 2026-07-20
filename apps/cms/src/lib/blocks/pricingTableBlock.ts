import type { Block } from 'payload'

export const PricingTableBlock: Block = {
  slug: 'pricingTable',
  labels: { singular: 'Pricing Table', plural: 'Pricing Tables' },
  fields: [
    { name: 'heading', type: 'text', admin: { description: 'e.g. "Season Tickets & Memberships" — leave blank to omit.' } },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Row', plural: 'Rows' },
      fields: [
        { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Adult Season Pass"' } },
        { name: 'price', type: 'text', required: true, admin: { description: 'e.g. "$60"' } },
        { name: 'description', type: 'text', admin: { description: 'e.g. "All home events, all sports"' } },
      ],
    },
    { name: 'contactEmail', type: 'text', admin: { description: 'Optional — shown as "Questions? Contact <email>" below the table.' } },
  ],
}
