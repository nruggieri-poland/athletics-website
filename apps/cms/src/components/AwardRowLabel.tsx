'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

const HONOR_LABELS: Record<string, string> = {
  'player-of-the-year': 'Player of the Year',
  'coach-of-the-year': 'Coach of the Year',
  'first-team': 'First Team',
  'second-team': 'Second Team',
  'honorable-mention': 'Honorable Mention',
}

// Collapsed-row label for an award season's cards (AwardSeasons.ts) —
// "Aaron Vandervort · Player of the Year · Junior", plus a "needs photo"
// flag, so a 40-row season can be scanned and finished without opening
// every row.
export function AwardRowLabel() {
  const { data, rowNumber } = useRowLabel<{
    athleteName?: string
    honor?: string
    honorTitle?: string
    grade?: string
    photo?: unknown
  }>()

  const parts = [
    data?.athleteName || `Award ${(rowNumber ?? 0) + 1}`,
    data?.honorTitle || (data?.honor ? HONOR_LABELS[data.honor] : undefined),
    data?.honor === 'coach-of-the-year' ? undefined : data?.grade,
  ].filter(Boolean)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>{parts.join(' · ')}</span>
      {!data?.photo && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: '999px',
            background: 'var(--theme-warning-100)',
            color: 'var(--theme-warning-800)',
          }}
        >
          needs card image
        </span>
      )}
    </span>
  )
}
