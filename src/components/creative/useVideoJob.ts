'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { CreativeApi } from './api'
import { isVideoJobActive, type CreativeVideo, type CreativeVideoJob } from './types'

interface Options {
  pollMs?:    number
  onTerminal?: (job: CreativeVideoJob) => void
}

interface Result {
  job:        CreativeVideoJob | null
  videos:     CreativeVideo[]
  loading:    boolean
  error:      string | null
  refresh:    () => Promise<void>
  patchVideo: (next: CreativeVideo) => void
}

/** Polling do status de um video job + suas videos. Pattern espelha
 *  useImageJob (E2). Default 5s — vídeo demora minutos pra render no Kling. */
export function useVideoJob(jobId: string | null, opts: Options = {}): Result {
  const pollMs = opts.pollMs ?? 5000
  const [job, setJob]       = useState<CreativeVideoJob | null>(null)
  const [videos, setVideos] = useState<CreativeVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const terminalFiredRef = useRef(false)
  const onTerminalRef    = useRef(opts.onTerminal)
  onTerminalRef.current  = opts.onTerminal

  const fetchOnce = useCallback(async (id: string) => {
    try {
      const [j, vs] = await Promise.all([
        CreativeApi.getVideoJob(id),
        CreativeApi.listJobVideos(id),
      ])
      setJob(j)
      setVideos(vs)
      setError(null)
      if (!isVideoJobActive(j.status) && !terminalFiredRef.current) {
        terminalFiredRef.current = true
        onTerminalRef.current?.(j)
      }
      return j
    } catch (e: unknown) {
      setError((e as Error).message)
      return null
    }
  }, [])

  useEffect(() => {
    if (!jobId) {
      setJob(null); setVideos([]); setError(null); setLoading(false)
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
      if (j && isVideoJobActive(j.status)) {
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

  const patchVideo = useCallback((next: CreativeVideo) => {
    setVideos(prev => {
      const idx = prev.findIndex(v => v.id === next.id)
      if (idx === -1) return [...prev, next].sort((a, b) => a.position - b.position)
      const out = [...prev]
      out[idx] = next
      return out
    })
  }, [])

  return { job, videos, loading, error, refresh, patchVideo }
}
