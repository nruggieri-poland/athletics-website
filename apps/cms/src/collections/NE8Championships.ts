import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'

// One NE8 championship won by a Poland Seminary team — e.g. "2024-2025
// Football, NE8 Champions". One entry per title, so the list view (sortable
// and filterable by sport and school year) is the record of every
// championship over the years.
//
// Shows on polandathletics.com/ne8/champions, in the NE8 section of each
// sport's page, and on the /ne8 page.

const TITLES = [
  { label: 'NE8 Champions', value: 'champions' },
  { label: 'NE8 Co-Champions', value: 'co-champions' },
  { label: 'NE8 Tournament Champions', value: 'tournament-champions' },
] as const

// OHSAA school year (July 1 – June 30), matching AwardSeasons.ts.
function currentSchoolYear(now = new Date()): string {
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${start + 1}`
}

const idOf = (value: unknown): number | string | undefined => {
  if (value && typeof value === 'object' && 'id' in value)
    return (value as { id: number | string }).id
  if (typeof value === 'number' || typeof value === 'string') return value
  return undefined
}

// Builds the list-view title ("2024-2025 Football — NE8 Champions") and
// refuses a second entry for the same title.
const setTitle: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const pick = <K extends string>(key: K) => (key in data ? data[key] : originalDoc?.[key])
  const schoolYear = pick('schoolYear')
  const sportId = idOf(pick('sport'))
  const title = pick('title')
  const division = pick('division')
  if (!schoolYear || sportId === undefined || !title) return data

  const sport = await req.payload
    .findByID({ collection: 'sports', id: sportId, depth: 0, req })
    .catch(() => null)
  const titleLabel = TITLES.find((option) => option.value === title)?.label ?? 'NE8 Champions'
  const sportName = [division, sport?.name].filter(Boolean).join(' ')
  data.name = `${schoolYear} ${sportName} — ${titleLabel}`

  const existing = await req.payload.find({
    collection: 'ne8-championships',
    where: {
      name: { equals: data.name },
      ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
    },
    limit: 1,
    depth: 0,
    req,
  })
  if (existing.docs.length > 0) {
    // APIError so the message reads word for word in the save toast.
    throw new APIError(`${data.name} is already listed.`, 400, null, true)
  }
  return data
}

export const NE8Championships: CollectionConfig = {
  slug: 'ne8-championships',
  labels: {
    singular: 'NE8 Championship',
    plural: 'NE8 Championships',
  },
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sport', 'schoolYear', 'title'],
    group: 'NE8',
    listSearchableFields: ['name'],
    description:
      'One entry for each NE8 championship a Poland Seminary team has won. Add past years too — each one shows on the NE8 Champions page and on that sport’s page.',
  },
  defaultSort: '-schoolYear',
  hooks: {
    beforeValidate: [setTitle],
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      admin: { hidden: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sport',
          type: 'relationship',
          relationTo: 'sports',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'schoolYear',
          type: 'text',
          required: true,
          index: true,
          defaultValue: () => currentSchoolYear(),
          admin: { width: '50%', description: 'e.g. "2025-2026"' },
          validate: (value: unknown) => {
            const match = /^(\d{4})-(\d{4})$/.exec(String(value ?? ''))
            if (!match || Number(match[2]) !== Number(match[1]) + 1) {
              return 'Use two consecutive years, like 2025-2026.'
            }
            return true
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'title',
          type: 'select',
          required: true,
          defaultValue: 'champions',
          admin: { width: '50%' },
          options: TITLES.map((option) => ({ ...option })),
        },
        {
          name: 'division',
          type: 'select',
          admin: {
            width: '50%',
            description: 'Only for Cross Country, Swimming & Diving, and Track & Field.',
          },
          options: [
            { label: 'Boys', value: 'Boys' },
            { label: 'Girls', value: 'Girls' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'record',
          type: 'text',
          admin: { width: '50%', description: 'Optional, e.g. "7-0 in the NE8".' },
        },
        {
          name: 'teamPhoto',
          type: 'upload',
          relationTo: 'media',
          admin: { width: '50%', description: 'Optional team photo.' },
        },
      ],
    },
  ],
}
