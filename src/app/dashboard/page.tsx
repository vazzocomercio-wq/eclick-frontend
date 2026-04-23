'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const h = 40
  const w = 88
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  )
}

const metrics = [
  {
    label: 'Produtos Monitorados',
    value: '1.247',
    change: '+12%',
    trend: 'up' as const,
    sub: 'SKUs ativos',
    color: '#00E5FF',
    data: [40, 48, 44, 55, 58, 52, 66, 72, 68, 78, 82, 91],
  },
  {
    label: 'Alertas Ativos',
    value: '23',
    change: '+5 hoje',
    trend: 'up' as const,
    sub: 'Aguardando revisão',
    color: '#f59e0b',
    data: [8, 12, 9, 15, 18, 13, 20, 17, 19, 22, 21, 23],
  },
  {
    label: 'Marketplaces',
    value: '8',
    change: '+1 novo',
    trend: 'up' as const,
    sub: 'Conectados e ativos',
    color: '#a78bfa',
    data: [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8],
  },
  {
    label: 'Preço Médio Competitivo',
    value: 'R$ 127',
    change: '-2,3%',
    trend: 'down' as const,
    sub: 'vs. semana anterior',
    color: '#60a5fa',
    data: [135, 132, 138, 130, 128, 134, 129, 131, 127, 129, 128, 127],
  },
  {
    label: 'Economia Gerada',
    value: 'R$ 48k',
    change: '+18%',
    trend: 'up' as const,
    sub: 'Este mês',
    color: '#34d399',
    data: [22, 27, 25, 31, 29, 34, 33, 38, 40, 43, 46, 48],
  },
  {
    label: 'Concorrentes',
    value: '342',
    change: '+28',
    trend: 'up' as const,
    sub: 'Rastreados ativamente',
    color: '#fb923c',
    data: [210, 230, 240, 255, 268, 280, 290, 305, 315, 328, 336, 342],
  },
]

const marketplaces = [
  { name: 'Mercado Livre', score: 87, products: 412 },
  { name: 'Amazon', score: 73, products: 318 },
  { name: 'Shopee', score: 91, products: 287 },
  { name: 'Americanas', score: 65, products: 198 },
  { name: 'Magazine Luiza', score: 79, products: 232 },
]

const alerts = [
  {
    type: 'up',
    product: 'Samsung Galaxy S24 Ultra',
    detail: 'Mercado Livre subiu 15%',
    time: '2min',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
  },
  {
    type: 'down',
    product: 'Nike Air Max 270',
    detail: 'Magazine Luiza baixou 8%',
    time: '14min',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
  },
  {
    type: 'stock',
    product: 'Philips Air Fryer 4L',
    detail: 'Estoque crítico — 3 unid.',
    time: '1h',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
  },
  {
    type: 'new',
    product: 'MacBook Air M2 15"',
    detail: 'Novo concorrente: Americanas',
    time: '2h',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
  },
  {
    type: 'down',
    product: 'Sony WH-1000XM5',
    detail: 'Amazon baixou 12%',
    time: '3h',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
  },
]

const alertIcons = {
  up: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  ),
  down: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  stock: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  new: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
}

// ── ML Sales Card ─────────────────────────────────────────────────────────────

type MlSalesData = { today: number; todayGmv: number; week: number; weekGmv: number }

function MlSalesCard() {
  const [data, setData] = useState<MlSalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) { setLoading(false); return }

      try {
        const res = await fetch(`${BACKEND}/ml/recent-orders?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { setLoading(false); return }
        const { orders } = await res.json()
        setVisible(true)

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000

        let today = 0, todayGmv = 0, week = 0, weekGmv = 0
        for (const o of (orders ?? [])) {
          if (o.status !== 'paid') continue
          const ts = new Date(o.date_created).getTime()
          if (ts >= todayStart) { today++; todayGmv += o.total_amount ?? 0 }
          if (ts >= weekStart) { week++; weekGmv += o.total_amount ?? 0 }
        }

        setData({ today, todayGmv, week, weekGmv })
      } catch { /* ML not connected */ }
      setLoading(false)
    })()
  }, [])

  if (!loading && !visible) return null

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-black shrink-0"
            style={{ background: '#ffe600', color: '#333' }}>ML</div>
          <h3 className="text-white text-[13px] font-semibold">Vendas Mercado Livre</h3>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-md"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
          Últimas 50 ordens
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando vendas…
        </div>
      ) : data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pedidos hoje', value: String(data.today), sub: 'pagos', color: '#34d399' },
            { label: 'GMV hoje',     value: fmt(data.todayGmv), sub: 'receita do dia',   color: '#00E5FF' },
            { label: 'Pedidos 7d',   value: String(data.week),  sub: 'pagos',            color: '#a78bfa' },
            { label: 'GMV 7 dias',   value: fmt(data.weekGmv),  sub: 'receita da semana', color: '#fb923c' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-zinc-500 text-[10px] mb-1">{label}</p>
              <p className="font-bold text-base leading-none" style={{ color }}>{value}</p>
              <p className="text-zinc-600 text-[10px] mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-[12px] capitalize">{today}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Visão Geral</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Atualizado há 5 min
          </span>
          <button
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}
          >
            Exportar
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl p-4 flex flex-col gap-3 transition-all group"
            style={{
              background: '#111114',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.border = `1px solid ${m.color}28`
              ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${m.color}10`
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
            }}
          >
            <div className="flex items-start justify-between">
              <p className="text-zinc-400 text-[12px] font-medium leading-tight">{m.label}</p>
              <span
                className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0`}
                style={{
                  background: m.trend === 'up' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                  color: m.trend === 'up' ? '#34d399' : '#f87171',
                }}
              >
                {m.trend === 'up' ? '↑' : '↓'} {m.change}
              </span>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-white text-2xl font-bold tracking-tight leading-none">{m.value}</p>
                <p className="text-zinc-600 text-[11px] mt-1">{m.sub}</p>
              </div>
              <div className="shrink-0 mb-1">
                <Sparkline values={m.data} color={m.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ML Sales Card */}
      <MlSalesCard />

      {/* Bottom section */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">

        {/* Marketplace competitiveness chart */}
        <div
          className="xl:col-span-3 rounded-xl p-5"
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white text-[13px] font-semibold">Posição Competitiva</h3>
              <p className="text-zinc-500 text-[11px] mt-0.5">Índice de preço por marketplace</p>
            </div>
            <span
              className="text-[11px] font-medium px-2 py-1 rounded-md"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}
            >
              Últimos 30 dias
            </span>
          </div>

          <div className="space-y-3">
            {marketplaces.map((mp) => (
              <div key={mp.name} className="flex items-center gap-3">
                <p className="text-zinc-400 text-[12px] w-32 shrink-0 truncate">{mp.name}</p>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${mp.score}%`,
                      background: `linear-gradient(to right, #00b8d4, #00E5FF)`,
                      opacity: 0.7 + (mp.score / 100) * 0.3,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white text-[12px] font-semibold w-8 text-right">{mp.score}%</span>
                  <span className="text-zinc-600 text-[11px] w-16 text-right">{mp.products} prods.</span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-5 pt-4 flex items-center gap-4 text-[11px] text-zinc-500"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#00E5FF' }} />
              Competitivo
            </span>
            <span>Índice baseado em {metrics[0].value} SKUs monitorados</span>
          </div>
        </div>

        {/* Recent alerts */}
        <div
          className="xl:col-span-2 rounded-xl p-5"
          style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-[13px] font-semibold">Alertas Recentes</h3>
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
            >
              23
            </span>
          </div>

          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-lg transition-colors cursor-pointer"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: alert.bg, color: alert.color }}
                >
                  {alertIcons[alert.type as keyof typeof alertIcons]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[12px] font-medium leading-tight truncate">{alert.product}</p>
                  <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{alert.detail}</p>
                </div>
                <span className="text-zinc-600 text-[10px] shrink-0 mt-0.5">{alert.time}</span>
              </div>
            ))}
          </div>

          <button
            className="mt-3 w-full text-[12px] font-medium py-2 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#71717a' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
              ;(e.currentTarget as HTMLElement).style.color = '#a1a1aa'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              ;(e.currentTarget as HTMLElement).style.color = '#71717a'
            }}
          >
            Ver todos os alertas →
          </button>
        </div>
      </div>
    </div>
  )
}
