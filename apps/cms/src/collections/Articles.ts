import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

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
      editor: lexicalEditor(),
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
    {
      name: 'topicTags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      filterOptions: {
        type: { equals: 'topic' },
      },
      admin: {
        description: 'For content that doesn\'t fit team/sport scoping, e.g. "Booster Club", "Fundraiser".',
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      required: true,
    },
  ],
}
