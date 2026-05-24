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

/** Rastreia o funil de uma tarefa (start → complete | abandon). */
export function useTaskTracking(taskName: string) {
  const startedRef = useRef(false)

  const start = (properties?: Record<string, unknown>) => {
    if (startedRef.current) return
    telemetry.startTask(taskName, properties)
    startedRef.current = true
  }
  const complete = (outcome?: string, properties?: Record<string, unknown>) => {
    telemetry.completeTask(taskName, outcome, properties)
    startedRef.current = false
  }
  const abandon = (step?: string, properties?: Record<string, unknown>) => {
    if (!startedRef.current) return
    telemetry.abandonTask(taskName, step, properties)
    startedRef.current = false
  }

  return { start, complete, abandon }
}

/** Atalho pra disparar um evento avulso do catálogo. */
export function useTrackEvent() {
  return (
    eventName: string,
    opts?: { module?: string; properties?: Record<string, unknown>; feature?: string; durationMs?: number },
  ) => telemetry.track(eventName, opts)
}
