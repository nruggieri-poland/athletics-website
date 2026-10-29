import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { matchCardsHandler } from '../endpoints/matchCards.ts'
import { matchCardImages } from '../lib/cardMatching.ts'
import {
  afterChangeTriggerRebuild,
  afterDeleteTriggerRebuild,
} from '../hooks/scheduleRebuildHooks.ts'
import { GRADES, HONORS, TEMPLATE_CSV, parseAwardRows, type SportOption } from '../lib/awards.ts'

// One NE8 All-Conference season — e.g. "2025-2026 Winter" — and every award
// card in it. Publishes to polandathletics.com/ne8/awards/<school-year>/<season>,
// and rolls up into the /ne8/awards hub and the per-school-year page.
//
// The cards live in one `awards` array rather than a collection of their
// own so a whole season (~40 cards) is built, reviewed, and published from
// one screen. The site orders cards itself (honor, then sport, then last
// name), so the order of rows here doesn't matter.
//
// "Quick fill" is the fast path for that: paste rows out of the awards
// spreadsheet to add cards in bulk (consumed on save — see applyQuickFill;
// it's an input, not stored data). Card images are uploaded to the regular
// Media library; pick the season's folder in the sidebar and each save
// attaches any missing card images by filename, with a "Refresh mapping"
// button to re-match everything (lib/cardMatching.ts).

type AwardRow = {
  athleteName?: string
  honor?: string
  grade?: string
  sport?: number | string | { id: number | string }
  division?: string
  photo?: number | string | { id: number | string } | null
  [key: string]: unknown
}

const SEASONS = ['Fall', 'Winter', 'Spring'] as const

// OHSAA school year (July 1 – June 30), matching apps/web/src/lib/payload.ts.
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

const applyQuickFill: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data

  const schoolYear = data.schoolYear ?? originalDoc?.schoolYear
  const season = data.season ?? originalDoc?.season
  if (schoolYear && season) {
    data.title = `${schoolYear} ${season}`
    data.slug = `${schoolYear}/${String(season).toLowerCase()}`

    // The slug's unique index would catch this too, but only as "slug is
    // invalid" on a read-only field the editor can't do anything about.
    // (APIError rather than ValidationError for the same reason as below.)
    const existing = await req.payload.find({
      collection: 'award-seasons',
      where: {
        slug: { equals: data.slug },
        ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
      },
      limit: 1,
      depth: 0,
      req,
    })
    if (existing.docs.length > 0) {
      throw new APIError(
        `${data.title} already exists — open that entry to add to it instead.`,
        400,
        null,
        true,
      )
    }
  }

  const pasted = typeof data.pasteList === 'string' ? data.pasteList.trim() : ''
  // Only work on the cards when this save carries them (an admin save always
  // does); a partial API update without `awards` is left alone.
  if (!pasted && !Array.isArray(data.awards)) return data
  const awards: AwardRow[] = [...((data.awards ?? originalDoc?.awards ?? []) as AwardRow[])]

  if (pasted) {
    const sports = await req.payload.find({ collection: 'sports', limit: 100, depth: 0, req })
    let rows
    try {
      rows = parseAwardRows(pasted, sports.docs as SportOption[], season)
    } catch (error) {
      // An APIError's message is shown word for word in the admin's save
      // toast; a ValidationError would only say "pasteList is invalid".
      throw new APIError((error as Error).message, 400, null, true)
    }
    for (const row of rows) {
      const duplicate = awards.some(
        (award) =>
          award.athleteName?.trim().toLowerCase() === row.athleteName.toLowerCase() &&
          award.honor === row.honor &&
          String(idOf(award.sport)) === String(row.sport),
      )
      if (!duplicate) awards.push({ ...row })
    }
    data.pasteList = ''
  }

  // With a card images folder chosen, every save fills in any card still
  // missing its image from that folder (never replacing one already there —
  // the sidebar's "Refresh mapping" button re-matches everything).
  const folderId = idOf('cardFolder' in data ? data.cardFolder : originalDoc?.cardFolder)
  if (
    folderId !== undefined &&
    schoolYear &&
    season &&
    awards.some((award) => !idOf(award.photo))
  ) {
    const matched = await matchCardImages(req, {
      schoolYear: String(schoolYear),
      season: String(season),
      awards,
      folderId,
      onlyMissing: true,
    })
    data.awards = matched.awards
    return data
  }

  data.awards = awards
  return data
}

export const AwardSeasons: CollectionConfig = {
  slug: 'award-seasons',
  labels: {
    singular: 'NE8 Award Season',
    plural: 'NE8 Award Seasons',
  },
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    group: 'NE8',
    description:
      'One entry per season (e.g. 2025-2026 Winter) holding all of its NE8 All-Conference award cards. Use "Quick fill" to paste the list from the awards spreadsheet and drop in all the finished card images at once. "Save Draft" while you build it, "Publish" to put it on the site, and "Unpublish" (in the ⋮ menu) to take it back down.',
  },
  defaultSort: '-slug',
  // Same Publish / Unpublish workflow as Articles and Special Pages. A
  // season that's never been published stays off the site entirely
  // (apps/web/src/lib/awards.ts only asks for _status = published), and
  // draft edits to a live season don't reach the site until it's
  // published again.
  versions: {
    drafts: true,
  },
  // /api/award-seasons/template.csv — the blank spreadsheet linked from the
  // paste box's help panel. Public like the rest of this collection's reads;
  // it's just a header row.
  endpoints: [
    {
      path: '/template.csv',
      method: 'get',
      handler: () =>
        new Response(TEMPLATE_CSV, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="ne8-awards-template.csv"',
          },
        }),
    },
    // Attaches card images from Media — see endpoints/matchCards.ts.
    { path: '/:id/match-cards', method: 'post', handler: matchCardsHandler },
  ],
  hooks: {
    beforeValidate: [applyQuickFill],
    afterChange: [afterChangeTriggerRebuild],
    afterDelete: [afterDeleteTriggerRebuild],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: { hidden: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'schoolYear',
          type: 'text',
          required: true,
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
        {
          name: 'season',
          type: 'select',
          required: true,
          admin: { width: '50%' },
          options: SEASONS.map((season) => ({ label: season, value: season })),
        },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Set from the school year and season when you save — there can only be one entry per season.',
        components: {
          afterInput: [
            {
              path: './components/SlugUrlPreview.tsx#SlugUrlPreview',
              clientProps: { prefix: 'polandathletics.com/ne8/awards/' },
            },
          ],
        },
      },
    },
    {
      name: 'cardFolder',
      type: 'relationship',
      relationTo: 'payload-folders',
      label: 'Card images folder',
      admin: {
        position: 'sidebar',
        description:
          "The Media folder holding this season's finished card images. Once chosen, saving attaches each card's image automatically.",
      },
    },
    {
      // Display-only (no stored value): the sidebar's "Refresh mapping"
      // button — see components/AwardMatchPanel.tsx.
      name: 'cardMatching',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: './components/AwardMatchPanel.tsx#AwardMatchPanel',
        },
      },
    },
    {
      name: 'intro',
      type: 'textarea',
      admin: {
        description:
          'Optional message at the top of the season page. Leave blank for an automatic one ("28 Bulldogs earned NE8 honors this Winter…").',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'coverImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            width: '50%',
            description:
              "Optional photo behind this season's tile and page header. Leave blank and the tile shows a fan of its first few cards.",
          },
        },
        {
          name: 'galleryUrl',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Optional link to the full photo gallery (e.g. a Google Photos album).',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Quick fill',
      admin: {
        initCollapsed: false,
        description:
          'Used up when you save — the cards it creates show up in Awards below. Then upload the finished card images to Media and click "Match card images" in the sidebar.',
      },
      fields: [
        {
          name: 'pasteList',
          type: 'textarea',
          label: 'Paste from the spreadsheet',
          admin: {
            rows: 6,
            placeholder: 'Aaron Vandervort\tJunior\tPlayer of the Year\tBoys Swim and Dive',
            description:
              'Copy rows straight out of the awards spreadsheet — columns in the order Name, Grade, Award, Sport (a header row is fine). Each row becomes a card. "Boys"/"Girls" in the sport column is kept, so "Girls Swim and Dive" works.',
            components: {
              afterInput: ['./components/AwardPasteHelp.tsx#AwardPasteHelp'],
            },
          },
        },
      ],
    },
    {
      name: 'awards',
      type: 'array',
      labels: {
        singular: 'Award',
        plural: 'Awards',
      },
      admin: {
        initCollapsed: true,
        description:
          "The order here doesn't matter — the site sorts cards by honor, then sport, then last name.",
        components: {
          RowLabel: './components/AwardRowLabel.tsx#AwardRowLabel',
        },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'athleteName',
              type: 'text',
              required: true,
              label: 'Name',
              admin: { width: '50%' },
            },
            {
              name: 'honor',
              type: 'select',
              required: true,
              defaultValue: 'first-team',
              admin: { width: '25%' },
              options: HONORS.map((honor) => ({ ...honor })),
            },
            {
              name: 'grade',
              type: 'select',
              admin: {
                width: '25%',
                condition: (_, siblingData) => siblingData?.honor !== 'coach-of-the-year',
              },
              options: GRADES.map((grade) => ({ ...grade })),
            },
          ],
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
              // Only this season's sports in the dropdown — a Winter season
              // can't accidentally get a Football card.
              filterOptions: ({ data }) =>
                data?.season ? { seasonType: { equals: data.season } } : true,
            },
            {
              name: 'division',
              type: 'select',
              admin: {
                width: '25%',
                description: 'For co-ed sports, e.g. Girls Swimming & Diving.',
              },
              options: [
                { label: 'Boys', value: 'Boys' },
                { label: 'Girls', value: 'Girls' },
              ],
            },
            {
              name: 'honorTitle',
              type: 'text',
              label: 'Custom award wording',
              admin: {
                width: '25%',
                description: 'Optional, e.g. "Offensive Player of the Year".',
              },
            },
          ],
        },
        {
          // Stored as `photo` (the field's original name) — it holds the
          // finished card artwork, which the site turns into a reflective
          // card (apps/web/src/components/awards/AwardCard.astro).
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
          label: 'Card image',
          admin: {
            description:
              'The finished card, designed in Photoshop: 1500 × 2100 px PNG — a trading card at 600 dpi — with anything outside the card shape left transparent. The site adds the tilt, glare and foil. Usually attached by "Match card images" in the sidebar.',
          },
        },
      ],
    },
  ],
}
