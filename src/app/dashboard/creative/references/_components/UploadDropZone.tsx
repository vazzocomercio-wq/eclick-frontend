'use client'

/**
 * Drag-drop area pra upload múltiplo. Valida tipo (JPG/PNG/WebP) e size <=10MB.
 * Reporta erros inline embaixo da zona — não bloqueia uploads que passaram.
 *
 * O fluxo de upload signed-URL fica na page.tsx (handleFilesUpload). Esse
 * componente só captura os File[] e despacha.
 */

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloud, AlertTriangle } from 'lucide-react'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
type AcceptedMime = (typeof ACCEPTED_MIME)[number]

function isAccepted(mime: string): mime is AcceptedMime {
  return (ACCEPTED_MIME as readonly string[]).includes(mime)
}

export default function UploadDropZone({
  onFilesAccepted, inputRef,
}: {
  onFilesAccepted: (files: File[]) => void
  /** Permite acionar o seletor de fora (botões "Subir imagens"). */
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const t = useTranslations('creative.references')
  const internalRef = useRef<HTMLInputElement>(null)
  const fileInput   = inputRef ?? internalRef
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors]     = useState<string[]>([])

  const validateAndDispatch = (raw: FileList | File[]) => {
    const arr = Array.from(raw)
    const ok: File[] = []
    const bad: string[] = []
    for (const f of arr) {
      if (!isAccepted(f.type)) {
        bad.push(t('uploadTypeUnsupported', { name: f.name, type: f.type || t('uploadTypeUnknown') }))
        continue
      }
      if (f.size > MAX_BYTES) {
        bad.push(t('uploadTooLarge', { name: f.name, size: (f.size / 1024 / 1024).toFixed(1) }))
        continue
      }
      ok.push(f)
    }
    setErrors(bad)
    if (ok.length > 0) onFilesAccepted(ok)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndDispatch(e.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click() }}
        onDragOver={e => { e.preventDefault(); if (!dragging) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-colors',
          dragging
            ? 'border-cyan-400 bg-cyan-400/10'
            : 'border-zinc-700 bg-zinc-900/30 hover:border-cyan-500/50 hover:bg-zinc-900/50',
        ].join(' ')}
      >
        <UploadCloud size={26} className={dragging ? 'text-cyan-300' : 'text-zinc-400'} />
        <p className="text-sm font-medium text-zinc-200">
          {t('dropTitle')}
        </p>
        <p className="text-[11px] text-zinc-500">
          {t('dropSubtitle')}
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_MIME.join(',')}
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files.length > 0) {
              validateAndDispatch(e.target.files)
            }
            // Reset pra permitir re-upload do mesmo arquivo
            e.target.value = ''
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-center gap-2 text-red-300 text-xs font-medium mb-1.5">
            <AlertTriangle size={12} />
            {t('filesIgnored', { count: errors.length })}
          </div>
          <ul className="space-y-0.5 text-[11px] text-red-200/90">
            {errors.map((m, i) => <li key={i}>· {m}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
