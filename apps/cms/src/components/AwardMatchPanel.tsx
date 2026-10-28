'use client'

import React, { useEffect, useState } from 'react'
import { Button, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'

// "Card images" in an award season's sidebar (AwardSeasons.ts), under the
// "Card images folder" picker. With a folder chosen, saving already attaches
// missing images; "Refresh mapping" re-matches every card from the folder
// (endpoints/matchCards.ts → lib/cardMatching.ts) and reports what it did.
// Without a folder it searches all of Media instead. The page reloads after
// a match so attached images show in the Awards list; the report is kept in
// sessionStorage across that reload.

interface MatchReport {
  matched: { name: string; sport: string; file: string }[]
  missing: string[]
  unclear: string[]
}

const storageKey = (id: string | number) => `award-card-match-${id}`

export function AwardMatchPanel() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const hasFolder = useFormFields(([fields]) => Boolean(fields?.cardFolder?.value))
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<MatchReport | null>(null)

  useEffect(() => {
    if (!id) return
    try {
      const saved = sessionStorage.getItem(storageKey(id))
      if (saved) {
        setReport(JSON.parse(saved))
        sessionStorage.removeItem(storageKey(id))
      }
    } catch {
      // Storage unavailable — the report just won't survive the reload.
    }
  }, [id])

  if (!id) {
    return (
      <div style={panelStyle}>
        <p style={titleStyle}>Card images</p>
        <p style={noteStyle}>Save this season first, then match its card images from Media.</p>
      </div>
    )
  }

  async function match() {
    setRunning(true)
    setError('')
    try {
      const response = await fetch(`/api/award-seasons/${id}/match-cards`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(body.error || body.errors?.[0]?.message || 'Matching failed.')
      if ((body as MatchReport).matched.length > 0) {
        try {
          sessionStorage.setItem(storageKey(id!), JSON.stringify(body))
        } catch {
          // Fine — see the useEffect above.
        }
        window.location.reload()
        return
      }
      setReport(body)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={panelStyle}>
      <p style={titleStyle}>Card images</p>
      <p style={noteStyle}>
        Name each file like <code>2026-fall-angelo-rinaldi.png</code>, adding the sport for an
        athlete with two awards: <code>2026-fall-salvi-carramusa-football.png</code>.{' '}
        {hasFolder
          ? 'Saving attaches any missing images from the folder above. Refresh after uploading late or corrected cards.'
          : 'Pick the Media folder above (recommended), or match against all of Media.'}
      </p>
      {modified && (
        <p style={{ ...noteStyle, color: 'var(--theme-warning-750, var(--theme-warning-500))' }}>
          Save your changes first — matching works from the last save.
        </p>
      )}
      <Button
        buttonStyle="primary"
        size="small"
        margin={false}
        disabled={running || modified}
        onClick={match}
      >
        {running ? 'Matching…' : hasFolder ? 'Refresh mapping' : 'Match card images'}
      </Button>

      {error && (
        <p style={{ ...noteStyle, marginTop: '0.75rem', color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}

      {report && (
        <div style={{ marginTop: '0.9rem', fontSize: '12.5px', lineHeight: 1.45 }}>
          <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>
            {report.matched.length > 0
              ? `Attached ${report.matched.length} card image${report.matched.length === 1 ? '' : 's'}.`
              : 'No new matches found.'}
          </p>
          {report.missing.length > 0 && (
            <details open={report.missing.length <= 8} style={{ marginBottom: '0.5rem' }}>
              <summary style={{ cursor: 'pointer' }}>
                {report.missing.length} card{report.missing.length === 1 ? '' : 's'} still without
                an image
              </summary>
              <ul style={listStyle}>
                {report.missing.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          )}
          {report.unclear.length > 0 && (
            <details open style={{ marginBottom: '0.5rem' }}>
              <summary style={{ cursor: 'pointer' }}>
                {report.unclear.length} file{report.unclear.length === 1 ? '' : 's'} need the sport
                in the name
              </summary>
              <p style={{ ...noteStyle, margin: '0.35rem 0' }}>
                These athletes have two awards — add the sport (or the award) to the end of the file
                name so it's clear which card it is.
              </p>
              <ul style={listStyle}>
                {report.unclear.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </details>
          )}
          {report.missing.length === 0 && report.unclear.length === 0 && (
            <p style={noteStyle}>Every card has an image.</p>
          )}
        </div>
      )}
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1rem',
  borderRadius: 'var(--style-radius-m, 6px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
}
const titleStyle: React.CSSProperties = { margin: '0 0 0.35rem', fontWeight: 700, fontSize: '14px' }
const noteStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '12.5px',
  lineHeight: 1.45,
  color: 'var(--theme-elevation-600)',
}
const listStyle: React.CSSProperties = { margin: '0.35rem 0 0', paddingLeft: '1.1rem' }
