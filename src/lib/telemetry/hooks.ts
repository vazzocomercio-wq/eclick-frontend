'use client'

import { useEffect, useRef } from 'react'
import { telemetry } from './client'

/** Rastreia entrada/saída de um módulo manualmente (sub-views). O
 *  TelemetryProvider já faz isso automático por rota — use só em casos
 *  especiais (ex: módulo lógico que não tem rota própria). */
export function useModuleTracking(moduleName: string) {
  useEffect(() => {
    telemetry.enterModule(moduleName)
    return () => telemetry.exitModule()
  }, [moduleName])
}

interface AttemptState {
  id: string
  started_at: string
  steps: string[]
  completed: boolean
  abandoned: boolean
}

const TASK_TTL_MS = 60 * 60 * 1000 // 1h
const lsKey = (task: string) => `eclick_task_${task}`
const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Rastreia o funil de uma tarefa: start → step* → complete | abandon.
 * Persiste em localStorage (TTL 1h) pra retomar no reload, e abandona
 * automaticamente no unmount/troca de rota. Grava em telemetry_task_attempts
 * (via backend) e também emite os eventos task.* (compat com /insights).
 */
export function useTaskTracking(taskName: string) {
  const ref = useRef<AttemptState | null>(null)

  useEffect(() => {
    // Retoma uma tentativa em andamento (reload no meio do funil).
    try {
      const raw = localStorage.getItem(lsKey(taskName))
      if (raw) {
        const s = JSON.parse(raw) as { id?: string; started_at?: string; steps?: string[]; ts?: number }
        if (s?.id && s.started_at && Date.now() - (s.ts ?? 0) < TASK_TTL_MS) {
          ref.current = { id: s.id, started_at: s.started_at, steps: s.steps ?? [], completed: false, abandoned: false }
        } else {
          localStorage.removeItem(lsKey(taskName))
        }
      }
    } catch { /* noop */ }

    // Abandono automático no unmount/troca de rota.
    return () => {
      const s = ref.current
      if (!s || s.completed || s.abandoned) return
      s.abandoned = true
      void telemetry.postTaskAttempt({
        attempt_id: s.id, task_name: taskName, started_at: s.started_at, steps_completed: s.steps,
        abandoned_at: new Date().toISOString(), abandoned_step: 'unmount', outcome: null,
      })
      try { localStorage.removeItem(lsKey(taskName)) } catch { /* noop */ }
      telemetry.abandonTask(taskName, 'unmount')
    }
  }, [taskName])

  const persist = () => {
    const s = ref.current
    if (!s) return
    try { localStorage.setItem(lsKey(taskName), JSON.stringify({ id: s.id, started_at: s.started_at, steps: s.steps, ts: Date.now() })) } catch { /* noop */ }
  }
  const clearLs = () => { try { localStorage.removeItem(lsKey(taskName)) } catch { /* noop */ } }

  const start = (properties?: Record<string, unknown>) => {
    const cur = ref.current
    if (cur && !cur.completed && !cur.abandoned) return // já ativo
    ref.current = { id: newId(), started_at: new Date().toISOString(), steps: [], completed: false, abandoned: false }
    persist()
    void telemetry.postTaskAttempt({ attempt_id: ref.current.id, task_name: taskName, started_at: ref.current.started_at, steps_completed: [] })
    telemetry.startTask(taskName, properties)
  }

  const step = (name: string) => {
    const s = ref.current
    if (!s) return
    if (!s.steps.includes(name)) s.steps.push(name)
    persist()
    void telemetry.postTaskAttempt({ attempt_id: s.id, task_name: taskName, started_at: s.started_at, steps_completed: s.steps })
  }

  const complete = (outcome = 'completed', properties?: Record<string, unknown>) => {
    const s = ref.current
    if (!s) return
    s.completed = true
    void telemetry.postTaskAttempt({
      attempt_id: s.id, task_name: taskName, started_at: s.started_at, steps_completed: s.steps,
      completed_at: new Date().toISOString(), outcome,
    })
    clearLs()
    telemetry.completeTask(taskName, outcome, properties)
  }

  const abandon = (currentStep?: string, properties?: Record<string, unknown>) => {
    const s = ref.current
    if (!s || s.completed || s.abandoned) return
    s.abandoned = true
    const step = currentStep ?? s.steps[s.steps.length - 1] ?? 'unknown'
    void telemetry.postTaskAttempt({
      attempt_id: s.id, task_name: taskName, started_at: s.started_at, steps_completed: s.steps,
      abandoned_at: new Date().toISOString(), abandoned_step: step, outcome: null,
    })
    clearLs()
    telemetry.abandonTask(taskName, step, properties)
  }

  return { start, step, complete, abandon }
}

/** Atalho pra disparar um evento avulso do catálogo. */
export function useTrackEvent() {
  return (
    eventName: string,
    opts?: { module?: string; properties?: Record<string, unknown>; feature?: string; durationMs?: number },
  ) => telemetry.track(eventName, opts)
}
