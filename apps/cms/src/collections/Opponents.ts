import type { CollectionConfig } from 'payload'

// The source of truth for opponent logos. An admin creates one record per
// school here (name, mascot, logo upload, and any alternate spellings the
// EventLink feed might send it under). The frontend matches each game's
// opponentName against this list live at build time (see
// apps/web/src/lib/payload.ts) — no write-time hook copies a logo onto the
// Game itself, so there's nothing here that can go stale: editing a logo
// or adding an alias is correct on every game the next time the site
// rebuilds, with no per-game backfill step.
export const Opponents: CollectionConfig = {
  slug: 'opponents',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'mascot', 'logo'],
    group: 'Athletics',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'The short name Games store, e.g. "Wickliffe" (not "Wickliffe High School").',
      },
    },
    {
      name: 'mascot',
      type: 'text',
    },
    {
      name: 'aliases',
      type: 'array',
      admin: {
        description:
          'Other ways this school\'s name shows up in the EventLink feed, e.g. "Wickliffe HS", "Wickliffe High School". Add one whenever a game doesn\'t pick up this logo automatically.',
      },
      fields: [
        {
          name: 'alias',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
