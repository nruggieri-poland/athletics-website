import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

// Modeled directly on the legacy WordPress `wp_pshs_events` table so that an
// external data-sync process can upsert rows into this collection (keyed on
// `externalEventId`) without a field-mapping layer in between.
export const Games: CollectionConfig = {
  slug: 'games',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'opponentName',
    defaultColumns: ['team', 'date', 'opponentName', 'homeOrAway', 'result', 'status'],
  },
  hooks: {
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'team',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      index: true,
    },
    {
      name: 'season',
      type: 'relationship',
      relationTo: 'seasons',
      required: true,
    },
    {
      name: 'externalEventId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Upsert key used by the external sync process. Do not edit manually.',
      },
    },
    {
      name: 'eventType',
      type: 'select',
      defaultValue: 'Game',
      options: [
        { label: 'Game', value: 'Game' },
        { label: 'Practice', value: 'Practice' },
        { label: 'Scrimmage', value: 'Scrimmage' },
        { label: 'Other', value: 'Other' },
      ],
    },
    {
      name: 'date',
      type: 'date',
      required: true,
    },
    {
      name: 'time',
      type: 'text',
      admin: {
        description: 'Display string, e.g. "07:00 PM"',
      },
    },
    {
      name: 'time24',
      type: 'text',
      admin: {
        description: '24-hour form for sorting, e.g. "19:00"',
      },
    },
    {
      name: 'isTimeTBD',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'homeOrAway',
      type: 'select',
      options: [
        { label: 'Home', value: 'Home' },
        { label: 'Away', value: 'Away' },
        { label: 'Neutral', value: 'Neutral' },
      ],
    },
    {
      name: 'opponentName',
      type: 'text',
    },
    {
      name: 'opponentMascot',
      type: 'text',
    },
    {
      name: 'opponentLogo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'location',
      type: 'text',
    },
    {
      name: 'isConferenceGame',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isCancelled',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isPostponed',
      type: 'checkbox',
      defaultValue: false,
    },
    // EDITOR-OWNED FIELDS — an external sync process must never write to
    // homeScore, awayScore, result, or notes. These are populated/edited by
    // staff in the admin UI only; this mirrors a real invariant from the
    // WordPress system being replaced (the sync bot only touches schedule
    // fields, never scores/results/notes).
    {
      name: 'homeScore',
      type: 'number',
      min: 0,
      admin: {
        description: 'Editor-owned — the external sync process must never write to this field.',
      },
    },
    {
      name: 'awayScore',
      type: 'number',
      min: 0,
      admin: {
        description: 'Editor-owned — the external sync process must never write to this field.',
      },
    },
    {
      name: 'result',
      type: 'select',
      options: [
        { label: 'W', value: 'W' },
        { label: 'L', value: 'L' },
        { label: 'T', value: 'T' },
      ],
      admin: {
        description: 'Editor-owned — the external sync process must never write to this field.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Editor-owned — the external sync process must never write to this field.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Removed', value: 'removed' },
      ],
      admin: {
        description: 'Soft-delete marker.',
      },
    },
  ],
}
