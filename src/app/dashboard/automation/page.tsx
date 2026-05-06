'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Zap, AlertCircle, AlertTriangle, TrendingUp, TrendingDown, Sparkles,
  Loader2, RefreshCw, Check, X, Settings, Inbox, Calendar, Package,
  Target, MessageCircle,
} from 'lucide-react'
import {
  StoreAutomationApi,
  type StoreAutomationAction,
  type AutomationTrigger,
  type AutomationSeverity,
  type AutomationStatus,
  type AutomationStats,
} from '@/components/store-automation/storeAutomationApi'

const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  low_stock:              'Estoque crítico',
  high_stock:             'Estoque parado',
  sales_drop:             'Queda de vendas',
  sales_spike:            'Aumento de vendas',
  low_conversion:         'Conversão baixa',
  high_conversion:        'Conversão alta',
  competitor_price_drop:  'Concorrente baixou',
  competitor_out_of_stock:'Concorrente sem estoque',
  low_score:              'Score baixo',
  no_content:             'Sem conteúdo',
  no_ads:                 'Sem ads',
  ads_underperforming:    'Ads ROAS baixo',
  abandoned_carts_spike:  'Carrinhos abandonados',
  new_product_ready:      'Produto novo pronto',
  seasonal_opportunity:   'Oportunidade sazonal',
  margin_erosion:         'Erosão de margem',
  review_needed:          'Revisar manualmente',
}

const SEVERITY_COLOR: Record<AutomationSeverity, string> = {
  critical:    '#ef4444',
  high:        '#f97316',
  medium:      '#f59e0b',
  low:         '#71717a',
  opportunity: '#22c55e',
}

const SEVERITY_LABEL: Record<AutomationSeverity, string> = {
  critical:    'crítico',
  high:        'alto',
  medium:      'médio',
  low:         'baixo',
  opportunity: 'oportunidade',
}

export default function AutomationInboxPage() {
  const [items, setItems]   = useState<StoreAutomationAction[] | null>(null)
  const [stats, setStats]   = useState<AutomationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<AutomationStatus | ''>('pending')
  const [filterTrigger, setFilterTrigger] = useState<AutomationTrigger | ''>('')
  const [batch, setBatch]   = useState<string[]>([])

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [list, st] = await Promise.all([
        StoreAutomationApi.list({
          status: filterStatus || undefined,
          trigger_type: filterTrigger || undefined,
          limit: 100,
        }),
        StoreAutomationApi.stats(),
      ])
      setItems(list.items); setStats(st)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterTrigger])

  useEffect(() => { void refresh() }, [refresh])

  async function analyze() {
    setAnalyzing(true); setError(null)
    try {
      const r = await StoreAutomationApi.analyze()
      alert(`Análise: ${r.created} novas ações, ${r.deduped} já existiam`)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function approveBatch() {
    if (batch.length === 0) return
    if (!confirm(`Aprovar ${batch.length} ${batch.length > 1 ? 'ações' : 'ação'}?`)) return
    try {
      const r = await StoreAutomationApi.approveBatch(batch)
      alert(`${r.approved} aprovadas · ${r.failed} falharam`)
      setBatch([])
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Zap size={20} className="text-cyan-400" />
            Automação da Loja
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Inbox de ações que a IA detectou. Revise e aprove — ou configure auto-execução pra triggers confiáveis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/automation/config" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs">
            <Settings size={12} /> Configuração
          </Link>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Analisar agora
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard label="Pendentes" value={stats.pending} icon={<Inbox size={14} className="text-amber-400" />} accent={stats.pending > 0 ? '#f59e0b' : undefined} />
          <StatsCard label="Aprovadas" value={stats.approved} icon={<Check size={14} className="text-emerald-400" />} />
          <StatsCard label="Executadas" value={stats.executed} icon={<Zap size={14} className="text-purple-400" />} />
          <StatsCard label="Rejeitadas" value={stats.rejected} icon={<X size={14} className="text-zinc-500" />} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as AutomationStatus | '')}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-400/60"
        >
          <option value="">Todos status</option>
          {(['pending','approved','executing','completed','auto_executed','rejected','expired','failed'] as const).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterTrigger}
          onChange={e => setFilterTrigger(e.target.value as AutomationTrigger | '')}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-400/60"
        >
          <option value="">Todos triggers</option>
          {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map(t => (
            <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>
          ))}
        </select>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        {batch.length > 0 && (
          <button
            onClick={approveBatch}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-medium"
          >
            <Check size={12} /> Aprovar {batch.length}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {!loading && items?.length === 0 && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] p-8 text-center space-y-2">
          <Check size={28} className="mx-auto text-emerald-400 opacity-80" />
          <p className="text-sm text-zinc-200">Nenhuma ação pendente. Sua loja está em dia! 🎉</p>
          <p className="text-xs text-zinc-500">Análise automática roda diariamente. Você pode forçar agora se quiser.</p>
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map(a => (
            <ActionCard
              key={a.id}
              action={a}
              selected={batch.includes(a.id)}
              onToggle={() => {
                if (a.status !== 'pending') return
                setBatch(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatsCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border bg-zinc-900/40 p-3 space-y-1"
         style={{ borderColor: accent ? `${accent}40` : '#27272a' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#e4e4e7' }}>{value}</p>
    </div>
  )
}

function ActionCard({ action, selected, onToggle, onChanged }: {
  action: StoreAutomationAction
  selected: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function approve() {
    setBusy(true)
    try { await StoreAutomationApi.approve(action.id); onChanged() }
    catch (e) { alert((e as Error).message) }
    finally { setBusy(false) }
  }

  async function reject(feedback: string) {
    setBusy(true)
    try { await StoreAutomationApi.reject(action.id, feedback); onChanged() }
    catch (e) { alert((e as Error).message) }
    finally { setBusy(false) }
  }

  const sev = SEVERITY_COLOR[action.severity]
  const Icon = iconForTrigger(action.trigger_type)

  return (
    <div
      className="rounded-lg border bg-zinc-900/40 hover:border-zinc-700 transition-colors p-3"
      style={{ borderColor: action.status === 'pending' ? `${sev}30` : '#27272a' }}
    >
      <div className="flex items-start gap-3">
        {action.status === 'pending' && (
          <button
            onClick={onToggle}
            className={[
              'w-4 h-4 rounded flex items-center justify-center shrink-0 mt-1 border',
              selected ? 'bg-cyan-400 border-cyan-400' : 'border-zinc-700',
            ].join(' ')}
          >
            {selected && <Check size={10} className="text-black" strokeWidth={3} />}
          </button>
        )}
        <div className="w-9 h-9 rounded flex items-center justify-center shrink-0" style={{ background: `${sev}15` }}>
          <Icon size={16} style={{ color: sev }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap"
                  style={{ borderColor: `${sev}40`, background: `${sev}10`, color: sev }}>
              {SEVERITY_LABEL[action.severity]}
            </span>
            <span className="text-[10px] text-zinc-500">
              {TRIGGER_LABEL[action.trigger_type]}
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500">{new Date(action.created_at).toLocaleDateString('pt-BR')}</span>
            {action.affected_count > 0 && (
              <>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] text-cyan-300">{action.affected_count} produto{action.affected_count > 1 ? 's' : ''}</span>
              </>
            )}
            {action.status !== 'pending' && (
              <span className="text-[10px] text-zinc-500 italic">{action.status}</span>
            )}
          </div>
          <p className="text-sm text-zinc-200 font-medium">{action.title}</p>
          <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">{action.description}</p>

          {/* Proposed action shape — best-effort rendering */}
          <ProposedActionPreview action={action.proposed_action as Record<string, unknown>} />
        </div>

        {action.status === 'pending' && (
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={approve}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black text-xs"
            >
              <Check size={11} /> Aprovar
            </button>
            <button
              onClick={() => {
                const fb = prompt('Por quê está rejeitando? (util / nao_relevante / timing_ruim / acao_errada)') ?? 'nao_relevante'
                void reject(fb)
              }}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-700 hover:border-red-400/40 text-zinc-400 hover:text-red-300 text-xs disabled:opacity-50"
            >
              <X size={11} /> Rejeitar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProposedActionPreview({ action }: { action: Record<string, unknown> }) {
  const t = action.type as string
  if (!t) return null
  return (
    <div className="mt-2 px-2 py-1 rounded bg-zinc-950/60 border border-zinc-800/60 text-[11px] text-zinc-400 font-mono">
      → {t}
      {action.new_price != null && <> · novo preço R$ {Number(action.new_price).toFixed(2)}</>}
      {action.budget != null && <> · budget R$ {Number(action.budget).toFixed(2)}</>}
      {action.platform != null && <> · {action.platform as string}</>}
      {action.suggested_quantity != null && <> · sugerir {action.suggested_quantity as number} un</>}
      {Array.isArray(action.channels) && (action.channels as string[]).length > 0 && (
        <> · {(action.channels as string[]).join(', ')}</>
      )}
    </div>
  )
}

function iconForTrigger(trigger: AutomationTrigger) {
  const map: Record<AutomationTrigger, typeof AlertCircle> = {
    low_stock:               AlertTriangle,
    high_stock:              Package,
    sales_drop:              TrendingDown,
    sales_spike:             TrendingUp,
    low_conversion:          Target,
    high_conversion:         Target,
    competitor_price_drop:   TrendingDown,
    competitor_out_of_stock: Package,
    low_score:               AlertCircle,
    no_content:              Sparkles,
    no_ads:                  Target,
    ads_underperforming:     TrendingDown,
    abandoned_carts_spike:   MessageCircle,
    new_product_ready:       Package,
    seasonal_opportunity:    Calendar,
    margin_erosion:          TrendingDown,
    review_needed:           AlertCircle,
  }
  return map[trigger] ?? AlertCircle
}
