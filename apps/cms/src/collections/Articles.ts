import type { CollectionConfig } from 'payload'
import { BlocksFeature, FixedToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { tagsField } from '../lib/fields/tagsField.ts'
import { EmbedBlock } from '../lib/blocks/embedBlock.ts'
import { PricingTableBlock } from '../lib/blocks/pricingTableBlock.ts'
import { InfoTilesBlock } from '../lib/blocks/infoTilesBlock.ts'
import { CalloutBannerBlock } from '../lib/blocks/calloutBannerBlock.ts'
import { CtaBandBlock } from '../lib/blocks/ctaBandBlock.ts'
import { PhotoGridBlock } from '../lib/blocks/photoGridBlock.ts'
import { ScheduleSnippetBlock } from '../lib/blocks/scheduleSnippetBlock.ts'
import { PullQuoteBlock } from '../lib/blocks/pullQuoteBlock.ts'
import { SponsorShoutoutBlock } from '../lib/blocks/sponsorShoutoutBlock.ts'

export const Articles: CollectionConfig = {
  slug: 'articles',
  // Public read access — consumed directly by the Astro frontend via REST.
  // Draft filtering is handled by Payload's versions/drafts machinery.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedDate', '_status'],
    group: 'Content',
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
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'linkType',
      type: 'radio',
      required: true,
      defaultValue: 'article',
      admin: {
        description:
          'Article: a normal story with its own page. External Link: clicking the card sends visitors straight to a URL (e.g. a YouTube video, or a page elsewhere on this site). PDF: clicking the card opens an uploaded PDF directly.',
      },
      options: [
        { label: 'Article', value: 'article' },
        { label: 'External Link', value: 'external' },
        { label: 'PDF', value: 'pdf' },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      // Defaults already cover bold/italic/lists/headings/links/quotes and
      // inline photo/PDF embeds (UploadFeature, targeting Media — see
      // Media.ts's allowed mimeTypes). Added on top: a persistent toolbar
      // (discoverability for the block-insert command below) and a curated
      // video-embed block — see embedBlock.ts for why this isn't a raw
      // iframe/HTML field.
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
        description: 'Only used for standard Articles.',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'article' && !value) return 'Body is required for standard Articles.'
        return true
      },
    },
    {
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.linkType === 'external',
        description: 'Full URL, e.g. https://youtube.com/watch?v=... or https://example.com/page',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'external' && !value) return 'External URL is required for External Link articles.'
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
        if (data.linkType === 'pdf' && !value) return 'A PDF file is required for PDF articles.'
        return true
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Thumbnail shown on article/news cards — used for every link type, including External Link and PDF.',
      },
    },
    {
      name: 'relatedTeams',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: true,
    },
    {
      name: 'relatedSports',
      type: 'relationship',
      relationTo: 'sports',
      hasMany: true,
    },
    tagsField('For content that doesn\'t fit team/sport scoping, e.g. "Booster Club", "Fundraiser" — or any other tag.'),
    {
      name: 'publishedDate',
      type: 'date',
      required: true,
    },
  ],
}
