'use client'

import React from 'react'

// Sits under an award season's "Paste from the spreadsheet" box
// (AwardSeasons.ts): a link to the blank CSV template plus what each column
// accepts, so editors don't have to remember the format between seasons.
// Mirrors parseHonor/parseGrade/matchSport in lib/awards.ts.
const COLUMNS: { name: string; accepts: string }[] = [
  { name: 'Name', accepts: "The athlete's (or coach's) full name, e.g. Aaron Vandervort" },
  {
    name: 'Grade',
    accepts: 'Freshman, Sophomore, Junior, Senior — or Fr, So, Jr, Sr, 9–12. Blank for coaches.',
  },
  {
    name: 'Award',
    accepts:
      'Player of the Year, Coach of the Year, First Team, Second Team, Honorable Mention — or POY, 1st, 2nd, HM',
  },
  {
    name: 'Sport',
    accepts:
      'Any sport name in the CMS, e.g. Boys Basketball. Add Boys/Girls for co-ed sports: "Girls Swim and Dive", "Boys Track".',
  },
]

export function AwardPasteHelp() {
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
        <a href="/api/award-seasons/template.csv" download style={{ fontWeight: 600 }}>
          Download the blank template (CSV)
        </a>{' '}
        — open it in Excel or Google Sheets, fill in one row per award, then select the rows and
        paste them above. Copying straight out of the old awards spreadsheet works too, as long as
        the columns are in this order:
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
