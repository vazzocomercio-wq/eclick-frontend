'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { Download, FileText, BarChart3, Package, Layers, CheckCircle2, Loader2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function todayStr()      { return new Date().toISOString().slice(0, 10) }
function monthStartStr() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function toCsvRow(vals: (string | number | null | undefined)[]) {
  return vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
}

// ── Report definitions ────────────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>

type ReportKey = 'vendas' | 'financeiro' | 'produtos' | 'estoque'

type ReportDef = {
  key:         ReportKey
  icon:        React.ReactNode
  color:       string
  useDateRange: boolean
}

const REPORTS: ReportDef[] = [
  { key: 'vendas',     icon: <BarChart3 size={20} />, color: '#00E5FF', useDateRange: true },
  { key: 'financeiro', icon: <FileText size={20} />,  color: '#4ade80', useDateRange: true },
  { key: 'produtos',   icon: <Package size={20} />,   color: '#a78bfa', useDateRange: false },
  { key: 'estoque',    icon: <Layers size={20} />,    color: '#fb923c', useDateRange: false },
]

// ── CSV generators ────────────────────────────────────────────────────────────

async function buildVendasCsv(token: string, dateFrom: string, dateTo: string, t: Translator): Promise<string> {
  const qs = new URLSearchParams({
    date_from: new Date(dateFrom).toISOString(),
    date_to:   new Date(dateTo + 'T23:59:59').toISOString(),
  })
  const res = await fetch(`${BACKEND}/ml/financial-summary?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(t('errorFetchSales'))
  const { orders = [] } = await res.json()

  const header = toCsvRow([
    t('csv.date'), t('csv.account'), t('csv.orderId'), t('csv.title'), t('csv.sku'),
    t('csv.status'), t('csv.shipping'), t('csv.qty'), t('csv.unitPrice'), t('csv.mlRevenue'),
  ])
  const rows   = orders.map((o: any) => toCsvRow([
    new Date(o.date_created).toLocaleDateString('pt-BR'),
    o.account_nickname,
    o.order_id,
    o.title,
    o.sku,
    o.status,
    o.shipping_type,
    o.quantity,
    o.unit_price,
    o.total_amount,
  ]))
  return [header, ...rows].join('\n')
}

async function buildFinanceiroCsv(token: string, dateFrom: string, dateTo: string, t: Translator): Promise<string> {
  const qs = new URLSearchParams({
    date_from: new Date(dateFrom).toISOString(),
    date_to:   new Date(dateTo + 'T23:59:59').toISOString(),
  })
  const res = await fetch(`${BACKEND}/ml/financial-summary?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(t('errorFetchFinancial'))
  const { orders = [], kpis } = await res.json()

  const header = toCsvRow([
    t('csv.date'), t('csv.account'), t('csv.title'), t('csv.sku'), t('csv.status'), t('csv.qty'), t('csv.mlRevenue'),
    t('csv.cost'), t('csv.tax'), t('csv.mlFee'), t('csv.buyerShipping'), t('csv.sellerShipping'), t('csv.contributionMargin'), t('csv.mcPct'),
  ])
  const rows = orders.map((o: any) => toCsvRow([
    new Date(o.date_created).toLocaleDateString('pt-BR'),
    o.account_nickname,
    o.title,
    o.sku,
    o.status,
    o.quantity,
    o.total_amount,
    o.cost_price ?? '',
    o.tax_amount ?? '',
    o.tarifa_ml,
    o.frete_comprador,
    o.frete_vendedor,
    o.contribution_margin ?? '',
    o.contribution_margin_pct != null ? `${o.contribution_margin_pct.toFixed(2)}%` : '',
  ]))

  // Append KPI summary block
  const summary = kpis ? [
    '',
    toCsvRow([t('csv.periodSummary'),'']),
    toCsvRow([t('csv.mlRevenue'),         kpis.faturamento_ml]),
    toCsvRow([t('csv.approvedSales'),     kpis.vendas_aprovadas]),
    toCsvRow([t('csv.totalCost'),         kpis.custo_total]),
    toCsvRow([t('csv.totalTax'),          kpis.imposto_total]),
    toCsvRow([t('csv.totalFee'),          kpis.tarifa_total]),
    toCsvRow([t('csv.totalShipping'),     kpis.frete_total]),
    toCsvRow([t('csv.contributionMargin'), kpis.margem_contribuicao]),
    toCsvRow([t('csv.marginPct'),         `${kpis.margem_pct?.toFixed(2)}%`]),
  ] : []

  return [header, ...rows, ...summary].join('\n')
}

async function buildProdutosCsv(token: string, t: Translator): Promise<string> {
  const res = await fetch(`${BACKEND}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(t('errorFetchProducts'))
  const products: any[] = await res.json()

  const header = toCsvRow([
    t('csv.name'), t('csv.sku'), t('csv.status'), t('csv.price'), t('csv.cost'), t('csv.taxPct'),
    t('csv.estimatedMarginPct'), t('csv.stock'), t('csv.platforms'), t('csv.mlListing'), t('csv.mlType'), t('csv.freeShipping'), t('csv.id'),
  ])
  const rows = products.map(p => {
    const price = p.price ?? 0
    const cost  = p.cost_price ?? 0
    const tax   = p.tax_percentage ?? 0
    const margin = price > 0 ? (((price * (1 - tax / 100)) - cost) / (price * (1 - tax / 100))) * 100 : 0
    return toCsvRow([
      p.name,
      p.sku ?? '',
      p.status,
      price,
      cost,
      tax,
      price > 0 ? margin.toFixed(2) : '',
      p.stock ?? '',
      (p.platforms ?? []).join(';'),
      p.ml_listing_id ?? '',
      p.ml_listing_type ?? '',
      p.ml_free_shipping ? t('csv.yes') : t('csv.no'),
      p.id,
    ])
  })
  return [header, ...rows].join('\n')
}

async function buildEstoqueCsv(token: string, t: Translator): Promise<string> {
  const sb = createClient()
  const [prodRes, { data: stocks }] = await Promise.all([
    fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${token}` } }),
    sb.from('product_stock').select('product_id,quantity,virtual_quantity,min_stock_to_pause,auto_pause_enabled,updated_at').is('platform', null),
  ])
  if (!prodRes.ok) throw new Error(t('errorFetchProducts'))
  const products: any[] = await prodRes.json()

  const stockMap = new Map((stocks ?? []).map((s: any) => [s.product_id, s]))

  const header = toCsvRow([
    t('csv.name'), t('csv.sku'), t('csv.physicalStock'), t('csv.virtualStock'), t('csv.platformTotal'),
    t('csv.minStock'), t('csv.autoPause'), t('csv.status'), t('csv.updatedAt'),
  ])
  const rows = products.map(p => {
    const s      = stockMap.get(p.id)
    const qty    = s?.quantity         ?? (p.stock ?? 0)
    const vQty   = s?.virtual_quantity ?? 0
    const minQty = s?.min_stock_to_pause ?? 0
    const alert  = qty === 0 ? t('csv.stockOut') : (minQty > 0 && qty <= minQty ? t('csv.stockCritical') : (minQty > 0 && qty <= minQty * 1.5 ? t('csv.stockLow') : t('csv.stockOk')))
    return toCsvRow([
      p.name,
      p.sku ?? '',
      qty,
      vQty,
      qty + vQty,
      minQty || '',
      s?.auto_pause_enabled ? t('csv.yes') : t('csv.no'),
      alert,
      s?.updated_at ? new Date(s.updated_at).toLocaleDateString('pt-BR') : '',
    ])
  })
  return [header, ...rows].join('\n')
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Generated = { key: ReportKey; filename: string; at: string }

export default function RelatoriosPage() {
  const t = useTranslations('relatorios')
  const [selected, setSelected] = useState<ReportKey>('vendas')
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo,   setDateTo]   = useState(todayStr())
  const [status,   setStatus]   = useState('all')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [recent,   setRecent]   = useState<Generated[]>([])

  const selectedDef = REPORTS.find(r => r.key === selected)!

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error(t('errorSessionExpired'))

      let csv  = ''
      let name = ''
      const now = new Date()

      if (selected === 'vendas') {
        csv  = await buildVendasCsv(token, dateFrom, dateTo, t)
        name = `vendas-${dateFrom}-${dateTo}.csv`
      } else if (selected === 'financeiro') {
        csv  = await buildFinanceiroCsv(token, dateFrom, dateTo, t)
        name = `dre-${dateFrom}-${dateTo}.csv`
      } else if (selected === 'produtos') {
        csv  = await buildProdutosCsv(token, t)
        name = `catalogo-${now.toISOString().slice(0,10)}.csv`
      } else {
        csv  = await buildEstoqueCsv(token, t)
        name = `estoque-${now.toISOString().slice(0,10)}.csv`
      }

      downloadCsv(csv, name)

      setRecent(prev => [
        { key: selected, filename: name, at: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
        ...prev.slice(0, 4),
      ])
    } catch (e: any) {
      setError(e.message ?? t('errorGenerate'))
    } finally {
      setLoading(false)
    }
  }, [selected, dateFrom, dateTo, status, t])

  // ── render ──────────────────────────────────────────────────────────────────

  const inp = 'rounded-lg px-3 py-2 text-xs text-white outline-none transition-all'
  const inpStyle = { background: '#1c1c1f', border: '1px solid #3f3f46' }

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">{t('title')}</h2>
        <p className="text-zinc-500 text-xs mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: report picker + config */}
        <div className="xl:col-span-2 space-y-4">

          {/* Report type cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REPORTS.map(r => (
              <button key={r.key} onClick={() => setSelected(r.key)}
                className="text-left p-4 rounded-2xl transition-all"
                style={{
                  background: selected === r.key ? `${r.color}10` : '#111114',
                  border: `1px solid ${selected === r.key ? r.color + '40' : '#1e1e24'}`,
                }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                    style={{ background: `${r.color}15`, color: r.color }}>
                    {r.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: selected === r.key ? r.color : '#e4e4e7' }}>{t(`reports.${r.key}.title`)}</p>
                      {selected === r.key && <CheckCircle2 size={13} style={{ color: r.color, flexShrink: 0 }} />}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{t(`reports.${r.key}.description`)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Config panel */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-white font-semibold text-sm">{t(`reports.${selectedDef.key}.title`)}</h3>

            {selectedDef.useDateRange ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">{t('dateFrom')}</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                    onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">{t('dateTo')}</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                    onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
                </div>
                {selected === 'financeiro' && (
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">{t('statusLabel')}</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                      className={inp + ' cursor-pointer w-full'} style={inpStyle}>
                      <option value="all">{t('statusAll')}</option>
                      <option value="paid">{t('statusApproved')}</option>
                      <option value="cancelled">{t('statusCancelled')}</option>
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                {selected === 'produtos' ? t('noRangeProdutos') : t('noRangeEstoque')}
              </p>
            )}

            {/* Preview info */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <span style={{ color: selectedDef.color }}>✦</span>
              <p className="text-zinc-400 leading-relaxed">
                {selected === 'vendas'     && t('previewVendas', { from: new Date(dateFrom).toLocaleDateString('pt-BR'), to: new Date(dateTo).toLocaleDateString('pt-BR') })}
                {selected === 'financeiro' && t('previewFinanceiro')}
                {selected === 'produtos'   && t('previewProdutos')}
                {selected === 'estoque'    && t('previewEstoque')}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button onClick={generate} disabled={loading}
              className="glow-rainbow flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: selectedDef.color, color: '#000' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> {t('generating')}</>
                : <><Download size={15} /> {t('generateButton')}</>
              }
            </button>
          </div>
        </div>

        {/* Right: recent + tips */}
        <div className="space-y-4">

          {/* Recent */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{t('generatedThisSession')}</h3>
            {recent.length === 0 ? (
              <p className="text-xs text-zinc-600">{t('noReportsYet')}</p>
            ) : (
              recent.map((r, i) => {
                const def = REPORTS.find(d => d.key === r.key)!
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ background: `${def.color}15`, color: def.color }}>
                      {def.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 truncate font-medium">{r.filename}</p>
                      <p className="text-[10px] text-zinc-600">{r.at}</p>
                    </div>
                    <CheckCircle2 size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                  </div>
                )
              })
            )}
          </div>

          {/* Tips */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{t('tipsTitle')}</h3>
            <ul className="space-y-2.5">
              {[
                { icon: '📊', text: t('tip1') },
                { icon: '📦', text: t('tip2') },
                { icon: '📅', text: t('tip3') },
                { icon: '🔢', text: t('tip4') },
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-500 leading-relaxed">
                  <span className="shrink-0 text-sm">{tip.icon}</span>
                  {tip.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
