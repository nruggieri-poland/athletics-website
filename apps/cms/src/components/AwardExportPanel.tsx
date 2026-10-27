'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'

// "Instagram graphics" in an award season's sidebar (AwardSeasons.ts): one
// click draws every card as Instagram feed posts and/or stories and
// downloads them as a zip, plus a single-card preview to check the look
// first. Talks to endpoints/instagramExport.ts — a whole season runs as a
// background job, so this polls its progress and starts the download when
// it's done.

type Format = 'both' | 'feed' | 'story'

const EXPORTS: { format: Format; label: string }[] = [
  { format: 'both', label: 'Download all (posts + stories)' },
  { format: 'feed', label: 'Feed posts only (4:5)' },
  { format: 'story', label: 'Stories only (9:16)' },
]

type Progress =
  | { state: 'idle' }
  | { state: 'running'; done: number; total: number }
  | { state: 'error'; message: string }
  | { state: 'done' }

async function errorFrom(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return body.error || body.errors?.[0]?.message || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export function AwardExportPanel() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const [progress, setProgress] = useState<Progress>({ state: 'idle' })
  const [previewAward, setPreviewAward] = useState('')
  const [previewFormat, setPreviewFormat] = useState<'feed' | 'story'>('feed')
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  // The season's cards as currently listed in the form, for the preview
  // picker: [{ id, name }] from the awards array's rows.
  const cards = useFormFields(([fields]) => {
    const rows: { id: string; name: string }[] = []
    for (const [path, field] of Object.entries(fields)) {
      const match = /^awards\.(\d+)\.athleteName$/.exec(path)
      if (!match || !field?.value) continue
      const rowId = fields[`awards.${match[1]}.id`]?.value
      if (rowId) rows[Number(match[1])] = { id: String(rowId), name: String(field.value) }
    }
    return rows.filter(Boolean)
  })
  const cardOptions = useMemo(
    () => [...cards].sort((a, b) => a.name.localeCompare(b.name)),
    [cards],
  )

  if (!id) {
    return (
      <div style={panelStyle}>
        <p style={titleStyle}>Instagram graphics</p>
        <p style={noteStyle}>
          Save this season first — then you can download its cards as Instagram posts and stories.
        </p>
      </div>
    )
  }

  const base = `/api/award-seasons`

  async function runExport(format: Format) {
    setProgress({ state: 'running', done: 0, total: 0 })
    try {
      const started = await fetch(`${base}/${id}/instagram/exports?format=${format}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!started.ok) throw new Error(await errorFrom(started))
      const { jobId, total } = (await started.json()) as { jobId: string; total: number }
      setProgress({ state: 'running', done: 0, total })

      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (cancelled.current) return
        const response = await fetch(`${base}/instagram/exports/${jobId}`, {
          credentials: 'include',
        })
        if (!response.ok) throw new Error(await errorFrom(response))
        const status = (await response.json()) as {
          status: string
          done: number
          total: number
          error?: string
        }
        if (status.status === 'error')
          throw new Error(status.error || 'Drawing the graphics failed.')
        setProgress({ state: 'running', done: status.done, total: status.total })
        if (status.status === 'done') break
      }

      // A plain link, so the browser streams the zip straight to disk.
      const link = document.createElement('a')
      link.href = `${base}/instagram/exports/${jobId}/download`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setProgress({ state: 'done' })
    } catch (error) {
      setProgress({ state: 'error', message: (error as Error).message })
    }
  }

  const running = progress.state === 'running'
  const percent = running && progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div style={panelStyle}>
      <p style={titleStyle}>Instagram graphics</p>
      <p style={noteStyle}>
        Every card as a high-resolution image (2160px wide) — feed posts at 4:5, stories at 9:16 —
        in one zip. Uses the last saved version, so drafts work too.
      </p>
      {modified && (
        <p style={{ ...noteStyle, color: 'var(--theme-warning-750, var(--theme-warning-500))' }}>
          You have unsaved changes — save first so the graphics include them.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {EXPORTS.map(({ format, label }, i) => (
          <Button
            key={format}
            buttonStyle={i === 0 ? 'primary' : 'secondary'}
            size="small"
            margin={false}
            disabled={running}
            onClick={() => runExport(format)}
          >
            {label}
          </Button>
        ))}
      </div>

      {running && (
        <div style={{ marginTop: '0.75rem' }} aria-live="polite">
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: 'var(--theme-elevation-150)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(percent, 4)}%`,
                height: '100%',
                background: 'var(--theme-success-500)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p style={{ ...noteStyle, marginTop: '0.4rem' }}>
            {progress.total ? `Drawing ${progress.done} of ${progress.total}…` : 'Getting started…'}
          </p>
        </div>
      )}
      {progress.state === 'done' && (
        <p style={{ ...noteStyle, marginTop: '0.75rem' }}>Done — check your downloads.</p>
      )}
      {progress.state === 'error' && (
        <p style={{ ...noteStyle, marginTop: '0.75rem', color: 'var(--theme-error-500)' }}>
          {progress.message}
        </p>
      )}

      {cardOptions.length > 0 && (
        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--theme-elevation-150)',
          }}
        >
          <p style={{ ...noteStyle, fontWeight: 600, color: 'var(--theme-elevation-800)' }}>
            Preview one card
          </p>
          <select
            value={previewAward}
            onChange={(event) => setPreviewAward(event.target.value)}
            style={selectStyle}
            aria-label="Card to preview"
          >
            <option value="">Choose an athlete…</option>
            {cardOptions.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <select
              value={previewFormat}
              onChange={(event) => setPreviewFormat(event.target.value as 'feed' | 'story')}
              style={{ ...selectStyle, flex: 1 }}
              aria-label="Preview size"
            >
              <option value="feed">Feed post</option>
              <option value="story">Story</option>
            </select>
            <Button
              buttonStyle="secondary"
              size="small"
              margin={false}
              disabled={!previewAward}
              url={
                previewAward
                  ? `${base}/${id}/instagram?award=${previewAward}&format=${previewFormat}`
                  : undefined
              }
              newTab
              el={previewAward ? 'anchor' : 'button'}
            >
              Open
            </Button>
          </div>
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
const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--style-radius-s, 4px)',
  border: '1px solid var(--theme-elevation-200)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  color: 'var(--theme-elevation-800)',
  fontSize: '13px',
}
