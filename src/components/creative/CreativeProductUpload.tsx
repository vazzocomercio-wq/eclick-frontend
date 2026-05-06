'use client'

import { useState, useRef, useCallback } from 'react'
import { ImageIcon, Loader2, Upload, X, AlertTriangle } from 'lucide-react'
import { uploadProductImage, getMyOrgId } from './api'

interface UploadResult {
  storage_path: string
  signed_url:   string
  preview_url:  string  // pode ser igual ao signed_url
}

interface Props {
  value:    UploadResult | null
  onChange: (result: UploadResult | null) => void
  disabled?: boolean
}

const MAX_SIZE_MB = 10
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export default function CreativeProductUpload({ value, onChange, disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [dragOver, setDragOver]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError('Formato não suportado — use JPG, PNG ou WebP')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Arquivo muito grande — máximo ${MAX_SIZE_MB}MB`)
      return
    }

    setUploading(true)
    try {
      const orgId = await getMyOrgId()
      if (!orgId) throw new Error('organização não encontrada — refaça login')

      const result = await uploadProductImage(orgId, file)
      onChange({
        storage_path: result.storage_path,
        signed_url:   result.signed_url,
        preview_url:  result.signed_url,
      })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }, [onChange])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }, [handleFile, disabled, uploading])

  if (value) {
    return (
      <div className="relative w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <img
            src={value.preview_url}
            alt="Produto"
            className="w-full aspect-square object-contain bg-zinc-900"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors"
              title="Remover"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-zinc-500 truncate" title={value.storage_path}>
          📁 {value.storage_path}
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer',
          'bg-zinc-950 hover:bg-zinc-900',
          dragOver ? 'border-cyan-400 bg-cyan-400/5' : 'border-zinc-800',
          (disabled || uploading) && 'pointer-events-none opacity-50',
        ].join(' ')}
      >
        {uploading ? (
          <>
            <Loader2 size={36} className="animate-spin text-cyan-400" />
            <p className="text-sm text-zinc-300">Enviando…</p>
          </>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
              <ImageIcon size={32} className="text-cyan-400" />
            </div>
            <div className="text-center px-6">
              <p className="text-sm text-zinc-200 font-medium">Arraste a imagem aqui</p>
              <p className="text-[11px] text-zinc-500 mt-1">ou clique pra selecionar</p>
              <p className="text-[10px] text-zinc-600 mt-2">JPG/PNG/WebP · até {MAX_SIZE_MB}MB</p>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />

      {error && (
        <div className="mt-2 flex items-start gap-2 text-[12px] text-red-400">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
