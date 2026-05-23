'use client'

import { BACKEND, getToken } from './api'

/**
 * Outbox offline: quando uma ação não-interativa (avaria, bloqueio) falha por
 * falta de conexão, ela vai pra esta fila (localStorage) e é reenviada quando
 * a conexão volta. Ações interativas que precisam de resposta (bipagem,
 * conferência) NÃO usam a fila — exigem rede e o app avisa quando está offline.
 */

const KEY = 'eclick_fulfillment_outbox'

interface OutboxItem { id: string; path: string; method: string; body?: unknown; ts: number }

function read(): OutboxItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OutboxItem[] } catch { return [] }
}
function write(items: OutboxItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* quota */ }
}

export function outboxCount(): number {
  return read().length
}

function enqueue(path: string, method: string, body?: unknown) {
  const items = read()
  items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, method, body, ts: Date.now() })
  write(items)
}

/** É um erro de REDE (offline), não uma resposta 4xx/5xx do backend? */
function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError // fetch lança TypeError quando não há rede
}

/**
 * Tenta enviar agora; se estiver offline (erro de rede), guarda na fila e
 * sinaliza queued=true. Erros de validação do backend (4xx) NÃO vão pra fila
 * (reenviar não resolveria) — são relançados pra UI tratar.
 */
export async function sendOrQueue(path: string, method: string, body?: unknown): Promise<{ ok: boolean; queued: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue(path, method, body)
    return { ok: true, queued: true }
  }
  try {
    const token = await getToken()
    const res = await fetch(`${BACKEND}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      // 4xx/5xx: não enfileira (relança pra UI)
      let msg = `Erro ${res.status}`
      try { const b = await res.json(); msg = b?.message ?? msg } catch { /* */ }
      throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg))
    }
    return { ok: true, queued: false }
  } catch (e) {
    if (isNetworkError(e)) { enqueue(path, method, body); return { ok: true, queued: true } }
    throw e
  }
}

/** Reenvia tudo que está na fila. Remove os que entregaram (ou que o backend
 *  rejeitou com 4xx — não adianta insistir). Mantém os que falharam por rede. */
export async function flushOutbox(): Promise<{ sent: number; remaining: number }> {
  const items = read()
  if (items.length === 0) return { sent: 0, remaining: 0 }
  const token = await getToken()
  const kept: OutboxItem[] = []
  let sent = 0
  for (const it of items) {
    try {
      const res = await fetch(`${BACKEND}${it.path}`, {
        method: it.method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: it.body !== undefined ? JSON.stringify(it.body) : undefined,
      })
      if (res.ok || (res.status >= 400 && res.status < 500)) { sent++; continue } // entregue ou rejeitado: descarta
      kept.push(it) // 5xx: tenta de novo depois
    } catch (e) {
      if (isNetworkError(e)) { kept.push(it) } else { sent++ } // erro definitivo: descarta
    }
  }
  write(kept)
  return { sent, remaining: kept.length }
}
