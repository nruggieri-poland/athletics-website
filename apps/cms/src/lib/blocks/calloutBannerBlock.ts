import type { Block } from 'payload'

export const CalloutBannerBlock: Block = {
  slug: 'calloutBanner',
  labels: { singular: 'Callout Banner', plural: 'Callout Banners' },
  fields: [
    {
      name: 'tone',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Info (blue)', value: 'info' },
        { label: 'Warning (amber)', value: 'warning' },
      ],
    },
    { name: 'title', type: 'text', required: true, admin: { description: 'e.g. "Weather delays & cancellations"' } },
    { name: 'body', type: 'textarea', required: true },
  ],
}
