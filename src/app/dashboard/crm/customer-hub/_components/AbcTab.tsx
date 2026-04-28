'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from './api'
import { TopCustomer, Curve, ABC_COLORS, fmtCurrency, fmtNumber } from './types'

type CurveFilter = Curve | 'all'

export function AbcTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const [filter, setFilter]   = useState<CurveFilter>('all')
  const [list, setList]       = useState<TopCustomer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Top 200 ordenados por monetary (cobre as 3 curvas com folga)
      const data = await api<TopCustomer[]>('/customer-hub/top-customers?limit=200&sort=monetary')
      setList(data)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(
    () => filter === 'all' ? list : list.filter(c => c.abc_curve === filter),
    [list, filter],
  )

  // Pareto data: bars = revenue por cliente, line = % cumulativo da receita total
  const paretoData = useMemo(() => {
    const sorted = [...list].sort((a, b) => Number(b.rfm_monetary ?? 0) - Number(a.rfm_monetary ?? 0))
    const totalRev = sorted.reduce((sum, c) => sum + Number(c.rfm_monetary ?? 0), 0)
    let cum = 0
    return sorted.slice(0, 50).map((c, i) => {
      const rev = Number(c.rfm_monetary ?? 0)
      cum += rev
      return {
        rank: i + 1,
        revenue: rev,
        cumulative_pct: totalRev > 0 ? (cum / totalRev) * 100 : 0,
      }
    })
  }, [list])

  function exportCsv() {
    const rows = [
      ['Cliente', 'Curva', 'Compras (R$)', 'Frequência', 'Ticket médio', 'Última compra'],
      ...filtered.map(c => [
        c.display_name ?? c.phone ?? c.id.slice(0, 8),
        c.abc_curve ?? '—',
        String(c.rfm_monetary ?? 0),
        String(c.rfm_frequency ?? 0),
        String(c.avg_ticket ?? 0),
        c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : '—',
      ]),
    ]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `curva-abc-${filter}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-zinc-400 text-sm">Distribuição Pareto + tabela top 200 por receita. Exporte CSV pra ações segmentadas.</p>
        <div className="flex gap-1">
          {(['all', 'A', 'B', 'C'] as CurveFilter[]).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{
                borderColor: filter === f ? (f === 'all' ? '#00E5FF' : ABC_COLORS[f as Curve]) : '#27272a',
                color:       filter === f ? (f === 'all' ? '#00E5FF' : ABC_COLORS[f as Curve]) : '#a1a1aa',
                background:  filter === f ? `${f === 'all' ? '#00E5FF' : ABC_COLORS[f as Curve]}1a` : 'transparent',
              }}
            >{f === 'all' ? 'Todos' : `Curva ${f}`}</button>
          ))}
        </div>
      </div>

      {/* Pareto chart */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <p className="text-zinc-300 text-sm font-semibold mb-3">Pareto — top 50 por receita (% cumulativo)</p>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={paretoData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e1e24" strokeDasharray="3 3" />
              <XAxis dataKey="rank" stroke="#52525b" fontSize={11} />
              <YAxis yAxisId="left" stroke="#52525b" fontSize={11} tickFormatter={v => fmtCurrency(v)} />
              <YAxis yAxisId="right" orientation="right" stroke="#52525b" fontSize={11} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v, name) => {
                  const num = Number(v ?? 0)
                  return name === 'cumulative_pct' ? `${num.toFixed(1)}%` : fmtCurrency(num)
                }}
              />
              <Bar  yAxisId="left"  dataKey="revenue"        fill="#00E5FF" name="Receita" />
              <Line yAxisId="right" dataKey="cumulative_pct" stroke="#34d399" strokeWidth={2} dot={false} name="% acumulado" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-zinc-300 text-sm font-semibold">{fmtNumber(filtered.length)} cliente{filtered.length === 1 ? '' : 's'} {filter === 'all' ? '' : `(curva ${filter})`}</p>
        <button onClick={exportCsv} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>
          Exportar CSV
        </button>
      </div>

      {loading
        ? <div className="h-48 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : filtered.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>Nenhum cliente nesta curva.</div>
          : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0a0a0e' }}>
                  <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left  px-4 py-2.5">Cliente</th>
                    <th className="text-right px-4 py-2.5">Compras</th>
                    <th className="text-right px-4 py-2.5">Freq.</th>
                    <th className="text-right px-4 py-2.5">Ticket médio</th>
                    <th className="text-left  px-4 py-2.5">Última compra</th>
                    <th className="text-center px-4 py-2.5">Curva</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-t" style={{ borderColor: '#1e1e24' }}>
                      <td className="px-4 py-2.5 text-white truncate max-w-xs">{c.display_name ?? c.phone ?? c.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{fmtCurrency(c.rfm_monetary)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-400">{c.rfm_frequency ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{fmtCurrency(c.avg_ticket)}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {c.abc_curve
                          ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${ABC_COLORS[c.abc_curve]}1a`, color: ABC_COLORS[c.abc_curve] }}>{c.abc_curve}</span>
                          : <span className="text-zinc-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
    </>
  )
}
