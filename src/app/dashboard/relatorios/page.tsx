'use client'

import { useState, useCallback } from 'react'
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

type ReportKey = 'vendas' | 'financeiro' | 'produtos' | 'estoque'

type ReportDef = {
  key:         ReportKey
  title:       string
  description: string
  icon:        React.ReactNode
  color:       string
  useDateRange: boolean
}

const REPORTS: ReportDef[] = [
  {
    key: 'vendas',
    title: 'Relatório de Vendas',
    description: 'Pedidos do período com produto, quantidade, valor e status de envio.',
    icon: <BarChart3 size={20} />,
    color: '#00E5FF',
    useDateRange: true,
  },
  {
    key: 'financeiro',
    title: 'DRE Detalhado',
    description: 'Faturamento, tarifas, frete, custos e margem de contribuição por pedido.',
    icon: <FileText size={20} />,
    color: '#4ade80',
    useDateRange: true,
  },
  {
    key: 'produtos',
    title: 'Catálogo de Produtos',
    description: 'Todos os produtos com SKU, preço, custo, margem e status.',
    icon: <Package size={20} />,
    color: '#a78bfa',
    useDateRange: false,
  },
  {
    key: 'estoque',
    title: 'Posição de Estoque',
    description: 'Estoque físico, virtual, mínimos e status por produto.',
    icon: <Layers size={20} />,
    color: '#fb923c',
    useDateRange: false,
  },
]

// ── CSV generators ────────────────────────────────────────────────────────────

async function buildVendasCsv(token: string, dateFrom: string, dateTo: string): Promise<string> {
  const qs = new URLSearchParams({
    date_from: new Date(dateFrom).toISOString(),
    date_to:   new Date(dateTo + 'T23:59:59').toISOString(),
  })
  const res = await fetch(`${BACKEND}/ml/financial-summary?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Erro ao buscar dados de vendas')
  const { orders = [] } = await res.json()

  const header = toCsvRow(['Data','Conta','ID Pedido','Título','SKU','Status','Frete','Qtd','Valor Unit.','Faturamento ML'])
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

async function buildFinanceiroCsv(token: string, dateFrom: string, dateTo: string): Promise<string> {
  const qs = new URLSearchParams({
    date_from: new Date(dateFrom).toISOString(),
    date_to:   new Date(dateTo + 'T23:59:59').toISOString(),
  })
  const res = await fetch(`${BACKEND}/ml/financial-summary?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Erro ao buscar dados financeiros')
  const { orders = [], kpis } = await res.json()

  const header = toCsvRow(['Data','Conta','Título','SKU','Status','Qtd','Faturamento ML',
    'Custo','Imposto','Tarifa ML','Frete Comprador','Frete Vendedor','Margem Contrib.','MC %'])
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
    toCsvRow(['RESUMO DO PERÍODO','']),
    toCsvRow(['Faturamento ML',       kpis.faturamento_ml]),
    toCsvRow(['Vendas Aprovadas',     kpis.vendas_aprovadas]),
    toCsvRow(['Custo Total',          kpis.custo_total]),
    toCsvRow(['Imposto Total',        kpis.imposto_total]),
    toCsvRow(['Tarifa Total',         kpis.tarifa_total]),
    toCsvRow(['Frete Total',          kpis.frete_total]),
    toCsvRow(['Margem de Contribuição', kpis.margem_contribuicao]),
    toCsvRow(['Margem %',             `${kpis.margem_pct?.toFixed(2)}%`]),
  ] : []

  return [header, ...rows, ...summary].join('\n')
}

async function buildProdutosCsv(token: string): Promise<string> {
  const res = await fetch(`${BACKEND}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Erro ao buscar produtos')
  const products: any[] = await res.json()

  const header = toCsvRow(['Nome','SKU','Status','Preço','Custo','Imposto %',
    'Margem Estimada %','Estoque','Plataformas','Anúncio ML','Tipo ML','Frete Grátis','ID'])
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
      p.ml_free_shipping ? 'Sim' : 'Não',
      p.id,
    ])
  })
  return [header, ...rows].join('\n')
}

async function buildEstoqueCsv(token: string): Promise<string> {
  const sb = createClient()
  const [prodRes, { data: stocks }] = await Promise.all([
    fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${token}` } }),
    sb.from('product_stock').select('product_id,quantity,virtual_quantity,min_stock_to_pause,auto_pause_enabled,updated_at').is('platform', null),
  ])
  if (!prodRes.ok) throw new Error('Erro ao buscar produtos')
  const products: any[] = await prodRes.json()

  const stockMap = new Map((stocks ?? []).map((s: any) => [s.product_id, s]))

  const header = toCsvRow(['Nome','SKU','Estoque Físico','Estoque Virtual','Total Plataforma',
    'Mín. Estoque','Auto-pausa','Status','Atualizado em'])
  const rows = products.map(p => {
    const s      = stockMap.get(p.id)
    const qty    = s?.quantity         ?? (p.stock ?? 0)
    const vQty   = s?.virtual_quantity ?? 0
    const minQty = s?.min_stock_to_pause ?? 0
    const alert  = qty === 0 ? 'Sem estoque' : (minQty > 0 && qty <= minQty ? 'Crítico' : (minQty > 0 && qty <= minQty * 1.5 ? 'Baixo' : 'OK'))
    return toCsvRow([
      p.name,
      p.sku ?? '',
      qty,
      vQty,
      qty + vQty,
      minQty || '',
      s?.auto_pause_enabled ? 'Sim' : 'Não',
      alert,
      s?.updated_at ? new Date(s.updated_at).toLocaleDateString('pt-BR') : '',
    ])
  })
  return [header, ...rows].join('\n')
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Generated = { key: ReportKey; filename: string; at: string }

export default function RelatoriosPage() {
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
      if (!token) throw new Error('Sessão expirada')

      let csv  = ''
      let name = ''
      const now = new Date()
      const label = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

      if (selected === 'vendas') {
        csv  = await buildVendasCsv(token, dateFrom, dateTo)
        name = `vendas-${dateFrom}-${dateTo}.csv`
      } else if (selected === 'financeiro') {
        csv  = await buildFinanceiroCsv(token, dateFrom, dateTo)
        name = `dre-${dateFrom}-${dateTo}.csv`
      } else if (selected === 'produtos') {
        csv  = await buildProdutosCsv(token)
        name = `catalogo-${now.toISOString().slice(0,10)}.csv`
      } else {
        csv  = await buildEstoqueCsv(token)
        name = `estoque-${now.toISOString().slice(0,10)}.csv`
      }

      downloadCsv(csv, name)

      setRecent(prev => [
        { key: selected, filename: name, at: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
        ...prev.slice(0, 4),
      ])
    } catch (e: any) {
      setError(e.message ?? 'Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }, [selected, dateFrom, dateTo, status])

  // ── render ──────────────────────────────────────────────────────────────────

  const inp = 'rounded-lg px-3 py-2 text-xs text-white outline-none transition-all'
  const inpStyle = { background: '#1c1c1f', border: '1px solid #3f3f46' }

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs">Dashboard</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">Relatórios</h2>
        <p className="text-zinc-500 text-xs mt-1">Gere e baixe relatórios em CSV para análise ou contabilidade.</p>
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
                      <p className="text-sm font-semibold" style={{ color: selected === r.key ? r.color : '#e4e4e7' }}>{r.title}</p>
                      {selected === r.key && <CheckCircle2 size={13} style={{ color: r.color, flexShrink: 0 }} />}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{r.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Config panel */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-white font-semibold text-sm">{selectedDef.title}</h3>

            {selectedDef.useDateRange ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">Data início</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                    onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">Data fim</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className={inp} style={inpStyle}
                    onFocus={e => (e.target.style.borderColor = '#00E5FF')}
                    onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
                </div>
                {selected === 'financeiro' && (
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-1.5">Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                      className={inp + ' cursor-pointer w-full'} style={inpStyle}>
                      <option value="all">Todos</option>
                      <option value="paid">Aprovados</option>
                      <option value="cancelled">Cancelados</option>
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                {selected === 'produtos'
                  ? 'Inclui todos os produtos do catálogo com preços, custos e status atuais.'
                  : 'Inclui posição de estoque atual de todos os produtos, com mínimos e configurações.'}
              </p>
            )}

            {/* Preview info */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <span style={{ color: selectedDef.color }}>✦</span>
              <p className="text-zinc-400 leading-relaxed">
                {selected === 'vendas'     && `Exporta todos os pedidos entre ${new Date(dateFrom).toLocaleDateString('pt-BR')} e ${new Date(dateTo).toLocaleDateString('pt-BR')} com produto, SKU, status e valores.`}
                {selected === 'financeiro' && `Exporta receita, custos, tarifas, fretes e margem de contribuição por pedido, com resumo totalizador ao final.`}
                {selected === 'produtos'   && 'Exporta o catálogo completo com preços, custos, margem estimada, estoque e status por produto.'}
                {selected === 'estoque'    && 'Exporta estoque físico, virtual, totais por plataforma, mínimos e configuração de auto-pausa.'}
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button onClick={generate} disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: selectedDef.color, color: '#000' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Gerando…</>
                : <><Download size={15} /> Gerar e baixar CSV</>
              }
            </button>
          </div>
        </div>

        {/* Right: recent + tips */}
        <div className="space-y-4">

          {/* Recent */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Gerados nesta sessão</h3>
            {recent.length === 0 ? (
              <p className="text-xs text-zinc-600">Nenhum relatório gerado ainda.</p>
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
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Dicas</h3>
            <ul className="space-y-2.5">
              {[
                { icon: '📊', text: 'Use o DRE Detalhado para enviar ao contador com resumo totalizador.' },
                { icon: '📦', text: 'O relatório de estoque reflete a posição atual — gere antes de fazer pedido de compra.' },
                { icon: '📅', text: 'Para análise mensal, selecione do dia 1 ao último dia do mês.' },
                { icon: '🔢', text: 'Arquivos CSV incluem BOM UTF-8 para compatibilidade com Excel.' },
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
