/**
 * TelemetryClient — SDK de telemetria de produto do dashboard.
 *
 * Enfileira eventos e faz flush em lote (a cada 15s, ao atingir 20 na fila,
 * e ao sair/ocultar a aba). Autentica com o token Supabase (Bearer) — por
 * isso NÃO usa sendBeacon (beacon não carrega header), e sim fetch keepalive.
 *
 * Org/user vêm do JWT no backend; o client só manda session_id + eventos.
 */
import { EVENT_NAME_SET } from './events'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'
const FLUSH_INTERVAL_MS = 15_000
const FLUSH_AT = 20
const MAX_QUEUE = 200
const SID_KEY = 'eclick_telemetry_sid'

interface QueuedEvent {
  event_name:   string
  module:       string
  event_type?:  string
  feature?:     string
  page_url?:    string
  referrer?:    string
  duration_ms?: number
  properties?:  Record<string, unknown>
}

type TokenGetter = () => Promise<string | null>

class TelemetryClient {
  private queue: QueuedEvent[] = []
  private getToken: TokenGetter | null = null
  private sessionId: string | null = null
  private deviceType = 'desktop'
  private currentModule: string | null = null
  private moduleEnteredAt = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private started = false

  /** Liga o client. Idempotente — chamável a cada render do provider. */
  init(getToken: TokenGetter) {
    this.getToken = getToken
    if (this.started || typeof window === 'undefined') return
    this.sessionId = this.getOrCreateSession()
    if (!this.sessionId) return // sem uuid não dá pra rastrear
    this.deviceType = this.detectDevice()
    this.started = true

    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS)
    document.addEventListener('visibilitychange', this.onHide)
    window.addEventListener('pagehide', this.onHide)
  }

  /** Registra um evento. Valida contra o catálogo (dev: warn em typo). */
  track(eventName: string, opts: { module?: string; properties?: Record<string, unknown>; feature?: string; durationMs?: number } = {}) {
    if (!this.started || typeof window === 'undefined') return
    if (!EVENT_NAME_SET.has(eventName)) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[telemetry] evento fora do catálogo: ${eventName}`)
      return
    }
    const moduleName = opts.module ?? this.currentModule
    if (!moduleName) return // backend exige module; evento sem módulo é descartado

    this.enqueue({
      event_name:  eventName,
      module:      moduleName,
      feature:     opts.feature,
      page_url:    window.location?.pathname,
      referrer:    document.referrer || undefined,
      duration_ms: opts.durationMs,
      properties:  opts.properties,
    })
  }

  enterModule(moduleName: string) {
    if (this.currentModule === moduleName) return
    if (this.currentModule) this.exitModule()
    this.currentModule = moduleName
    this.moduleEnteredAt = Date.now()
    this.track('module_entered', { module: moduleName })
  }

  exitModule() {
    if (!this.currentModule) return
    const durationMs = Date.now() - this.moduleEnteredAt
    this.track('module_exited', { module: this.currentModule, durationMs })
    this.currentModule = null
  }

  pageView(moduleName: string) {
    this.track('page_view', { module: moduleName })
  }

  startTask(taskName: string, properties: Record<string, unknown> = {}) {
    this.track('task.started', { properties: { task_name: taskName, ...properties } })
  }

  completeTask(taskName: string, outcome?: string, properties: Record<string, unknown> = {}) {
    this.track('task.completed', { properties: { task_name: taskName, outcome, ...properties } })
  }

  abandonTask(taskName: string, step?: string, properties: Record<string, unknown> = {}) {
    this.track('task.abandoned', { properties: { task_name: taskName, step, ...properties } })
  }

  // ---- interno ----

  private enqueue(e: QueuedEvent) {
    this.queue.push(e)
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE)
    if (this.queue.length >= FLUSH_AT) void this.flush()
  }

  private onHide = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
    if (this.currentModule) this.exitModule()
    void this.flush(true)
  }

  private async flush(keepalive = false) {
    if (!this.queue.length || !this.getToken || !this.sessionId) return
    const batch = this.queue.splice(0, this.queue.length)
    let token: string | null = null
    try { token = await this.getToken() } catch { /* noop */ }
    if (!token) {
      if (!keepalive) this.queue.unshift(...batch) // tenta de novo depois
      return
    }
    try {
      const res = await fetch(`${BACKEND}/telemetry/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ session_id: this.sessionId, device_type: this.deviceType, events: batch }),
        keepalive,
      })
      if (!res.ok && !keepalive) this.queue.unshift(...batch)
    } catch {
      if (!keepalive) this.queue.unshift(...batch)
    }
  }

  private getOrCreateSession(): string | null {
    try {
      let s = sessionStorage.getItem(SID_KEY)
      if (!s) {
        if (typeof crypto === 'undefined' || !crypto.randomUUID) return null
        s = crypto.randomUUID()
        sessionStorage.setItem(SID_KEY, s)
      }
      return s
    } catch {
      return null
    }
  }

  private detectDevice(): string {
    const w = window.innerWidth || 1280
    if (w < 768) return 'mobile'
    if (w < 1024) return 'tablet'
    return 'desktop'
  }
}

export const telemetry = new TelemetryClient()
