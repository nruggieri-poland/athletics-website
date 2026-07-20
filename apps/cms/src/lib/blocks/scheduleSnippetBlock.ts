import type { Block } from 'payload'

// Renders live — the frontend looks up this team's real games at build
// time (see extractScheduleSnippetTeamIds/lexicalToHtml in
// apps/web/src/lib/lexical.ts), so this always reflects the actual
// schedule instead of an editor having to retype dates that can drift out
// of sync.
export const ScheduleSnippetBlock: Block = {
  slug: 'scheduleSnippet',
  labels: { singular: 'Schedule Snippet', plural: 'Schedule Snippets' },
  fields: [
    { name: 'team', type: 'relationship', relationTo: 'teams', required: true },
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'upcoming',
      options: [
        { label: 'Upcoming games', value: 'upcoming' },
        { label: 'Recent results', value: 'recent' },
      ],
    },
    { name: 'limit', type: 'number', defaultValue: 5, min: 1, max: 20 },
  ],
}
