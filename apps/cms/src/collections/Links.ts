import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'
import { tagsField } from '../lib/fields/tagsField.ts'

// URL/video-only resources — the case Media can't hold, since Payload's
// upload-enabled collections require a real file per record. Same shared
// `tags` field as Media/Galleries/Articles, so a Gallery item or a
// Resources listing can mix uploaded files and links under one tag.
export const Links: CollectionConfig = {
  slug: 'links',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'linkType', 'isPublic'],
    group: 'Resources',
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
      name: 'linkType',
      type: 'radio',
      required: true,
      defaultValue: 'external',
      options: [
        { label: 'External Link', value: 'external' },
        { label: 'Video (YouTube)', value: 'video' },
      ],
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.linkType === 'external',
        description: 'Full URL, e.g. https://docs.google.com/...',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'external' && !value) return 'URL is required for External Link.'
        return true
      },
    },
    {
      name: 'videoId',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData.linkType === 'video',
        description: 'YouTube video ID (the part after "v=") — same convention as Sports.heroVideoId.',
      },
      validate: (value: unknown, { siblingData }: { siblingData: { linkType?: string } }) => {
        const data = siblingData ?? {}
        if (data.linkType === 'video' && !value) return 'Video ID is required for Video links.'
        return true
      },
    },
    tagsField(),
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      defaultValue: false,
      label: 'Visible on the live site',
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
    },
  ],
}
