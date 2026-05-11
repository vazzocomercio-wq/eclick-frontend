'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, ExternalLink, Bot, Lock, Play, Pause, Settings, X,
  CheckCircle2, AlertCircle, Activity,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface AutomationRow {
  id: string
  ml_item_id: string
  product_id: string | null
  available_rules: Array<{ rule_id: string }>
  is_automated: boolean
  active_rule: string | null
  automation_status: 'ACTIVE' | 'PAUSED' | null
  pause_cause: string | null
  pause_message: string | null
  min_price: number | null
  max_price: number | null
  internal_recommendation: 'activate' | 'configure_limits' | 'review_pause' | 'unpause' | 'no_action' | 'consider_disable' | null
  recommendation_reason: string | null
  blocks_manual_edit: boolean
  updated_at: string
}

type Filter = 'all' | 'eligible' | 'active' | 'paused'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AutomationPage() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [rows, setRows]     = useState<AutomationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [configModal, setConfigModal] = useState<{ row: AutomationRow; min: number; max: number; ruleId: 'INT' | 'INT_EXT'; activating: boolean } | null>(null)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `&seller_id=${sellerId}` : ''
      const res = await fetch(`${BACKEND}/listings/pricing/automation?filter=${filter}&limit=200${sellerQs}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setRows(Array.isArray(body) ? body : [])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro ao carregar', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, filter, toast])

  useEffect(() => { load() }, [load])

  const runScan = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: 'Selecione uma conta ML', tone: 'error' })
      return
    }
    setScanning(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/scan/automation`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      toast({ message: `Scan automation · ${r.items_scanned} items, +${r.tasks_created} tarefas`, tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const op = async (action: 'activate' | 'pause' | 'configure' | 'disable', row: AutomationRow, body: Record<string, unknown> = {}) => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) { toast({ message: 'Sem conta', tone: 'error' }); return }
    setBusy(prev => new Set(prev).add(row.ml_item_id))
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/pricing/automation/${row.ml_item_id}/${action}`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)
      toast({ message: `${action === 'activate' ? 'Automação ativada' : action === 'pause' ? 'Pausada' : action === 'configure' ? 'Limites configurados' : 'Desativada'}`, tone: 'success' })
      setConfigModal(null)
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.ml_item_id); return n })
    }
  }

  const automatedCount = rows.filter(r => r.is_automated).length
  const eligibleCount  = rows.filter(r => !r.is_automated && r.available_rules.length > 0).length
  const blockedCount   = rows.filter(r => r.blocks_manual_edit).length

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />

      <div>
        <Link href="/dashboard/listings/pricing"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> Voltar para Pricing IA
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Listing Center · Automação de preço</p>
            <h1 className="text-white text-3xl font-semibold">Pricing Automation IA</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {rows.length > 0
                ? `${automatedCount} automatizados · ${eligibleCount} elegíveis · ${blockedCount} bloqueiam edição manual`
                : 'Rode o scan pra ver status de automação'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={runScan} disabled={scanning}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> Rodar scan automation
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <section className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <FilterChip label="Todos"        active={filter === 'all'}      onClick={() => setFilter('all')} />
        <FilterChip label="Elegíveis"    active={filter === 'eligible'} onClick={() => setFilter('eligible')} color="#3b82f6" />
        <FilterChip label="Ativos"        active={filter === 'active'}   onClick={() => setFilter('active')} color="#22c55e" />
        <FilterChip label="Pausados"     active={filter === 'paused'}   onClick={() => setFilter('paused')} color="#f59e0b" />
      </section>

      {/* Lista */}
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <Bot size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Nada por aqui</p>
          <p className="text-zinc-600 text-xs mt-1">Rode o scan ou troque o filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <AutomationCard
              key={r.id}
              row={r}
              busy={busy.has(r.ml_item_id)}
              onActivate={() => setConfigModal({ row: r, min: 0, max: 0, ruleId: 'INT', activating: true })}
              onPause={() => op('pause', r)}
              onUnpause={() => op('activate', r, { rule_id: r.active_rule ?? 'INT' })}
              onConfigure={() => setConfigModal({ row: r, min: r.min_price ?? 0, max: r.max_price ?? 0, ruleId: (r.active_rule as 'INT' | 'INT_EXT') ?? 'INT', activating: false })}
              onDisable={() => op('disable', r)}
            />
          ))}
        </div>
      )}

      {/* Modal config */}
      {configModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setConfigModal(null)}>
          <div onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 max-w-md w-full" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <h3 className="text-white text-lg font-semibold mb-1">
              {configModal.activating ? 'Ativar automação' : 'Configurar limites'}
            </h3>
            <p className="text-zinc-500 text-xs font-mono mb-4">{configModal.row.ml_item_id}</p>

            {configModal.activating && (
              <div className="mb-4">
                <label className="text-xs text-zinc-400 block mb-1">Regra ML</label>
                <select value={configModal.ruleId} onChange={e => setConfigModal(m => m ? { ...m, ruleId: e.target.value as 'INT' | 'INT_EXT' } : null)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200">
                  <option value="INT">INT — Preço competitivo dentro do ML</option>
                  <option value="INT_EXT">INT_EXT — Melhor preço dentro + fora do ML</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Preço mínimo</label>
                <input type="number" step="0.01" value={configModal.min}
                  onChange={e => setConfigModal(m => m ? { ...m, min: Number(e.target.value) } : null)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Preço máximo</label>
                <input type="number" step="0.01" value={configModal.max}
                  onChange={e => setConfigModal(m => m ? { ...m, max: Number(e.target.value) } : null)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setConfigModal(null)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (configModal.activating) {
                    op('activate', configModal.row, {
                      rule_id: configModal.ruleId,
                      min_price: configModal.min || undefined,
                      max_price: configModal.max || undefined,
                    })
                  } else {
                    op('configure', configModal.row, { min_price: configModal.min, max_price: configModal.max })
                  }
                }}
                disabled={configModal.min <= 0 || configModal.max <= configModal.min || busy.has(configModal.row.ml_item_id)}
                className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#00E5FF', color: '#0d0d10' }}>
                {configModal.activating ? 'Ativar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
      style={active
        ? { background: color ? `${color}20` : 'rgba(0,229,255,0.15)', border: `1px solid ${color ?? '#00E5FF'}40`, color: color ?? '#00E5FF' }
        : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
      {label}
    </button>
  )
}

function AutomationCard({ row, busy, onActivate, onPause, onUnpause, onConfigure, onDisable }: {
  row: AutomationRow
  busy: boolean
  onActivate: () => void
  onPause: () => void
  onUnpause: () => void
  onConfigure: () => void
  onDisable: () => void
}) {
  const statusInfo =
    row.is_automated && row.automation_status === 'ACTIVE' ? { label: 'Ativa', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: Activity } :
    row.is_automated && row.automation_status === 'PAUSED' ? { label: 'Pausada', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Pause } :
    row.available_rules.length > 0                          ? { label: 'Elegível', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: CheckCircle2 } :
    { label: 'Sem regras', color: '#71717a', bg: 'rgba(113,113,122,0.1)', icon: AlertCircle }
  const StatusIcon = statusInfo.icon

  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f', borderLeft: `3px solid ${statusInfo.color}` }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"
            style={{ background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.color}40` }}>
            <StatusIcon size={11} /> {statusInfo.label}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link href={`/dashboard/listings/items/${row.ml_item_id}`}
              className="font-mono text-zinc-200 font-semibold text-sm hover:text-cyan-400">
              {row.ml_item_id}
            </Link>
            <a href={`https://www.mercadolivre.com.br/${row.ml_item_id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
              ML <ExternalLink size={9} />
            </a>
            {row.blocks_manual_edit && (
              <span className="text-[9px] flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Lock size={9} /> Bloqueia edição manual
              </span>
            )}
          </div>

          {row.is_automated && (
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
              <span>Regra: <span className="font-mono text-cyan-400">{row.active_rule}</span></span>
              {row.min_price != null && row.max_price != null && (
                <span>Limites: {brl(row.min_price)} – {brl(row.max_price)}</span>
              )}
              {row.pause_cause && (
                <span className="text-amber-400">Pausa: {row.pause_cause}</span>
              )}
            </div>
          )}
          {!row.is_automated && row.available_rules.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              Regras disponíveis: {row.available_rules.map(r => r.rule_id).join(' · ')}
            </p>
          )}
          {row.recommendation_reason && row.internal_recommendation !== 'no_action' && (
            <p className="text-[11px] text-cyan-300 mt-1.5 italic">💡 {row.recommendation_reason}</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-1">
          {!row.is_automated && row.available_rules.length > 0 && (
            <button onClick={onActivate} disabled={busy}
              className="text-[10px] px-2.5 py-1.5 rounded font-semibold flex items-center gap-1 disabled:opacity-50"
              style={{ background: '#22c55e', color: '#0d0d10' }}>
              <Play size={10} /> Ativar
            </button>
          )}
          {row.is_automated && row.automation_status === 'ACTIVE' && (
            <>
              <button onClick={onConfigure} disabled={busy}
                className="text-[10px] px-2 py-1 rounded text-cyan-400 hover:bg-zinc-800 flex items-center gap-1">
                <Settings size={10} /> Limites
              </button>
              <button onClick={onPause} disabled={busy}
                className="text-[10px] px-2 py-1 rounded text-amber-400 hover:bg-zinc-800 flex items-center gap-1">
                <Pause size={10} /> Pausar
              </button>
            </>
          )}
          {row.is_automated && row.automation_status === 'PAUSED' && (
            <button onClick={onUnpause} disabled={busy}
              className="text-[10px] px-2 py-1 rounded text-emerald-400 hover:bg-zinc-800 flex items-center gap-1">
              <Play size={10} /> Retomar
            </button>
          )}
          {row.is_automated && (
            <button onClick={onDisable} disabled={busy}
              className="text-[10px] px-2 py-1 rounded text-rose-400 hover:bg-zinc-800 flex items-center gap-1">
              <X size={10} /> Desativar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
