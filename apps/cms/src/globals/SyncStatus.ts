import type { GlobalConfig } from 'payload'

// Written exclusively by importFeed.ts at the end of every schedule-sync
// run. Every field is admin.readOnly — nothing here is meant to be
// hand-edited, it exists purely so "did the sync actually run, and when"
// is answerable with one glance at the admin instead of reverse-engineering
// it from Games' updatedAt timestamps. No public read access (unlike
// SiteSettings/Navigation) since this isn't consumed by the frontend.
export const SyncStatus: GlobalConfig = {
  slug: 'sync-status',
  admin: {
    description: 'Read-only — updated automatically by the schedule sync. Nothing here is hand-edited.',
  },
  fields: [
    {
      name: 'lastSyncAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the schedule sync last ran, successfully or not.',
      },
    },
    { name: 'created', type: 'number', admin: { readOnly: true } },
    { name: 'updated', type: 'number', admin: { readOnly: true } },
    { name: 'retired', type: 'number', admin: { readOnly: true } },
    { name: 'skipped', type: 'number', admin: { readOnly: true } },
    {
      name: 'warnings',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'One per line, from the sync\'s last run — e.g. teams with no matching slug.',
      },
    },
  ],
}
