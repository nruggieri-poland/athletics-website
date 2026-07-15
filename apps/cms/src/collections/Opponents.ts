import type { CollectionConfig } from 'payload'
import { propagateOpponentLogoToGames } from '../hooks/matchOpponent.ts'

// The source of truth for opponent logos. An admin creates one record per
// school here (name, mascot, logo upload, and any alternate spellings the
// EventLink feed might send it under), and Games.ts's beforeChange hook
// auto-attaches the right logo to every game by matching against this list
// — no script, no server access, no manual per-game logo picking required
// once a school's record exists here.
export const Opponents: CollectionConfig = {
  slug: 'opponents',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'mascot', 'logo'],
  },
  hooks: {
    // Re-propagates to every already-matched game whenever a logo is
    // added/replaced here — so fixing a wrong logo in one place updates it
    // everywhere it's used, rather than only affecting games created after
    // the fix. See matchOpponent.ts for why this can't just be a
    // relationship the other direction.
    afterChange: [propagateOpponentLogoToGames],
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
