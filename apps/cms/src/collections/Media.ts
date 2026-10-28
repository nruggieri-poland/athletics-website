import type { CollectionConfig } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'
import { tagsField } from '../lib/fields/tagsField.ts'

export const Media: CollectionConfig = {
  slug: 'media',
  // Public read access — images/uploads need to be servable directly to the
  // Astro frontend without auth.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'alt',
    group: 'Resources',
  },
  // Native Payload folders, same as Documents — lets an admin drag uploads
  // into folders ("Opponent Logos", "Hero Photos", "Article Images") from
  // the media library UI instead of one flat list of everything.
  folders: true,
  // Media items can now be directly, publicly listed (tagged as a public
  // resource, referenced from a Gallery), not just referenced from an
  // already-hooked collection like Articles — so a Media-only edit (e.g.
  // toggling isPublic) needs to trigger a rebuild on its own too.
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  upload: {
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
      {
        name: 'card',
        width: 768,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
      {
        name: 'hero',
        width: 1600,
        height: undefined,
        fit: 'cover',
        formatOptions: { format: 'webp' },
      },
    ],
    // Images (team/opponent logos, hero photos) and PDFs (documents, and
    // now PDF-type news articles) share this one upload collection.
    // Deliberately an explicit list, not 'image/*' — SVGs can carry inline
    // <script> tags. The app only ever renders uploads via <img src>, which
    // browsers don't execute SVG scripts through, but Media has public read
    // access (raw file URLs are directly browsable), so anyone who opens an
    // uploaded SVG's URL as a top-level navigation would execute it in the
    // CMS's own origin. Re-export any existing SVG logo as PNG/WebP instead.
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      // Not required up front, so a whole batch can be uploaded at once
      // (e.g. a season's ~40 NE8 award card images) without typing an alt
      // text for each: left blank, it's filled in from the filename on save
      // ("2026-fall-angelo-rinaldi.png" → "2026 Fall Angelo Rinaldi"), so
      // every image still ends up with one.
      admin: {
        description:
          'Describe the image for screen readers. Filled in from the filename if left blank.',
      },
      hooks: {
        beforeChange: [
          ({ value, data }) => {
            if (value) return value
            const filename = typeof data?.filename === 'string' ? data.filename : ''
            return (
              filename
                .replace(/\.[a-z0-9]+$/i, '')
                .replace(/[-_]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, (letter: string) => letter.toUpperCase()) || value
            )
          },
        ],
      },
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      type: 'collapsible',
      label: 'Public Resource Details',
      admin: {
        initCollapsed: true,
        description:
          'Fill in only if this file should also appear as a downloadable/public resource (e.g. Parents/Coaches pages) — leave collapsed for ordinary hero photos, logos, and article images.',
      },
      // A collapsible has no `name` and isn't a data field itself, so
      // these still serialize as flat top-level keys on the API response
      // (media.title, media.tags, ...) — same shape as every other
      // collection in this codebase, not nested under media.resource.*.
      fields: [
        tagsField(
          'Controls which Resources page(s) this shows on — tags are open, use whichever apply.',
        ),
        {
          name: 'title',
          type: 'text',
          admin: {
            description:
              'Display title in Resources listings — distinct from Alt Text above, which is for screen readers.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'sortOrder',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'isPublic',
          type: 'checkbox',
          defaultValue: false,
          label: 'Visible in Resources listings',
        },
        {
          name: 'placement',
          type: 'select',
          defaultValue: 'none',
          admin: {
            description:
              'Assigns this file to render on a specific hardcoded page (e.g. the Boosters Program Ads/Sponsorships PDF preview), independent of tags or the Visible checkbox above.',
          },
          options: [
            { label: 'None (tags/galleries only)', value: 'none' },
            { label: 'Boosters — Program Ads PDF', value: 'boosterProgramAds' },
            { label: 'Boosters — Sponsorships PDF', value: 'boosterSponsorships' },
          ],
        },
      ],
    },
  ],
}
