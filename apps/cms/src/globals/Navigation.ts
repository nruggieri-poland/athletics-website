import type { GlobalConfig } from 'payload'
import { afterChangeTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

// "Sports" isn't in here — it's a mega menu built from live Sports/Teams
// data (with a High School/Junior High toggle), not a plain label+url, so
// it stays hardcoded as the first item in Header.astro. Everything else
// (Calendar, Documents, News, and any link an admin adds) lives here, and
// each one can be shown in the header, the footer, both, or neither —
// drag to reorder in the admin UI, that order is what renders.
export const Navigation: GlobalConfig = {
  slug: 'navigation',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
  },
  fields: [
    {
      name: 'links',
      type: 'array',
      labels: {
        singular: 'Link',
        plural: 'Links',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
        {
          name: 'showInHeader',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'showInFooter',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'group',
          type: 'select',
          defaultValue: 'primary',
          admin: {
            description: 'Primary links sit directly in the header. "More" links are tucked into a low-visibility "More" dropdown instead — use this for secondary pages that need to be reachable but not front-and-center.',
          },
          options: [
            { label: 'Primary', value: 'primary' },
            { label: 'More (tucked into a dropdown)', value: 'more' },
          ],
        },
      ],
    },
  ],
}
