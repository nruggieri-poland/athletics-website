import type { CollectionConfig } from 'payload'
import { afterChangeTriggerRebuild, afterDeleteTriggerRebuild } from '../hooks/scheduleRebuildHooks.ts'

// Modeled directly on the legacy WordPress `wp_pshs_events` table so that an
// external data-sync process can upsert rows into this collection (keyed on
// `externalEventId`) without a field-mapping layer in between.
//
// No opponentLogo field here — the frontend resolves each game's logo live,
// by matching opponentName against the Opponents collection at build time
// (see apps/web/src/lib/payload.ts). That way a logo added/edited on an
// Opponent record is correct everywhere immediately, with no per-game copy
// that can go stale.
export const Games: CollectionConfig = {
  slug: 'games',
  // Public read access — consumed directly by the Astro frontend via REST.
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'opponentName',
    defaultColumns: ['team', 'date', 'opponentName', 'homeOrAway', 'result', 'status'],
    group: 'Athletics',
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
    // homeScore/awayScore/result are sync-owned — the EventLink feed (via
    // scripts/schedule-sync) is the source of truth and overwrites these on
    // every sync run, same as date/time/cancellations. Edits made here get
    // overwritten the next time that team's schedule syncs; correct the
    // source data upstream instead if a result is wrong. `notes` is the one
    // field left fully editor-owned — there's no upstream equivalent to
    // sync it from.
    {
      name: 'homeScore',
      type: 'number',
      min: 0,
      admin: {
        description: 'Sync-owned — set automatically from EventLink. Manual edits are overwritten on the next sync.',
      },
    },
    {
      name: 'awayScore',
      type: 'number',
      min: 0,
      admin: {
        description: 'Sync-owned — set automatically from EventLink. Manual edits are overwritten on the next sync.',
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
        description: 'Sync-owned — set automatically from EventLink. Manual edits are overwritten on the next sync. Not yet set for multi-opponent meets (track/swim/golf invitationals, wrestling duals).',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Editor-owned — the external sync process never writes to this field.',
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
