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
  /** Incrementa pra forçar useEffect a recriar timer (usado após regen quando
   *  job estava completed e queremos voltar a pollar). */
  const [pollEpoch, setPollEpoch] = useState(0)

  const terminalFiredRef = useRef(false)
  const onTerminalRef    = useRef(opts.onTerminal)
  onTerminalRef.current  = opts.onTerminal

  const fetchOnce = useCallback(async (currentId: string): Promise<{ job: CreativeImageJob; images: CreativeImage[] } | null> => {
    try {
      const [j, imgs] = await Promise.all([
        CreativeApi.getImageJob(currentId),
        CreativeApi.listJobImages(currentId),
      ])
      setJob(j)
      setImages(imgs)
      setError(null)
      // Dispara callback terminal só uma vez — quando job inativo E sem
      // imagens em transição (regen pode estar rolando mesmo com job completed)
      const hasInTransition = imgs.some(i => i.status === 'pending' || i.status === 'generating')
      if (!isJobActive(j.status) && !hasInTransition && !terminalFiredRef.current) {
        terminalFiredRef.current = true
        onTerminalRef.current?.(j)
      }
      return { job: j, images: imgs }
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
      const result = await fetchOnce(jobId)
      if (cancelled) return
      setLoading(false)
      // Continua polling se:
      //  (a) status do job ainda é ativo (queued/generating_prompts/generating_images), OU
      //  (b) há imagens individuais em transição (pending/generating)
      //
      // Caso (b) cobre regenerate após job 'completed': backend cria nova row
      // creative_images pending e reseta job pra generating_images, mas se o
      // frontend pegou snapshot ANTES do reset, fica achando que terminou.
      // Detectar pending/generating nas rows garante polling até resolver.
      const stillPolling = result && (
        isJobActive(result.job.status)
        || result.images.some(i => i.status === 'pending' || i.status === 'generating')
      )
      if (stillPolling) {
        timer = setTimeout(tick, pollMs)
      }
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, pollMs, fetchOnce, pollEpoch])

  const refresh = useCallback(async () => {
    if (!jobId) return
    const result = await fetchOnce(jobId)
    // Se há pending/generating após refresh e polling estava parado, restart
    // (caso clássico: user clicou regenerar num job já completed)
    if (result && result.images.some(i => i.status === 'pending' || i.status === 'generating')) {
      terminalFiredRef.current = false
      setPollEpoch(e => e + 1)
    }
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
