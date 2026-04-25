'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number, base: number) => base > 0 ? `${((v / base) * 100).toFixed(1)}%` : '—'

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type Kpis = {
  faturamento_ml: number
  tarifa_total: number
  frete_vendedor: number
  vendas_aprovadas: number
  custo_total: number
  imposto_total: number
  margem_contribuicao: number
  margem_pct: number
  canceladas: number
  qtd_aprovadas: number
  qtd_canceladas: number
  ticket_medio: number
  ticket_medio_mc: number
}

// ── period helpers ────────────────────────────────────────────────────────────

type PeriodId = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom'

function getPeriod(id: PeriodId, custom?: { from: string; to: string }) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (id) {
    case 'this_month':
      return {
        from: new Date(y, m, 1).toISOString().slice(0, 10),
        to:   now.toISOString().slice(0, 10),
      }
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      const lastDay = new Date(ly, lm + 1, 0)
      return {
        from: new Date(ly, lm, 1).toISOString().slice(0, 10),
        to:   lastDay.toISOString().slice(0, 10),
      }
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3)
      return {
        from: new Date(y, q * 3, 1).toISOString().slice(0, 10),
        to:   now.toISOString().slice(0, 10),
      }
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3)
      const lq = q === 0 ? 3 : q - 1
      const lqy = q === 0 ? y - 1 : y
      const lastDay = new Date(lqy, lq * 3 + 3, 0)
      return {
        from: new Date(lqy, lq * 3, 1).toISOString().slice(0, 10),
        to:   lastDay.toISOString().slice(0, 10),
      }
    }
    case 'this_year':
      return {
        from: new Date(y, 0, 1).toISOString().slice(0, 10),
        to:   now.toISOString().slice(0, 10),
      }
    case 'custom':
      return custom ?? { from: new Date(y, m, 1).toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }
}

const PERIOD_LABELS: Record<PeriodId, string> = {
  this_month:   'Este mês',
  last_month:   'Mês passado',
  this_quarter: 'Este trimestre',
  last_quarter: 'Trimestre passado',
  this_year:    'Este ano',
  custom:       'Personalizado',
}

// ── DRE line ──────────────────────────────────────────────────────────────────

function DRELine({
  label, value, base, indent = 0, bold = false, sign = 'neutral', highlight = false, dimIfZero = false,
}: {
  label: string
  value: number
  base: number
  indent?: number
  bold?: boolean
  sign?: 'positive' | 'negative' | 'neutral'
  highlight?: boolean
  dimIfZero?: boolean
}) {
  const color = sign === 'positive'
    ? value >= 0 ? '#34d399' : '#f43f5e'
    : sign === 'negative'
      ? '#f97316'
      : '#e4e4e7'

  const opacity = dimIfZero && value === 0 ? 0.35 : 1

  return (
    <div
      className="flex items-center justify-between py-2.5 px-4 transition-colors"
      style={{
        paddingLeft: 16 + indent * 20,
        background: highlight ? 'rgba(255,255,255,0.04)' : undefined,
        borderTop: highlight ? '1px solid rgba(255,255,255,0.06)' : undefined,
        borderBottom: highlight ? '1px solid rgba(255,255,255,0.06)' : undefined,
        opacity,
      }}
    >
      <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-zinc-400'}`}>{label}</span>
      <div className="flex items-center gap-6 text-right">
        <span className="text-xs text-zinc-600 w-16 text-right tabular-nums">{pct(Math.abs(value), base)}</span>
        <span
          className={`text-sm tabular-nums w-36 text-right ${bold ? 'font-bold' : 'font-medium'}`}
          style={{ color }}
        >
          {sign === 'negative' ? `(${brl(Math.abs(value))})` : brl(value)}
        </span>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.06)' }} />
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{label}</p>
    </div>
  )
}

// ── kpi pill ──────────────────────────────────────────────────────────────────

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2.5 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-[10px] text-zinc-500 whitespace-nowrap">{label}</span>
      <span className="text-base font-bold text-white leading-tight">{value}</span>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DrePage() {
  const [periodId,    setPeriodId]    = useState<PeriodId>('this_month')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [kpis,        setKpis]        = useState<Kpis | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [showCosts,   setShowCosts]   = useState(true)

  const load = useCallback(async (pid: PeriodId = periodId) => {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }
    const { from, to } = getPeriod(pid, { from: customFrom, to: customTo })
    const params = new URLSearchParams({ date_from: from, date_to: to, kpis_only: 'true' })
    try {
      const res = await fetch(`${BACKEND}/ml/financial-summary?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const body = await res.json()
      setKpis(body.kpis)
    } catch {
      setKpis(null)
    }
    setLoading(false)
  }, [periodId, customFrom, customTo])

  useEffect(() => { load() }, [load])

  function applyPeriod(pid: PeriodId) {
    setPeriodId(pid)
    setShowPicker(false)
    load(pid)
  }

  const k = kpis
  const base = k?.faturamento_ml ?? 0

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-6" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">DRE — Demonstrativo de Resultado</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Visão gerencial por competência</p>
        </div>
        <div className="flex items-center gap-2">
          {/* period picker */}
          <div className="relative">
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
            >
              {PERIOD_LABELS[periodId]}
              <ChevronDown size={13} />
            </button>
            {showPicker && (
              <div
                className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-20 py-1"
                style={{ background: '#18181b', border: '1px solid #27272a', minWidth: 200 }}
              >
                {(Object.keys(PERIOD_LABELS) as PeriodId[]).filter(p => p !== 'custom').map(pid => (
                  <button
                    key={pid}
                    onClick={() => applyPeriod(pid)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 transition-colors"
                    style={{ color: periodId === pid ? '#00E5FF' : '#a1a1aa' }}
                  >
                    {PERIOD_LABELS[pid]}
                  </button>
                ))}
                <div className="border-t border-zinc-800 mt-1 pt-1 px-3 pb-2">
                  <p className="text-[10px] text-zinc-600 mb-1.5">Personalizado</p>
                  <div className="flex gap-2">
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-600" />
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-600" />
                  </div>
                  <button
                    onClick={() => { if (customFrom && customTo) applyPeriod('custom') }}
                    className="mt-1.5 w-full text-xs py-1 rounded font-medium transition-all"
                    style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* summary pills */}
      {!loading && k && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiPill label="Vendas aprovadas"  value={String(k.qtd_aprovadas)} />
          <KpiPill label="Ticket médio"      value={brl(k.ticket_medio)} />
          <KpiPill label="MC por pedido"     value={brl(k.ticket_medio_mc)} />
          <KpiPill label="Canceladas"        value={String(k.qtd_canceladas)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-60 text-zinc-600 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Carregando…
        </div>
      ) : !k ? (
        <div className="flex items-center justify-center h-60 text-zinc-500 text-sm">
          ML não conectado ou sem dados no período.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden max-w-3xl"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>

          {/* column headers */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Linha</span>
            <div className="flex items-center gap-6">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide w-16 text-right">% Rec.</span>
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide w-36 text-right">Valor</span>
            </div>
          </div>

          {/* 1. Receita Bruta */}
          <SectionHeader label="Receita" />
          <DRELine label="Receita Bruta (Faturamento ML)"   value={base}  base={base}   bold   highlight />

          {/* 2. Deduções */}
          <SectionHeader label="Deduções da Receita" />
          <DRELine label="Tarifas ML (11,5%)"              value={k.tarifa_total}       base={base} sign="negative" indent={1} />
          <DRELine label="Frete (custo vendedor)"          value={k.frete_vendedor}     base={base} sign="negative" indent={1} dimIfZero />
          <Divider />
          <DRELine label="(=) Receita Líquida"             value={k.vendas_aprovadas}   base={base} bold   highlight
            sign={k.vendas_aprovadas >= 0 ? 'positive' : 'negative'} />

          {/* 3. Custos */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Custos e Despesas</p>
            <button
              onClick={() => setShowCosts(v => !v)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {showCosts ? 'ocultar' : 'mostrar'}
            </button>
          </div>
          {showCosts && (
            <>
              <DRELine label="CPV — Custo dos produtos vendidos" value={k.custo_total}    base={base} sign="negative" indent={1} dimIfZero />
              <DRELine label="Impostos sobre vendas"             value={k.imposto_total}  base={base} sign="negative" indent={1} dimIfZero />
            </>
          )}
          <Divider />

          {/* 4. Resultado */}
          <SectionHeader label="Resultado" />
          <DRELine
            label="(=) Margem de Contribuição"
            value={k.margem_contribuicao}
            base={base}
            bold
            highlight
            sign={k.margem_contribuicao >= 0 ? 'positive' : 'negative'}
          />

          {/* margin bar */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, k.margem_pct))}%`,
                  background: k.margem_pct >= 20 ? '#34d399' : k.margem_pct >= 10 ? '#f59e0b' : '#f43f5e',
                }}
              />
            </div>
            <div className="flex items-center gap-1 text-sm font-bold"
              style={{ color: k.margem_pct >= 20 ? '#34d399' : k.margem_pct >= 10 ? '#f59e0b' : '#f43f5e' }}>
              {k.margem_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {k.margem_pct.toFixed(1)}%
            </div>
          </div>

          {/* cancelled note */}
          {k.canceladas > 0 && (
            <div className="px-4 pb-3">
              <p className="text-[11px] text-zinc-600">
                Pedidos cancelados no período: {brl(k.canceladas)} ({k.qtd_canceladas} pedido{k.qtd_canceladas !== 1 ? 's' : ''}) — não incluídos acima.
              </p>
            </div>
          )}

          {/* zero cost warning */}
          {k.custo_total === 0 && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-xs text-amber-400"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              CPV zerado — cadastre o custo dos produtos em Produtos → editar para ver o resultado real.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
