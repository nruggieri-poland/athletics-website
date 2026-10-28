import type { PayloadHandler } from 'payload'
import { idOf, matchCardImages, type MatchableAward } from '../lib/cardMatching.ts'

// POST /api/award-seasons/:id/match-cards — the season editor's "Refresh
// mapping" button (components/AwardMatchPanel.tsx). Re-matches every card's
// image from the season's card images folder (or all of Media if none is
// chosen) — see lib/cardMatching.ts — so corrected re-uploads replace older
// versions; cards with no matching file keep what they have.
//
// Saves the season as it's stored — published seasons stay published (and
// go live with their new images), drafts stay drafts — and reports what it
// did, so the editor can see which cards still need an image and why.

export const matchCardsHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Sign in to the CMS to match card images.' }, { status: 401 })
  }

  const id = String(req.routeParams?.id)
  let season
  try {
    season = await req.payload.findByID({
      collection: 'award-seasons',
      id,
      depth: 0,
      draft: true,
      req,
    })
  } catch {
    return Response.json({ error: 'That award season no longer exists.' }, { status: 404 })
  }

  if (!season.awards?.length) {
    return Response.json(
      { error: 'This season has no cards yet — paste the list first.' },
      { status: 400 },
    )
  }

  const { awards, report } = await matchCardImages(req, {
    schoolYear: String(season.schoolYear),
    season: String(season.season),
    awards: season.awards as MatchableAward[],
    folderId: idOf(season.cardFolder as never),
  })

  if (report.matched.length > 0) {
    await req.payload.update({
      collection: 'award-seasons',
      id,
      data: { awards } as never,
      draft: season._status !== 'published',
      req,
    })
  }

  return Response.json(report)
}
