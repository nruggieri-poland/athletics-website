import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'
import { APIError } from 'payload'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'
import {
  BETTER_WHEN,
  DATE_HELP,
  STATUSES,
  TEMPLATE_CSV,
  deriveAll,
  mergePastedRows,
  parseRecordDate,
  parseRecordRows,
  type RecordCategory,
} from '../lib/schoolRecords.ts'

// One sport's school record book — e.g. "Boys Golf Records" — replacing the
// per-sport Google Sheets that kept "Current Records" and "Record History"
// as two hand-kept copies (which drifted apart).
//
// Every record-setting or record-tying performance is entered once, under
// its category, with Original / Broken / Tied. On save, lib/schoolRecords.ts
// works out each category's current holder(s) into `currentRecords`, plus
// soft warnings for entries that look off (never blocking the save) — shown
// in the sidebar's "Record check" panel.
//
// Private by default: until "Show on the website" is checked, nobody but a
// logged-in admin can read the book, through the site or the API. Even for
// a public book, the full history (`categories`) stays admin-only — the
// site shows current records only (polandathletics.com/<sport>/records and
// /records).

const idOf = (value: unknown): number | string | undefined => {
  if (value && typeof value === 'object' && 'id' in value)
    return (value as { id: number | string }).id
  if (typeof value === 'number' || typeof value === 'string') return value
  return undefined
}

const adminsOnly: FieldAccess = ({ req }) => Boolean(req.user)

// Builds the list-view name, refuses a second book for the same sport, and
// folds any pasted spreadsheet rows into the categories.
const prepareBook: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data
  const pick = (key: string) => (key in data ? data[key] : originalDoc?.[key])

  const sportId = idOf(pick('sport'))
  const division = pick('division')
  if (sportId !== undefined) {
    const sport = await req.payload
      .findByID({ collection: 'sports', id: sportId, depth: 0, req })
      .catch(() => null)
    data.name = `${[division, sport?.name].filter(Boolean).join(' ')} Records`

    const existing = await req.payload.find({
      collection: 'record-books',
      where: {
        name: { equals: data.name },
        ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (existing.docs.length > 0) {
      // APIError so the message reads word for word in the save toast.
      throw new APIError(
        `There's already a ${data.name} book — open that one to add to it instead.`,
        400,
        null,
        true,
      )
    }
  }

  const pasted = typeof data.pasteList === 'string' ? data.pasteList.trim() : ''
  if (pasted) {
    let rows
    try {
      rows = parseRecordRows(pasted)
    } catch (error) {
      throw new APIError((error as Error).message, 400, null, true)
    }
    const categories = (pick('categories') ?? []) as RecordCategory[]
    data.categories = mergePastedRows(categories, rows).categories
    data.pasteList = ''
  }
  return data
}

// Recomputes the current records whenever the categories are saved (an
// admin save always sends them; a partial API update without them keeps
// what's stored).
const computeCurrent: CollectionBeforeChangeHook = ({ data }) => {
  if (Array.isArray(data?.categories)) {
    data.currentRecords = deriveAll(data.categories as RecordCategory[])
  }
  return data
}

export const RecordBooks: CollectionConfig = {
  slug: 'record-books',
  labels: {
    singular: 'Record Book',
    plural: 'School Records',
  },
  access: {
    read: ({ req }) => (req.user ? true : { isPublic: { equals: true } }),
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isPublic', 'updatedAt'],
    group: 'Athletics',
    listSearchableFields: ['name'],
    description:
      'One record book per sport. Add each record-setting or record-tying performance once — the site works out who holds each record now. Books stay private until "Show on the website" is checked.',
  },
  defaultSort: 'name',
  // /api/record-books/template.csv — the blank spreadsheet linked from the
  // paste box's help panel. Just a header row.
  endpoints: [
    {
      path: '/template.csv',
      method: 'get',
      handler: () =>
        new Response(TEMPLATE_CSV, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="school-records-template.csv"',
          },
        }),
    },
  ],
  hooks: {
    beforeValidate: [prepareBook],
    beforeChange: [computeCurrent],
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      index: true,
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
          name: 'division',
          type: 'select',
          admin: {
            width: '50%',
            description:
              'Only for Cross Country, Swimming & Diving, and Track & Field — one book for Boys, one for Girls.',
          },
          options: [
            { label: 'Boys', value: 'Boys' },
            { label: 'Girls', value: 'Girls' },
          ],
        },
      ],
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      label: 'Show on the website',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          "Leave unchecked to keep this record book private — only admins can see it. Checked, its current records show on the sport's Records page and on /records.",
      },
    },
    {
      // Display-only: current holders and anything worth a second look.
      name: 'recordCheck',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: './components/RecordCheckPanel.tsx#RecordCheckPanel',
        },
      },
    },
    {
      // Worked out on save (computeCurrent) — what the site reads.
      name: 'currentRecords',
      type: 'json',
      admin: { hidden: true },
    },
    {
      type: 'collapsible',
      label: 'Quick fill',
      admin: {
        initCollapsed: true,
        description:
          'Paste rows from a records spreadsheet to add them all at once. Used up when you save — the rows show up in Records below.',
      },
      fields: [
        {
          name: 'pasteList',
          type: 'textarea',
          label: 'Paste from the spreadsheet',
          access: { read: adminsOnly },
          admin: {
            rows: 6,
            placeholder:
              "Tied\t18 Holes, Individual\tMatthew Morrone '27\t69 (-3)\t10/12/2026\tFirestone CC",
            description:
              'Columns in the order Status, Record, Holder(s), Mark, Date, Notes (a header row is fine). Leave Status blank and the first entry in each record becomes Original, the rest Broken.',
            components: {
              afterInput: ['./components/RecordPasteHelp.tsx#RecordPasteHelp'],
            },
          },
        },
      ],
    },
    {
      name: 'categories',
      type: 'array',
      label: 'Records',
      labels: { singular: 'Record', plural: 'Records' },
      // The full history stays in the CMS — the site shows current records
      // only, so the public API doesn't hand it out either.
      access: { read: adminsOnly },
      admin: {
        initCollapsed: true,
        description:
          'One row per record kept for this sport (e.g. "18 Holes, Individual"), in the order the site should list them. Drag to reorder.',
        components: {
          RowLabel: './components/RecordCategoryRowLabel.tsx#RecordCategoryRowLabel',
        },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Record',
              admin: { width: '60%', placeholder: 'e.g. 18 Holes, Individual' },
            },
            {
              name: 'betterWhen',
              type: 'select',
              label: 'Check marks',
              defaultValue: 'none',
              admin: {
                width: '40%',
                description:
                  'Optional — lets the Record check catch a "Broken" mark that doesn\'t actually beat the record.',
              },
              options: BETTER_WHEN.map((option) => ({ ...option })),
            },
          ],
        },
        {
          name: 'entries',
          type: 'array',
          label: 'History',
          labels: { singular: 'Entry', plural: 'Entries' },
          admin: {
            initCollapsed: true,
            description:
              'Every time this record was set, broken, or tied — in any order; the site sorts by date.',
            components: {
              RowLabel: './components/RecordEntryRowLabel.tsx#RecordEntryRowLabel',
            },
          },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'status',
                  type: 'select',
                  required: true,
                  defaultValue: 'broken',
                  admin: { width: '25%' },
                  options: STATUSES.map((option) => ({ ...option })),
                },
                {
                  name: 'mark',
                  type: 'text',
                  required: true,
                  admin: { width: '35%', placeholder: 'e.g. 69 (-3), 4:32.10, 45\' 6"' },
                },
                {
                  name: 'date',
                  type: 'text',
                  required: true,
                  admin: { width: '40%', placeholder: '9/5/2024, Sept 2024, 1987, or 1987-88' },
                  validate: (value: unknown) =>
                    value && parseRecordDate(value) ? true : DATE_HELP,
                },
              ],
            },
            {
              name: 'holders',
              type: 'array',
              label: 'Held by',
              labels: { singular: 'Athlete', plural: 'Athletes' },
              minRows: 1,
              admin: {
                description: 'One row per athlete — a team record lists every member.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'name',
                      type: 'text',
                      required: true,
                      admin: { width: '65%' },
                    },
                    {
                      name: 'classOf',
                      type: 'number',
                      label: 'Class of',
                      min: 1900,
                      max: 2100,
                      admin: {
                        width: '35%',
                        placeholder: 'e.g. 2027',
                        step: 1,
                      },
                    },
                  ],
                },
              ],
            },
            {
              name: 'notes',
              type: 'textarea',
              admin: {
                rows: 2,
                description: 'Optional — the course or venue, the meet, anything worth noting.',
              },
            },
          ],
        },
      ],
    },
  ],
}
