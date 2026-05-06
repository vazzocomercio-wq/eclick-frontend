'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CreativeApi } from './api'
import { isJobActive, type CreativeImage, type CreativeImageJob } from './types'

interface UseImageJobOptions {
  /** Intervalo de polling (ms). Default 3000. */
  pollMs?: number
  /** Callback chamado quando job atinge estado terminal (completed/failed/cancelled). */
  onTerminal?: (job: CreativeImageJob) => void
}

interface UseImageJobResult {
  job:     CreativeImageJob | null
  images:  CreativeImage[]
  loading: boolean
  error:   string | null
  /** Refresh manual (sem esperar próximo tick). */
  refresh: () => Promise<void>
  /** Atualiza estado local sem chamar a API — útil pós aprove/reject otimista. */
  patchImage: (next: CreativeImage) => void
}

/**
 * Polling do status de um image job + suas imagens.
 * Polling para automaticamente quando job chega em estado terminal,
 * mas continua re-fetchando a cada `pollMs` enquanto ativo.
 */
export function useImageJob(jobId: string | null, opts: UseImageJobOptions = {}): UseImageJobResult {
  const pollMs = opts.pollMs ?? 3000
  const [job,    setJob]    = useState<CreativeImageJob | null>(null)
  const [images, setImages] = useState<CreativeImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const terminalFiredRef = useRef(false)
  const onTerminalRef    = useRef(opts.onTerminal)
  onTerminalRef.current  = opts.onTerminal

  const fetchOnce = useCallback(async (currentId: string) => {
    try {
      const [j, imgs] = await Promise.all([
        CreativeApi.getImageJob(currentId),
        CreativeApi.listJobImages(currentId),
      ])
      setJob(j)
      setImages(imgs)
      setError(null)
      // Dispara callback terminal só uma vez
      if (!isJobActive(j.status) && !terminalFiredRef.current) {
        terminalFiredRef.current = true
        onTerminalRef.current?.(j)
      }
      return j
    } catch (e: unknown) {
      setError((e as Error).message)
      return null
    }
  }, [])

  // Primeira carga + polling
  useEffect(() => {
    if (!jobId) {
      setJob(null); setImages([]); setError(null); setLoading(false)
      terminalFiredRef.current = false
      return
    }
    let cancelled = false
    let timer: NodeJS.Timeout | null = null

    setLoading(true)
    terminalFiredRef.current = false

    const tick = async () => {
      if (cancelled) return
      const j = await fetchOnce(jobId)
      if (cancelled) return
      setLoading(false)
      // Continua polling se ativo OU se houver imagens em transição
      // (pending/generating/regenerated_from após approve quando user pediu regenerate)
      const stillPolling = j && isJobActive(j.status)
      if (stillPolling) {
        timer = setTimeout(tick, pollMs)
      }
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, pollMs, fetchOnce])

  const refresh = useCallback(async () => {
    if (!jobId) return
    await fetchOnce(jobId)
  }, [jobId, fetchOnce])

  const patchImage = useCallback((next: CreativeImage) => {
    setImages(prev => {
      const idx = prev.findIndex(i => i.id === next.id)
      if (idx === -1) return [...prev, next].sort((a, b) => a.position - b.position)
      const out = [...prev]
      out[idx] = next
      return out
    })
  }, [])

  return { job, images, loading, error, refresh, patchImage }
}
