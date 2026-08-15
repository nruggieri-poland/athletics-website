import type { CollectionConfig } from 'payload'
import { timingSafeEqual } from 'node:crypto'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

// Short outbound links (polandathletics.com/go/[slug] -> an external URL)
// meant to be created often without turning into a permanent, publicly
// browsable list. Unlike every other collection in this CMS, read access
// is NOT public — a logged-in admin session can always read/write as
// usual, but the REST API rejects anonymous requests. The Astro build is
// the one non-admin consumer, authenticated with a shared build key
// (mirrors importFeed.ts's sync-key pattern) rather than a real login, so
// the site can still statically generate each /go/[slug] page without
// ever exposing the full slug/destination list to the public.
function isBuildRequest(req: { headers: { get(name: string): string | null } }): boolean {
  const expected = process.env.PAYLOAD_BUILD_API_KEY
  if (!expected) return false

  const header = req.headers.get('authorization') ?? ''
  const match = /^build-key (.+)$/.exec(header)
  if (!match) return false

  const provided = match[1]
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'slug',
    defaultColumns: ['slug', 'destinationUrl', 'updatedAt'],
    description:
      'Short outbound links — polandathletics.com/go/[slug] redirects to Destination URL. Not publicly listable: this collection is admin-only to read, so the full list of redirects is never exposed, even though each individual link works once someone has it.',
  },
  access: {
    read: ({ req }) => !!req.user || isBuildRequest(req),
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'The short path after /go/ — e.g. "hudl" becomes polandathletics.com/go/hudl.',
      },
      validate: (value: string | null | undefined) => {
        if (!value) return 'Slug is required.'
        return /^[a-z0-9-]+$/.test(value) ? true : 'Lowercase letters, numbers, and hyphens only.'
      },
    },
    {
      name: 'destinationUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'Where /go/[slug] sends visitors — a full URL, e.g. https://hudl.com/team/...',
      },
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Optional, for your own reference — never shown publicly.',
      },
    },
  ],
}
