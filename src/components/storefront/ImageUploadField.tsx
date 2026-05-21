'use client'

/**
 * ImageUploadField — input de imagem com upload direto pro bucket
 * `storefront-assets` via POST /store/config/design/upload-asset.
 *
 * 2 modos: URL (input texto) e Upload (file picker → downscale → base64
 * → endpoint → recebe URL pública). Preview da imagem atual quando ha
 * value.
 *
 * Reusavel em qualquer form do dashboard (Config da Loja, Designer,
 * Páginas Customizadas, etc.) — basta `value` + `onChange`.
 */

import { useState, useRef } from 'react'
import { Upload, Link as LinkIcon, X, Loader2, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Props {
  value:        string
  onChange:     (url: string) => void
  /** Placeholder do input de URL. */
  placeholder?: string
  /** Largura max do preview (default 200px — bom pra logo). */
  previewMaxWidth?: number
  /** Largura max da imagem após downscale (default 1280px). */
  downscaleMaxWidth?: number
  /** Aceita só imagens por default. */
  accept?: string
}

export function ImageUploadField({
  value, onChange, placeholder,
  previewMaxWidth = 200,
  downscaleMaxWidth = 1280,
  accept = 'image/*',
}: Props) {
  const [mode, setMode] = useState<'url' | 'upload'>('upload')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)
  const inputRef        = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setBusy(true); setErr(null)
    try {
      const b64 = await downscaleImage(file, downscaleMaxWidth)
      const comma = b64.indexOf(',')
      const pureB64 = comma >= 0 ? b64.slice(comma + 1) : b64

      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch(`${BACKEND}/store/config/design/upload-asset`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ imageBase64: pureB64, imageMimeType: file.type || 'image/jpeg' }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        throw new Error(e?.message ?? `HTTP ${res.status}`)
      }
      const { url } = await res.json()
      onChange(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha no upload.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {/* Preview da imagem atual */}
      {value && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview"
            style={{
              maxWidth: previewMaxWidth, maxHeight: 120,
              border: '1px solid #27272a', borderRadius: 6,
              background: '#0a0a0e', display: 'block',
              objectFit: 'contain',
            }} />
          <button type="button" onClick={() => onChange('')}
            aria-label="Remover imagem"
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 24, height: 24, padding: 0,
              background: 'rgba(0,0,0,0.7)', color: '#fafafa',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        <TabBtn active={mode === 'upload'} onClick={() => setMode('upload')} icon={<Upload size={11} />} label="Enviar arquivo" />
        <TabBtn active={mode === 'url'}    onClick={() => setMode('url')}    icon={<LinkIcon size={11} />} label="Colar URL" />
      </div>

      {mode === 'upload' && (
        <label
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', minHeight: 56,
            background: 'transparent',
            border: `1px dashed ${busy ? '#00E5FF' : '#3f3f46'}`,
            borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
            color: busy ? '#00E5FF' : '#a1a1aa',
            fontSize: 13,
          }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? 'Enviando…' : 'Clique pra escolher uma imagem'}
          <input
            ref={inputRef}
            type="file" accept={accept} className="hidden" disabled={busy}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }} />
        </label>
      )}

      {mode === 'url' && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'https://…'}
          style={{
            width: '100%', padding: '10px 12px', minHeight: 44,
            background: '#0a0a0e', color: '#fafafa',
            border: '1px solid #27272a', borderRadius: 6,
            fontSize: 13, fontFamily: 'monospace',
          }}
        />
      )}

      {err && (
        <p className="text-xs" style={{ color: '#f87171' }}>⚠ {err}</p>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        flex: 1, padding: '8px 10px', minHeight: 36,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: active ? 'rgba(0,229,255,0.05)' : 'transparent',
        border: `1px solid ${active ? 'rgba(0,229,255,0.5)' : '#27272a'}`,
        color: active ? '#00E5FF' : '#a1a1aa',
        borderRadius: 6, cursor: 'pointer',
        fontSize: 12,
      }}>
      {icon} {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Downscale local pra reduzir tamanho do upload (canvas)
// ─────────────────────────────────────────────────────────────────────────

async function downscaleImage(file: File, maxWidth: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'))
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onerror = () => reject(new Error('Imagem inválida.'))
      img.onload = () => {
        try {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('Canvas não suportado.')
          ctx.drawImage(img, 0, 0, w, h)
          // PNG pra preservar transparência da logo. JPEG pra fotos.
          const isPng = file.type === 'image/png' || /alpha|transparen/i.test(file.name)
          const out = isPng
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', 0.88)
          resolve(out)
        } catch (e) { reject(e) }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
