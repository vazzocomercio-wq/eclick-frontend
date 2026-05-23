'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, Check, X } from 'lucide-react'

/**
 * Captura de foto via getUserMedia (câmera traseira) → canvas → JPEG base64.
 * Fallback: <input type=file capture> quando a câmera não abre (permissão/iOS).
 * Faz downscale pra no máx 1280px no maior lado pra não estourar o upload.
 */
export function CameraCapture({
  onCapture,
  onCancel,
  label = 'Tirar foto',
}: {
  onCapture: (base64: string, mime: string) => void
  onCancel?: () => void
  label?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setReady(true)
      } catch {
        setErr('Não foi possível abrir a câmera. Use o botão para escolher uma foto.')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function downscale(source: HTMLVideoElement | HTMLImageElement, w: number, h: number): string {
    const max = 1280
    const scale = Math.min(1, max / Math.max(w, h))
    const cw = Math.round(w * scale), ch = Math.round(h * scale)
    const canvas = document.createElement('canvas')
    canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(source, 0, 0, cw, ch)
    return canvas.toDataURL('image/jpeg', 0.82)
  }

  function snap() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const dataUrl = downscale(v, v.videoWidth, v.videoHeight)
    setPreview(dataUrl)
    stopStream()
  }

  function confirm() {
    if (!preview) return
    const m = preview.match(/^data:(image\/[a-z]+);base64,/i)
    onCapture(preview, m?.[1] ?? 'image/jpeg')
  }

  function retake() {
    setPreview(null)
    setReady(false)
    setErr(null)
    // reabre a câmera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
        setReady(true)
      })
      .catch(() => setErr('Não foi possível abrir a câmera.'))
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => setPreview(downscale(img, img.width, img.height))
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl" style={{ background: '#000', aspectRatio: '4/3' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="prévia" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        )}
        {!ready && !preview && !err && (
          <div className="absolute inset-0 grid place-items-center text-sm" style={{ color: '#a1a1aa' }}>
            Abrindo câmera…
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(245,158,11,0.10)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)' }}>
          {err}
          <label className="mt-2 block">
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#18181b', color: '#fafafa' }}>
              <Camera size={16} /> Escolher foto
            </span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          </label>
        </div>
      )}

      <div className="flex gap-3">
        {preview ? (
          <>
            <button onClick={confirm} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 text-base font-bold" style={{ background: '#4ADE50', color: '#06210d' }}>
              <Check size={20} /> Usar foto
            </button>
            <button onClick={retake} className="flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-semibold" style={{ background: '#18181b', color: '#fafafa' }}>
              <RefreshCw size={18} /> Refazer
            </button>
          </>
        ) : (
          <>
            <button onClick={snap} disabled={!ready} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
              <Camera size={20} /> {label}
            </button>
            {onCancel && (
              <button onClick={() => { stopStream(); onCancel() }} className="flex items-center justify-center rounded-xl px-5 py-4" style={{ background: '#18181b', color: '#a1a1aa' }}>
                <X size={18} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
