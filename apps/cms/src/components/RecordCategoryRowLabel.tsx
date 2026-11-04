'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

// Collapsed-row label for a record book's records (RecordBooks.ts):
// "18 Holes, Individual · 2 entries".
export function RecordCategoryRowLabel() {
  const { data, rowNumber } = useRowLabel<{ name?: string; entries?: unknown[] }>()
  const count = Array.isArray(data?.entries) ? data.entries.length : 0
  return (
    <span>
      {data?.name || `Record ${(rowNumber ?? 0) + 1}`}
      <span style={{ color: 'var(--theme-elevation-500)' }}>
        {' '}
        · {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </span>
  )
}
