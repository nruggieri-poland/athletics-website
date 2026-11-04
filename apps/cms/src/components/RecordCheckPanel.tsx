'use client'

import React from 'react'
import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'

// "Record check" in a record book's sidebar (RecordBooks.ts): who holds each
// record now, as worked out on the last save (lib/schoolRecords.ts →
// `currentRecords`), and any entries worth a second look. The warnings never
// block saving — the status picked on each entry always wins.

interface Holder {
  name: string
  classOf?: number
}
interface CurrentRecord {
  category: string
  mark: string
  performances: { status: string; holders: Holder[]; date: string }[]
  warnings: string[]
}

const holderText = (holder: Holder) =>
  holder.classOf ? `${holder.name} ’${String(holder.classOf).slice(2)}` : holder.name

export function RecordCheckPanel() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const current = useFormFields(
    ([fields]) => fields?.currentRecords?.value as CurrentRecord[] | null | undefined,
  )
  const isPublic = useFormFields(([fields]) => Boolean(fields?.isPublic?.value))

  const records = Array.isArray(current) ? current : []
  const warningCount = records.reduce((sum, record) => sum + record.warnings.length, 0)

  return (
    <div style={panelStyle}>
      <p style={titleStyle}>Record check</p>
      {!id || records.length === 0 ? (
        <p style={noteStyle}>
          Add records below (or paste them into Quick fill) and save — the current holder of each
          record shows here.
        </p>
      ) : (
        <>
          <p style={noteStyle}>
            {isPublic
              ? 'This is what the website shows.'
              : 'Private — this is what the website would show once "Show on the website" is checked.'}
          </p>
          {modified && (
            <p
              style={{ ...noteStyle, color: 'var(--theme-warning-750, var(--theme-warning-500))' }}
            >
              Save to update — this reflects the last save.
            </p>
          )}
          <p
            style={{
              ...noteStyle,
              fontWeight: 600,
              color: warningCount
                ? 'var(--theme-warning-750, var(--theme-warning-500))'
                : undefined,
            }}
          >
            {warningCount
              ? `${warningCount} thing${warningCount === 1 ? '' : 's'} worth a second look`
              : 'Everything looks consistent.'}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {records.map((record) => (
              <li
                key={record.category}
                style={{
                  padding: '0.55rem 0',
                  borderTop: '1px solid var(--theme-elevation-150)',
                  fontSize: '12.5px',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 600 }}>{record.category}</div>
                {record.mark ? (
                  <div>
                    <strong>{record.mark}</strong>
                    {record.performances.length > 1 && ' (tied)'} —{' '}
                    {record.performances
                      .map(
                        (performance) =>
                          `${performance.holders.map(holderText).join(', ')} (${performance.date})`,
                      )
                      .join('; ')}
                  </div>
                ) : null}
                {record.warnings.map((warning) => (
                  <div
                    key={warning}
                    style={{
                      marginTop: '0.3rem',
                      color: 'var(--theme-warning-750, var(--theme-warning-500))',
                    }}
                  >
                    ⚠ {warning}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </>
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
const titleStyle: React.CSSProperties = {
  margin: '0 0 0.35rem',
  fontWeight: 700,
  fontSize: '14px',
}
const noteStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '12.5px',
  lineHeight: 1.45,
  color: 'var(--theme-elevation-600)',
}
