import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, Payload } from 'payload'
import type { Opponent } from '../../../../packages/shared-types/src/payload-types.ts'
import { scheduleRebuild } from './rebuildWeb.ts'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function variantsFor(opponent: Pick<Opponent, 'name' | 'aliases'>): string[] {
  return [opponent.name, ...(opponent.aliases ?? []).map((entry) => entry.alias)].filter(Boolean)
}

// Opponents is small (low hundreds of schools) — a full-table scan per
// lookup is cheap and keeps this simple, no separate index/cache to keep
// in sync.
async function findLogoIdForName(payload: Payload, opponentName: string): Promise<number | undefined> {
  const target = normalize(opponentName)
  const { docs } = await payload.find({
    collection: 'opponents',
    limit: 1000,
    depth: 0,
  })
  const match = docs.find((opponent) => variantsFor(opponent).some((variant) => normalize(variant) === target))
  const logo = match?.logo
  return typeof logo === 'number' ? logo : undefined
}

// Attached to Games' beforeChange. Only fills in a missing logo — never
// overwrites one a person or the Opponents-side hook below already set,
// so a manually-picked logo on an unusual game is never silently replaced.
export const matchOpponentLogoOnGame: CollectionBeforeChangeHook = async ({ data, req }) => {
  if (!data.opponentName || data.opponentLogo) return data

  const logoId = await findLogoIdForName(req.payload, data.opponentName)
  if (logoId) data.opponentLogo = logoId
  return data
}

// Attached to Opponents' afterChange. Games only get matched against an
// Opponent's logo once, at save time (see matchOpponentLogoOnGame above) —
// without this, fixing a wrong logo (or adding one that was missing) on the
// Opponent record itself would never reach games that already exist,
// only ones created afterward.
export const propagateOpponentLogoToGames: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!doc.logo) return doc

  const variants = variantsFor(doc as Opponent).map(normalize)
  if (variants.length === 0) return doc

  const { docs: games } = await req.payload.find({
    collection: 'games',
    where: { opponentName: { exists: true } },
    limit: 5000,
    depth: 0,
  })
  const matchingIds = games
    .filter((game) => typeof game.opponentName === 'string' && variants.includes(normalize(game.opponentName)))
    .map((game) => game.id)

  if (matchingIds.length > 0) {
    await req.payload.update({
      collection: 'games',
      where: { id: { in: matchingIds } },
      data: { opponentLogo: doc.logo },
    })
    scheduleRebuild()
  }

  return doc
}
