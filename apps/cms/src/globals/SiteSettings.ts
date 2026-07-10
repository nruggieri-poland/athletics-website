import type { GlobalConfig } from 'payload'
import { afterChangeTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'address',
      type: 'text',
      admin: {
        description: 'School address shown in the top banner, e.g. "100 Bulldog Ln, Poland, OH 44514".',
      },
    },
    {
      name: 'primaryColor',
      type: 'text',
      admin: {
        description: 'Hex color, e.g. #123456',
      },
    },
    {
      name: 'secondaryColor',
      type: 'text',
      admin: {
        description: 'Hex color, e.g. #abcdef',
      },
    },
    {
      name: 'footerText',
      type: 'richText',
    },
    {
      name: 'heroVideoId',
      type: 'text',
      admin: {
        description:
          'YouTube video ID (the part after "v=" in the URL) to play muted/looped as the home page hero background. Leave blank to fall back to a plain background.',
      },
    },
    {
      name: 'heroHeading',
      type: 'text',
      defaultValue: 'Bulldogs Athletics',
    },
    {
      name: 'heroTagline',
      type: 'text',
      defaultValue: 'Schedules, scores, and news for every Poland Seminary team.',
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Twitter', value: 'twitter' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'YouTube', value: 'youtube' },
          ],
        },
        {
          name: 'url',
          type: 'text',
        },
      ],
    },
  ],
}
