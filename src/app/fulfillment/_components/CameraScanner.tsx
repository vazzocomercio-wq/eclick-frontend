'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ScanLine } from 'lucide-react'

// BarcodeDetector nativo (Android Chrome / Chromium desktop) — tipos mínimos
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor { new (opts?: { formats?: string[] }): BarcodeDetectorLike; getSupportedFormats?(): Promise<string[]> }

/**
 * Leitura de código de barras (EAN/QR) pela CÂMERA do aparelho. Opção além do
 * leitor Bluetooth. Usa o BarcodeDetector nativo quando existe (Android Chrome,
 * rápido) e cai pro @zxing/browser (iOS Safari/Firefox) — carregado só aqui
 * (dynamic import) pra não pesar o resto do app. Ao detectar, chama onDetect e
 * a tela de cima fecha o scanner (a bipagem segue o fluxo normal: apito + bloqueio).
 */
export function CameraScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let stopFn: (() => void) | null = null
    let stream: MediaStream | null = null
    let raf = 0
    let done = false
    const fire = (code: string) => {
      const c = (code ?? '').trim()
      if (done || !c) return
      done = true
      onDetectRef.current(c)
    }

    ;(async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
        if (BD) {
          // 1) BarcodeDetector nativo — gerencio a própria câmera
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
          const supported = (await BD.getSupportedFormats?.().catch(() => [])) ?? []
          const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'].filter((f) => !supported.length || supported.includes(f))
          const detector = new BD(wanted.length ? { formats: wanted } : undefined)
          const loop = async () => {
            if (done || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes?.[0]?.rawValue) { fire(codes[0].rawValue); return }
            } catch { /* pula frame ruim */ }
            raf = requestAnimationFrame(loop)
          }
          raf = requestAnimationFrame(loop)
          stopFn = () => cancelAnimationFrame(raf)
        } else {
          // 2) Fallback @zxing/browser (carregado só agora; ele abre a câmera)
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
            if (result) fire(result.getText())
          })
          stopFn = () => controls.stop()
        }
      } catch {
        setErr('Não foi possível abrir a câmera. Use o leitor Bluetooth ou digite o código.')
      }
    })()

    return () => {
      try { stopFn?.() } catch { /* noop */ }
      if (raf) cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: '#000' }}>
      <div className="flex items-center justify-between p-4">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#fafafa' }}><ScanLine size={18} color="#00E5FF" /> Aponte para o código de barras</span>
        <button onClick={onClose} className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.12)' }} aria-label="Fechar"><X size={20} color="#fafafa" /></button>
      </div>

      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* mira */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-4/5 max-w-sm rounded-xl" style={{ border: '3px solid #00E5FF', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
        </div>
        {err && (
          <div className="absolute inset-x-4 bottom-6 rounded-xl p-3 text-center text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.92)', color: '#fff' }}>{err}</div>
        )}
      </div>

      <p className="p-4 text-center text-xs" style={{ color: '#a1a1aa' }}>Mantenha o código dentro da moldura. Lê EAN, UPC, Code-128 e QR.</p>
    </div>
  )
}
