'use client'

import React from 'react'

// Sits under a record book's "Paste from the spreadsheet" box
// (RecordBooks.ts): a link to the blank CSV template plus what each column
// accepts. Mirrors parseRecordRows in lib/schoolRecords.ts.
const COLUMNS: { name: string; accepts: string }[] = [
  {
    name: 'Status',
    accepts:
      'Original, Broken or Tied. Leave blank and the first entry in each record becomes Original, the rest Broken.',
  },
  {
    name: 'Record',
    accepts: 'The record’s name, e.g. 18 Holes, Individual. New names add a record.',
  },
  {
    name: 'Holder(s)',
    accepts:
      "One name, or several separated by commas for a team record. Add a class year if you know it: Angelo Rinaldi '25 or Angelo Rinaldi (2025).",
  },
  {
    name: 'Mark',
    accepts: 'The score, time or distance as you want it shown, e.g. 69 (-3), 4:32.10.',
  },
  { name: 'Date', accepts: '9/5/2024, Sept 2024, a year (1987) or a season (1987-88).' },
  { name: 'Notes', accepts: 'Optional — the course or venue, the meet, anything else.' },
]

export function RecordPasteHelp() {
  return (
    <details
      style={{
        marginTop: '0.75rem',
        marginBottom: '1.25rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--style-radius-m, 6px)',
        background: 'var(--theme-elevation-50)',
        fontSize: '13px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        Spreadsheet format &amp; blank template
      </summary>
      <p style={{ margin: '0.75rem 0' }}>
        <a href="/api/record-books/template.csv" download style={{ fontWeight: 600 }}>
          Download the blank template (CSV)
        </a>{' '}
        — open it in Excel or Google Sheets, fill in one row per time a record was set, broken or
        tied, then select the rows and paste them above. The old &ldquo;Record History&rdquo; tab
        pastes straight in, as long as the columns are in this order:
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {COLUMNS.map((column, i) => (
            <tr key={column.name} style={{ borderTop: '1px solid var(--theme-elevation-150)' }}>
              <td
                style={{
                  padding: '6px 12px 6px 0',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  verticalAlign: 'top',
                }}
              >
                {String.fromCharCode(65 + i)} · {column.name}
              </td>
              <td style={{ padding: '6px 0', color: 'var(--theme-elevation-700)' }}>
                {column.accepts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
