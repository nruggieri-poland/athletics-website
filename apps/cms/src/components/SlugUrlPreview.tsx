'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { CopyToClipboard } from '@payloadcms/ui/elements/CopyToClipboard'

// Renders below a collection's `slug` field — live full URL, updating on
// every keystroke, with a one-click copy button (Payload's own
// CopyToClipboard, same one used elsewhere in the admin). `prefix` is
// baked in per collection (see Articles.ts/SpecialPages.ts) rather than
// read from anywhere dynamic, since each collection only ever publishes
// under one fixed path.
export function SlugUrlPreview({ prefix }: { prefix: string }) {
  const slug = useFormFields(([fields]) => fields?.slug?.value) as string | undefined
  if (!slug) return null

  const url = `${prefix}${slug}`

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '-0.75rem',
        marginBottom: '1.5rem',
        fontSize: '13px',
        color: 'var(--theme-elevation-500)',
      }}
    >
      <span>{url}</span>
      <CopyToClipboard value={url} />
    </div>
  )
}
