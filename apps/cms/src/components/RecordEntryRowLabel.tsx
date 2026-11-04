'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

const STATUS_LABELS: Record<string, string> = {
  original: 'Original',
  broken: 'Broken',
  tied: 'Tied',
}

// Collapsed-row label for a record's history (RecordBooks.ts):
// "Tied · 69 (-3) · Matthew Morrone · 10/12/2026".
export function RecordEntryRowLabel() {
  const { data, rowNumber } = useRowLabel<{
    status?: string
    mark?: string
    date?: string
    holders?: { name?: string }[]
  }>()
  const names = (data?.holders ?? []).map((holder) => holder?.name).filter(Boolean)
  const who = names.length > 2 ? `${names[0]} +${names.length - 1}` : names.join(' & ')
  const parts = [
    data?.status ? STATUS_LABELS[data.status] : undefined,
    data?.mark,
    who,
    data?.date,
  ].filter(Boolean)
  return <span>{parts.length ? parts.join(' · ') : `Entry ${(rowNumber ?? 0) + 1}`}</span>
}
