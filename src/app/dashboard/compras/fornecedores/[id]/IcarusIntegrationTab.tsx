'use client'

/**
 * Sessão 2026-05-18 — Aba da integração Icarus (Pennacorp) por fornecedor.
 *
 * Não conectado: form pra colar o access_token (ping antes de persistir).
 * Conectado: status + desconto geral + tela de sincronização do catálogo
 *            (puxar / listar com status / sincronizar por seleção) + ajuste
 *            de custo por produto.
 *
 * Princípio: não importa o catálogo inteiro — o lojista escolhe o que
 * sincronizar. O custo é o preço da Cinderella menos o desconto (só do nosso
 * lado; nada é enviado de volta pro ERP).
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RefreshCw, Check, Search, Package, ChevronLeft, ChevronRight } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const PAGE = 50

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

interface CatalogItem {
  id:                 string
  external_code:      string
  external_barcode:   string | null
  name:               string | null
  family:             string | null
  image_url:          string | null
  gross_price:        number | null
  original_price:     number | null
  promo_active:       boolean
  stock:              number
  sync_status:        string
  matched_product_id: string | null
  display_status:     'synced' | 'available' | 'new'
}

interface CatalogSummary { total: number; synced: number; available: number; new: number }

interface LinkedProduct {
  id:                    string
  product_id:            string
  name:                  string | null
  sku:                   string
  supplier_gross_price:  number | null
  cost_adjustment_type:  'percent' | 'fixed' | 'override' | null
  cost_adjustment_value: number | null
  unit_cost:             number | null
  partner_stock:         number | null
}

type DiscountType = 'percent' | 'fixed'

// ── helpers ──────────────────────────────────────────────────────────────

async function token(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  if (!t) throw new Error('Sessão expirou — recarregue a página')
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { message?: string })?.message || `HTTP ${res.status}`)
  return body as T
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtBrl(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── componente principal ─────────────────────────────────────────────────

export function IcarusIntegrationTab({ supplierId }: { supplierId: string }) {
  const [status,  setStatus]  = useState<IntegrationStatus | null | undefined>(undefined)
  const [error,   setError]   = useState<string | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string } | null>(null)

  const [accessToken, setAccessToken] = useState('')
  const [baseUrl,     setBaseUrl]     = useState('')
  const [ecommOnly,   setEcommOnly]   = useState(false)
  const [notes,       setNotes]       = useState('')

  const load = useCallback(async () => {
    setError(null)
    const t = await token()
    if (!t) return
    try {
      const res = await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      setStatus(res.ok ? await res.json() : null)
    } catch (e) {
      setError((e as Error).message)
      setStatus(null)
    }
  }, [supplierId])

  useEffect(() => { void load() }, [load])

  const handleConnect = useCallback(async () => {
    if (!accessToken.trim()) { setError('Cole o access token recebido da Pennacorp.'); return }
    setBusy(true); setError(null)
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
      setAccessToken(''); setBaseUrl(''); setNotes('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [accessToken, baseUrl, ecommOnly, notes, supplierId])

  const handleTest = useCallback(async () => {
    setBusy(true); setTestRes(null)
    try {
      const t = await token()
      if (!t) throw new Error('Sessão expirou')
      const res = await fetch(`${BACKEND}/suppliers/${supplierId}/integrations/icarus/test`, {
        method: 'POST', headers: { Authorization: `Bearer ${t}` },
      })
      const body = await res.json().catch(() => ({}))
      setTestRes(body.ok
        ? { ok: true,  message: `Conectado em ${body.base_url}. Token gerado: ${body.request_token_preview}` }
        : { ok: false, message: body.error || `HTTP ${res.status}` })
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
        method: 'DELETE', headers: { Authorization: `Bearer ${t}` },
      })
      await load()
    } finally {
      setBusy(false)
    }
  }, [supplierId, load])

  if (status === undefined) {
    return <div className="text-sm text-zinc-500">Carregando…</div>
  }

  const isConnected = status && status.is_active

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h3 className="text-base font-semibold mb-1">Integração com Icarus (Pennacorp)</h3>
        <p className="text-sm text-zinc-500">
          Sincroniza catálogo e estoque do fornecedor. O <span className="text-cyan-400">preço de venda dele</span> menos o seu desconto vira o seu <span className="text-emerald-400">custo</span>.
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
          supplierId={supplierId}
          busy={busy}
          testRes={testRes}
          onTest={handleTest}
          onDisconnect={handleDisconnect}
          onReconnect={() => setStatus(null)}
        />
      )}

      <details className="rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #27272a' }}>
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-zinc-400 select-none">
          Como conseguir o access token?
        </summary>
        <div className="px-4 pb-4 pt-1 text-xs text-zinc-500 space-y-2">
          <p>O fornecedor precisa solicitar formalmente à Pennacorp via <span className="text-zinc-300">Pedido de Utilização da API</span>.</p>
          <p>Doc oficial: <a className="text-cyan-400 hover:text-cyan-300" href="https://www.pennacorp.com.br/mobile/api/public/apidoc/index.html" target="_blank" rel="noopener noreferrer">pennacorp.com.br/mobile/api/public/apidoc</a></p>
          <p>Contato Pennacorp: karoline@pennacorp.com.br</p>
          <p className="text-zinc-600">Endpoints usados: <code>/generate</code>, <code>/produtos</code>, <code>/estoque_v2</code>.</p>
        </div>
      </details>
    </div>
  )
}

// ── form de conexão ──────────────────────────────────────────────────────

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
          placeholder="https://www.pennacorp.com.br/mobile/api"
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

// ── view conectado ───────────────────────────────────────────────────────

function ConnectedView({
  status, supplierId, busy, testRes, onTest, onDisconnect, onReconnect,
}: {
  status: IntegrationStatus
  supplierId: string
  busy: boolean
  testRes: { ok: boolean; message: string } | null
  onTest: () => void
  onDisconnect: () => void
  onReconnect: () => void
}) {
  // refreshKey: incrementado após sincronizar / mudar desconto → recarrega os produtos vinculados
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = useCallback(() => setRefreshKey(k => k + 1), [])

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid rgba(52,211,153,0.25)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
          <span className="text-base font-semibold text-emerald-400">Conectado</span>
          <span className="text-xs text-zinc-500">desde {fmtDate(status.created_at)}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
          <StatCard label="Última sync" value={status.last_synced_at ? fmtDate(status.last_synced_at) : 'nunca'} />
          <StatCard label="Status última sync" value={status.last_sync_status ?? '—'}
            color={status.last_sync_status === 'success' ? 'emerald' : status.last_sync_status === 'failed' ? 'red' : 'amber'} />
          <StatCard label="Itens no catálogo" value={status.total_synced.toLocaleString('pt-BR')} />
        </div>

        {status.last_sync_error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            <span className="font-medium">Erro último sync:</span> {status.last_sync_error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
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

      <DiscountPanel supplierId={supplierId} onSaved={bump} />
      <CatalogPanel supplierId={supplierId} onSynced={bump} />
      <LinkedProductsPanel supplierId={supplierId} refreshKey={refreshKey} />
    </div>
  )
}

// ── desconto geral ───────────────────────────────────────────────────────

function DiscountPanel({ supplierId, onSaved }: { supplierId: string; onSaved: () => void }) {
  const base = `/suppliers/${supplierId}/integrations/icarus`
  const [type,   setType]   = useState<DiscountType | null>(null)
  const [value,  setValue]  = useState('')
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState<string | null>(null)
  const [err,    setErr]    = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const d = await api<{ type: DiscountType | null; value: number }>(`${base}/discount`)
        setType(d.type)
        setValue(d.type ? String(d.value) : '')
      } catch { /* silencioso — o painel ainda funciona */ }
    })()
  }, [base])

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null)
    try {
      const r = await api<{ ok: boolean; recomputed: number }>(`${base}/discount`, {
        method: 'PUT',
        body: JSON.stringify({ type, value: type ? Number(value) || 0 : 0 }),
      })
      setMsg(`Desconto salvo — ${r.recomputed} custo(s) recalculado(s).`)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <h4 className="text-sm font-semibold mb-1">Desconto geral da Cinderella</h4>
      <p className="text-xs text-zinc-500 mb-4">
        Aplica a todos os produtos sincronizados que não têm um ajuste próprio.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">Tipo</label>
          <div className="flex gap-1">
            <SegBtn active={type === null}     onClick={() => setType(null)}>Sem desconto</SegBtn>
            <SegBtn active={type === 'percent'} onClick={() => setType('percent')}>Percentual %</SegBtn>
            <SegBtn active={type === 'fixed'}   onClick={() => setType('fixed')}>Valor fixo R$</SegBtn>
          </div>
        </div>

        {type && (
          <div>
            <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">
              {type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}
            </label>
            <input
              type="number" min={0} step="0.01"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={type === 'percent' ? '30' : '15,00'}
              className="w-32 px-3 py-2 rounded-lg text-sm border outline-none focus:border-cyan-500/60"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
            />
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)', color: '#000' }}>
          {saving ? 'Salvando…' : 'Salvar desconto'}
        </button>
      </div>

      {msg && <div className="mt-3 text-xs text-emerald-400">{msg}</div>}
      {err && <div className="mt-3 text-xs text-red-400">{err}</div>}
    </div>
  )
}

// ── sincronização do catálogo ────────────────────────────────────────────

function CatalogPanel({ supplierId, onSynced }: { supplierId: string; onSynced: () => void }) {
  const base = `/suppliers/${supplierId}/integrations/icarus`
  const [items,   setItems]   = useState<CatalogItem[]>([])
  const [summary, setSummary] = useState<CatalogSummary | null>(null)
  const [total,   setTotal]   = useState(0)
  const [offset,  setOffset]  = useState(0)
  const [filter,  setFilter]  = useState<'all' | 'pending' | 'synced'>('all')
  const [search,  setSearch]  = useState('')
  const [applied, setApplied] = useState('')
  const [selected,setSelected]= useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    try { setSummary(await api<CatalogSummary>(`${base}/catalog/summary`)) } catch { /* ignora */ }
  }, [base])

  const loadItems = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
      if (filter !== 'all') qs.set('status', filter)
      if (applied) qs.set('search', applied)
      const r = await api<{ items: CatalogItem[]; total: number }>(`${base}/catalog?${qs.toString()}`)
      setItems(r.items)
      setTotal(r.total)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [base, offset, filter, applied])

  useEffect(() => { void loadItems() }, [loadItems])
  useEffect(() => { void loadSummary() }, [loadSummary])

  const pull = async () => {
    setPulling(true); setErr(null); setMsg(null)
    try {
      const r = await api<{ pulled: number }>(`${base}/catalog/pull`, { method: 'POST' })
      setMsg(`${r.pulled.toLocaleString('pt-BR')} produtos no catálogo do Pennacorp.`)
      setOffset(0)
      await Promise.all([loadItems(), loadSummary()])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setPulling(false)
    }
  }

  const sync = async () => {
    if (selected.size === 0) return
    setSyncing(true); setErr(null); setMsg(null)
    try {
      const r = await api<{ synced: number; created_products: number; linked_existing: number; failed: number }>(
        `${base}/catalog/sync`,
        { method: 'POST', body: JSON.stringify({ catalog_item_ids: [...selected] }) },
      )
      setMsg(`${r.synced} sincronizado(s): ${r.linked_existing} vinculado(s), ${r.created_products} criado(s)`
        + (r.failed ? `, ${r.failed} com falha.` : '.'))
      setSelected(new Set())
      await Promise.all([loadItems(), loadSummary()])
      onSynced()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const changeFilter = (f: 'all' | 'pending' | 'synced') => { setFilter(f); setOffset(0) }
  const applySearch = () => { setApplied(search.trim()); setOffset(0) }

  const toggle = (id: string) => setSelected(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const selectable = items.filter(i => i.display_status !== 'synced')
  const allSelected = selectable.length > 0 && selectable.every(i => selected.has(i.id))
  const toggleAll = () => setSelected(s => {
    const n = new Set(s)
    if (allSelected) selectable.forEach(i => n.delete(i.id))
    else selectable.forEach(i => n.add(i.id))
    return n
  })

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE, total)

  return (
    <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h4 className="text-sm font-semibold">Sincronização do catálogo</h4>
        <button onClick={pull} disabled={pulling}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:border-cyan-500/40 hover:text-cyan-400 disabled:opacity-40"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={pulling ? 'animate-spin' : ''} />
          {pulling ? 'Puxando…' : 'Puxar catálogo'}
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Puxa o catálogo do Pennacorp e mostra o que já está sincronizado. Selecione e sincronize só o que interessa.
      </p>

      {summary && (
        <div className="flex flex-wrap gap-2 mb-4">
          <SummaryChip label="No catálogo" value={summary.total} color="#a1a1aa" />
          <SummaryChip label="Sincronizados" value={summary.synced} color="#34d399" />
          <SummaryChip label="Disponíveis" value={summary.available} color="#00E5FF" />
          <SummaryChip label="Sem cadastro" value={summary.new} color="#71717a" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-1">
          <SegBtn active={filter === 'all'}     onClick={() => changeFilter('all')}>Todos</SegBtn>
          <SegBtn active={filter === 'pending'} onClick={() => changeFilter('pending')}>Não sincronizados</SegBtn>
          <SegBtn active={filter === 'synced'}  onClick={() => changeFilter('synced')}>Sincronizados</SegBtn>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
              placeholder="Buscar código ou nome…"
              className="w-56 pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none focus:border-cyan-500/60"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
            />
          </div>
          <button onClick={applySearch}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:border-cyan-500/40"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Buscar
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-xs text-red-400">{err}</div>}
      {msg && <div className="mb-3 text-xs text-emerald-400">{msg}</div>}

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#0a0a0c', color: '#71717a' }}>
              <th className="w-9 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  disabled={selectable.length === 0} className="w-3.5 h-3.5 accent-cyan-400" />
              </th>
              <th className="text-left px-2 py-2 font-medium">Produto</th>
              <th className="text-left px-2 py-2 font-medium">Família</th>
              <th className="text-right px-2 py-2 font-medium">Preço Cinderella</th>
              <th className="text-right px-2 py-2 font-medium">Estoque</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">Carregando…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">
                Catálogo vazio — clique em <span className="text-zinc-400">Puxar catálogo</span> pra carregar do Pennacorp.
              </td></tr>
            )}
            {!loading && items.map(it => {
              const synced = it.display_status === 'synced'
              return (
                <tr key={it.id} style={{ borderTop: '1px solid #1c1c1f' }}>
                  <td className="px-3 py-2 align-middle">
                    <input type="checkbox" disabled={synced}
                      checked={selected.has(it.id)} onChange={() => toggle(it.id)}
                      className="w-3.5 h-3.5 accent-cyan-400 disabled:opacity-30" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded shrink-0 bg-center bg-cover"
                        style={{
                          backgroundImage: it.image_url ? `url(${it.image_url})` : undefined,
                          background: it.image_url ? undefined : '#0a0a0c',
                          border: '1px solid #27272a',
                        }} />
                      <div className="min-w-0">
                        <div className="text-zinc-200 truncate max-w-[280px]">{it.name ?? it.external_code}</div>
                        <div className="text-zinc-600 font-mono text-[10px]">{it.external_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-zinc-500">{it.family ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-300">
                    {fmtBrl(it.gross_price)}
                    {it.promo_active && <span className="ml-1 text-[9px] text-amber-400">promo</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-400">{it.stock}</td>
                  <td className="px-3 py-2"><StatusBadge status={it.display_status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="text-xs text-zinc-600">
          {total > 0 ? `${from}–${to} de ${total.toLocaleString('pt-BR')}` : 'Nenhum item'}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={sync} disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)', color: '#000' }}>
              <Check size={13} />
              {syncing ? 'Sincronizando…' : `Sincronizar ${selected.size} selecionado(s)`}
            </button>
          )}
          <button onClick={() => setOffset(o => Math.max(0, o - PAGE))} disabled={offset === 0}
            className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setOffset(o => o + PAGE)} disabled={to >= total}
            className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── produtos vinculados (ajuste por produto) ─────────────────────────────

function LinkedProductsPanel({ supplierId, refreshKey }: { supplierId: string; refreshKey: number }) {
  const base = `/suppliers/${supplierId}/integrations/icarus`
  const [rows,    setRows]    = useState<LinkedProduct[]>([])
  const [edits,   setEdits]   = useState<Record<string, { type: string; value: string }>>({})
  const [loading, setLoading] = useState(false)
  const [savingId,setSavingId]= useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const data = await api<LinkedProduct[]>(`${base}/products`)
      setRows(data)
      setEdits(Object.fromEntries(data.map(r => [r.id, {
        type:  r.cost_adjustment_type ?? '',
        value: r.cost_adjustment_value != null ? String(r.cost_adjustment_value) : '',
      }])))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => { void load() }, [load, refreshKey])

  const isDirty = (r: LinkedProduct): boolean => {
    const e = edits[r.id]
    if (!e) return false
    const serverType = r.cost_adjustment_type ?? ''
    const serverVal = r.cost_adjustment_value != null ? String(r.cost_adjustment_value) : ''
    return e.type !== serverType || (e.type !== '' && e.value !== serverVal)
  }

  const save = async (r: LinkedProduct) => {
    const e = edits[r.id]
    if (!e) return
    setSavingId(r.id); setErr(null)
    try {
      const res = await api<{ ok: boolean; unit_cost: number }>(
        `${base}/products/${r.id}/adjustment`,
        { method: 'PUT', body: JSON.stringify({
          type:  e.type || null,
          value: e.type ? Number(e.value) || 0 : null,
        }) },
      )
      setRows(rs => rs.map(x => x.id === r.id ? {
        ...x,
        cost_adjustment_type:  (e.type || null) as LinkedProduct['cost_adjustment_type'],
        cost_adjustment_value: e.type ? Number(e.value) || 0 : null,
        unit_cost:             res.unit_cost,
      } : x))
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2 mb-1">
        <Package size={15} className="text-zinc-500" />
        <h4 className="text-sm font-semibold">Produtos vinculados</h4>
        <span className="text-xs text-zinc-600">({rows.length})</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Custo = preço da Cinderella menos o ajuste. Sem ajuste próprio, usa o desconto geral.
      </p>

      {err && <div className="mb-3 text-xs text-red-400">{err}</div>}

      {loading && <div className="text-xs text-zinc-600 py-4 text-center">Carregando…</div>}

      {!loading && rows.length === 0 && (
        <div className="text-xs text-zinc-600 py-6 text-center">
          Nenhum produto vinculado ainda — sincronize itens no catálogo acima.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#0a0a0c', color: '#71717a' }}>
                <th className="text-left px-3 py-2 font-medium">Produto</th>
                <th className="text-right px-2 py-2 font-medium">Preço Cinderella</th>
                <th className="text-left px-2 py-2 font-medium">Ajuste</th>
                <th className="text-right px-2 py-2 font-medium">Custo líquido</th>
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e = edits[r.id] ?? { type: '', value: '' }
                const dirty = isDirty(r)
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #1c1c1f' }}>
                    <td className="px-3 py-2">
                      <div className="text-zinc-200 truncate max-w-[260px]">{r.name ?? r.sku}</div>
                      <div className="text-zinc-600 font-mono text-[10px]">{r.sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-zinc-400">{fmtBrl(r.supplier_gross_price)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={e.type}
                          onChange={ev => setEdits(m => ({ ...m, [r.id]: { ...e, type: ev.target.value } }))}
                          className="px-2 py-1 rounded border outline-none focus:border-cyan-500/60 text-[11px]"
                          style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}>
                          <option value="">Desconto geral</option>
                          <option value="percent">Percentual %</option>
                          <option value="fixed">Valor fixo R$</option>
                          <option value="override">Preço manual R$</option>
                        </select>
                        {e.type && (
                          <input
                            type="number" min={0} step="0.01"
                            value={e.value}
                            onChange={ev => setEdits(m => ({ ...m, [r.id]: { ...e, value: ev.target.value } }))}
                            className="w-20 px-2 py-1 rounded border outline-none focus:border-cyan-500/60 text-[11px] tabular-nums"
                            style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-emerald-400">{fmtBrl(r.unit_cost)}</td>
                    <td className="px-2 py-2 text-right">
                      {dirty && (
                        <button onClick={() => save(r)} disabled={savingId === r.id}
                          className="px-2.5 py-1 rounded text-[11px] font-semibold transition-all disabled:opacity-40"
                          style={{ background: '#00E5FF', color: '#000' }}>
                          {savingId === r.id ? '…' : 'Salvar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── pequenos componentes ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'synced' | 'available' | 'new' }) {
  const map = {
    synced:    { label: 'Sincronizado', color: '#34d399' },
    available: { label: 'Disponível',   color: '#00E5FF' },
    new:       { label: 'Sem cadastro', color: '#71717a' },
  } as const
  const s = map[status]
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}40` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 py-1.5 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #27272a' }}>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value.toLocaleString('pt-BR')}</span>
      <span className="ml-1.5 text-[11px] text-zinc-500">{label}</span>
    </div>
  )
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all"
      style={active
        ? { background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: '#00E5FF' }
        : { background: 'transparent', borderColor: '#3f3f46', color: '#a1a1aa' }}>
      {children}
    </button>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'emerald' | 'red' | 'amber' }) {
  const C = { emerald: '#34d399', red: '#f87171', amber: '#f59e0b' } as const
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid #27272a' }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold mt-0.5" style={{ color: color ? C[color] : '#e4e4e7' }}>{value}</div>
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
