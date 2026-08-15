import type { CollectionConfig } from 'payload'
import { BlocksFeature, FixedToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { EmbedBlock } from '../lib/blocks/embedBlock.ts'
import { PricingTableBlock } from '../lib/blocks/pricingTableBlock.ts'
import { InfoTilesBlock } from '../lib/blocks/infoTilesBlock.ts'
import { CalloutBannerBlock } from '../lib/blocks/calloutBannerBlock.ts'
import { CtaBandBlock } from '../lib/blocks/ctaBandBlock.ts'
import { PhotoGridBlock } from '../lib/blocks/photoGridBlock.ts'
import { ScheduleSnippetBlock } from '../lib/blocks/scheduleSnippetBlock.ts'
import { PullQuoteBlock } from '../lib/blocks/pullQuoteBlock.ts'
import { SponsorShoutoutBlock } from '../lib/blocks/sponsorShoutoutBlock.ts'

// Same authoring mechanism as Articles (full rich-text body with the same
// block library, or a bare External Link/PDF passthrough instead of a
// body) — deliberately duplicated rather than shared, so the two stay
// free to diverge. The difference is entirely about discoverability, not
// capability: an Article renders at /news/[slug] and shows up in the news
// feed/team pages; a Special Page renders at /go/[slug] and shows up
// nowhere — no index, no nav link, excluded from the sitemap, disallowed
// in robots.txt (see astro.config.mjs / public/robots.txt). Meant for
// audience-specific content (forms, one-off instructions, vendor pages)
// you hand out a direct link to rather than publish.
export const SpecialPages: CollectionConfig = {
  slug: 'special-pages',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status'],
    group: 'Content',
    description: 'Unlisted pages at polandathletics.com/go/[slug] — not linked, indexed, or shown anywhere on the site. Share the link directly.',
  },
  versions: {
    drafts: true,
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
        description: 'The path after /go/ — e.g. "football-officials" becomes polandathletics.com/go/football-officials.',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Slug is required.'
        return /^[a-z0-9-]+$/.test(value) ? true : 'Lowercase letters, numbers, and hyphens only.'
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      admin: {
        description: 'Used as this page\'s meta description — not shown anywhere else, since Special Pages have no listing.',
      },
    },
    {
      name: 'linkType',
      type: 'radio',
      required: true,
      defaultValue: 'article',
      admin: {
        description:
          'Page: a normal page with its own body content at /go/[slug]. External Link: /go/[slug] redirects straight to a URL. PDF: /go/[slug] redirects straight to an uploaded PDF.',
      },
      options: [
        { label: 'Page', value: 'article' },
        { label: 'External Link', value: 'external' },
        { label: 'PDF', value: 'pdf' },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          FixedToolbarFeature(),
          BlocksFeature({
            blocks: [
              EmbedBlock,
              PricingTableBlock,
              InfoTilesBlock,
              CalloutBannerBlock,
              CtaBandBlock,
              PhotoGridBlock,
              ScheduleSnippetBlock,
              PullQuoteBlock,
              SponsorShoutoutBlock,
            ],
          }),
        ],
      }),
      admin: {
        condition: (_, siblingData) => siblingData.linkType !== 'external' && siblingData.linkType !== 'pdf',
        description: 'Only used for linkType "Page".',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'article' && !value) return 'Body is required for a Page.'
        return true
      },
    },
    {
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.linkType === 'external',
        description: 'Full URL, e.g. https://example.com/form',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'external' && !value) return 'External URL is required for External Link.'
        return true
      },
    },
    {
      name: 'pdfFile',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        mimeType: { equals: 'application/pdf' },
      },
      admin: {
        condition: (_, siblingData) => siblingData.linkType === 'pdf',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'pdf' && !value) return 'A PDF file is required for PDF.'
        return true
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional — used as this page\'s social-share preview image. No card/thumbnail uses this, since Special Pages have no listing.',
      },
    },
  ],
}
