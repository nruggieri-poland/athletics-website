import type { Block } from 'payload'

export const CtaBandBlock: Block = {
  slug: 'ctaBand',
  labels: { singular: 'CTA Band', plural: 'CTA Bands' },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'e.g. "Support the Bulldogs year-round"' } },
    { name: 'body', type: 'textarea' },
    { name: 'ctaLabel', type: 'text', required: true, admin: { description: 'Button text, e.g. "Contact the Booster Club"' } },
    { name: 'ctaUrl', type: 'text', required: true, admin: { description: 'A URL, or mailto:address@example.com' } },
  ],
}
