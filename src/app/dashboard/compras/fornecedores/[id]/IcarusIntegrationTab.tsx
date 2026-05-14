'use client'

/**
 * Sessão 2026-05-14 — UI da integração Icarus (Pennacorp) por fornecedor.
 *
 * Fluxo:
 *   - Se não conectado: mostra form pra colar access_token (faz ping antes de persistir)
 *   - Se conectado: mostra status, last_sync, botões Testar + Sincronizar agora + Desconectar
 *
 * Endpoints consumidos:
 *   POST   /suppliers/:id/integrations/icarus       — conectar
 *   GET    /suppliers/:id/integrations/icarus       — status
 *   POST   /suppliers/:id/integrations/icarus/test  — ping
 *   DELETE /suppliers/:id/integrations/icarus       — desconectar
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface IntegrationStatus {
  id:               string
  supplier_id:      string
  is_active:        boolean
  last_synced_at:   string | null
  last_sync_status: 'success' | 'failed' | 'partial' | null
  last_sync_error:  string | null
  total_synced:     number
  config: {
    base_url?:           string
    rate_limit_rpm?:     number
    sync_only_ecommerce?: boolean
    notes?:              string
  }
  created_at: string
  updated_at: string
}

async function token(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function IcarusIntegrationTab({ supplierId }: { supplierId: string }) {
  const [status,  setStatus]  = useState<IntegrationStatus | null | undefined>(undefined)  // undefined = loading
  const [error,   setError]   = useState<string | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string } | null>(null)

  // Form de conexão
  const [accessToken, setAccessToken]       = useState('')
  const [baseUrl,     setBaseUrl]           = useState('')
  const [ecommOnly,   setEcommOnly]         = useState(false)
  const [notes,       setNotes]             = useState('')

  const load = useCallback(async () => {
    setError(null)
    const t = await token()
    if (!t) return
    try {
      const res = await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const body = await res.json()
        setStatus(body)
      } else {
        setStatus(null)
      }
    } catch (e) {
      setError((e as Error).message)
      setStatus(null)
    }
  }, [supplierId])

  useEffect(() => { void load() }, [load])

  const handleConnect = useCallback(async () => {
    if (!accessToken.trim()) {
      setError('Cole o access token recebido da Pennacorp.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const t = await token()
      if (!t) throw new Error('Sessão expirou')
      const res = await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:        accessToken.trim(),
          base_url:            baseUrl.trim() || undefined,
          sync_only_ecommerce: ecommOnly,
          notes:               notes.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)
      setStatus(body as IntegrationStatus)
      // Limpa form
      setAccessToken('')
      setBaseUrl('')
      setNotes('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [accessToken, baseUrl, ecommOnly, notes, supplierId])

  const handleTest = useCallback(async () => {
    setBusy(true)
    setTestRes(null)
    try {
      const t = await token()
      if (!t) throw new Error('Sessão expirou')
      const res = await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus/test`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      const body = await res.json().catch(() => ({}))
      if (body.ok) {
        setTestRes({ ok: true, message: `Conectado em ${body.base_url}. Token gerado: ${body.request_token_preview}` })
      } else {
        setTestRes({ ok: false, message: body.error || `HTTP ${res.status}` })
      }
    } catch (e) {
      setTestRes({ ok: false, message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }, [supplierId])

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Desconectar Icarus? O token será desativado mas o histórico de sync fica salvo.')) return
    setBusy(true)
    try {
      const t = await token()
      if (!t) throw new Error('Sessão expirou')
      await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${t}` },
      })
      await load()
    } finally {
      setBusy(false)
    }
  }, [supplierId, load])

  // ── render ────────────────────────────────────────────────────────────

  if (status === undefined) {
    return <div className="text-sm text-zinc-500">Carregando…</div>
  }

  const isConnected = status && status.is_active

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h3 className="text-base font-semibold mb-1">Integração com Icarus (Pennacorp)</h3>
        <p className="text-sm text-zinc-500">
          Sincroniza estoque + preço do fornecedor automaticamente. O <span className="text-cyan-400">preço de venda dele</span> vira nosso <span className="text-emerald-400">preço de custo</span>.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm border"
          style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {!isConnected ? (
        <ConnectForm
          accessToken={accessToken} setAccessToken={setAccessToken}
          baseUrl={baseUrl} setBaseUrl={setBaseUrl}
          ecommOnly={ecommOnly} setEcommOnly={setEcommOnly}
          notes={notes} setNotes={setNotes}
          busy={busy}
          onSubmit={handleConnect}
        />
      ) : (
        <ConnectedView
          status={status!}
          busy={busy}
          testRes={testRes}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
          onReconnect={() => setStatus(null)}
        />
      )}

      {/* Doc compacta */}
      <details className="rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #27272a' }}>
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-zinc-400 select-none">
          Como conseguir o access token?
        </summary>
        <div className="px-4 pb-4 pt-1 text-xs text-zinc-500 space-y-2">
          <p>O fornecedor precisa solicitar formalmente à Pennacorp via <span className="text-zinc-300">"Pedido de Utilização da API"</span>.</p>
          <p>Doc oficial: <a className="text-cyan-400 hover:text-cyan-300" href="https://www.pennacorp.com.br/mobile/api/public/apidoc/index.html" target="_blank" rel="noopener noreferrer">pennacorp.com.br/mobile/api/public/apidoc</a></p>
          <p>Contato Pennacorp: WhatsApp (11) 94169-3890 / daniele@pennacorp.com.br</p>
          <p className="text-zinc-600">Endpoints usados pela integração: <code>/generate</code>, <code>/produtos</code>, <code>/estoque</code>{' '}— peça pra confirmar que o token autoriza esses.</p>
        </div>
      </details>
    </div>
  )
}

// ── form de conexão ────────────────────────────────────────────────────

function ConnectForm({
  accessToken, setAccessToken, baseUrl, setBaseUrl, ecommOnly, setEcommOnly, notes, setNotes, busy, onSubmit,
}: {
  accessToken: string; setAccessToken: (v: string) => void
  baseUrl: string; setBaseUrl: (v: string) => void
  ecommOnly: boolean; setEcommOnly: (v: boolean) => void
  notes: string; setNotes: (v: string) => void
  busy: boolean
  onSubmit: () => void
}) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <Field label="Access Token *" hint="Cole o token recebido da Pennacorp">
        <textarea
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          rows={3}
          placeholder="Cole aqui o access_token longo gerado pela Pennacorp…"
          className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none focus:border-cyan-500/60 resize-none"
          style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
        />
      </Field>

      <Field label="URL base (opcional)" hint="Deixe vazio se o fornecedor usa o ambiente padrão Pennacorp">
        <input
          type="text"
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://www.pennacorp.com.br/mobile/api/public"
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-cyan-500/60"
          style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={ecommOnly} onChange={e => setEcommOnly(e.target.checked)}
          className="w-4 h-4 accent-cyan-400" />
        <span className="text-sm text-zinc-300">Sincronizar apenas produtos ativos no e-commerce do fornecedor</span>
      </label>

      <Field label="Anotações (opcional)">
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ex: contato técnico, observações sobre o token…"
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:border-cyan-500/60"
          style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
        />
      </Field>

      <div className="flex justify-end">
        <button onClick={onSubmit} disabled={busy || !accessToken.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)', color: '#000' }}>
          {busy ? 'Validando token…' : 'Conectar Icarus'}
        </button>
      </div>
    </div>
  )
}

// ── view conectado ─────────────────────────────────────────────────────

function ConnectedView({
  status, busy, testRes, onTest, onDisconnect, onReconnect,
}: {
  status: IntegrationStatus
  busy: boolean
  testRes: { ok: boolean; message: string } | null
  onTest: () => void
  onDisconnect: () => void
  onReconnect: () => void
}) {
  const syncedAgo = status.last_synced_at
    ? Math.round((Date.now() - new Date(status.last_synced_at).getTime()) / 60_000) + ' min atrás'
    : 'nunca'

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid rgba(52,211,153,0.25)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
          <span className="text-base font-semibold text-emerald-400">Conectado</span>
          <span className="text-xs text-zinc-500">desde {fmtDate(status.created_at)}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
          <StatCard label="Última sync" value={syncedAgo} />
          <StatCard label="Status última sync" value={status.last_sync_status ?? '—'}
            color={status.last_sync_status === 'success' ? 'emerald' : status.last_sync_status === 'failed' ? 'red' : 'amber'} />
          <StatCard label="Total sincronizado" value={status.total_synced.toLocaleString('pt-BR')} />
        </div>

        {status.last_sync_error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            <span className="font-medium">Erro último sync:</span> {status.last_sync_error}
          </div>
        )}

        {status.config.base_url && (
          <div className="text-xs text-zinc-500 mb-2">URL: <code className="text-zinc-300">{status.config.base_url}</code></div>
        )}
        {status.config.sync_only_ecommerce && (
          <div className="text-xs text-zinc-500 mb-2">Filtro: somente produtos do e-commerce</div>
        )}
        {status.config.notes && (
          <div className="text-xs text-zinc-500 mb-2">Notas: {status.config.notes}</div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={onTest} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:border-cyan-500/40 hover:text-cyan-400 disabled:opacity-40"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            {busy ? 'Testando…' : 'Testar conexão'}
          </button>
          <button onClick={onReconnect} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-40"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Atualizar token
          </button>
          <button onClick={onDisconnect} disabled={busy}
            className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Desconectar
          </button>
        </div>

        {testRes && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              background: testRes.ok ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
              border: '1px solid ' + (testRes.ok ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'),
              color: testRes.ok ? '#34d399' : '#f87171',
            }}>
            {testRes.ok ? '✓ ' : '✗ '}{testRes.message}
          </div>
        )}
      </div>

      <div className="px-4 py-3 rounded-lg text-xs text-zinc-500"
        style={{ background: '#0a0a0c', border: '1px dashed #27272a' }}>
        <span className="font-medium text-zinc-400">Próximas fases:</span> sincronização inicial do catálogo + auto-vínculo por GTIN/SKU + cron incremental de estoque e preço.
        Ainda não habilitadas — só Fase 1 (conexão) está pronta.
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'emerald' | 'red' | 'amber' }) {
  const C = {
    emerald: '#34d399',
    red:     '#f87171',
    amber:   '#f59e0b',
  } as const
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #27272a' }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: color ? C[color] : '#e4e4e7' }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}
