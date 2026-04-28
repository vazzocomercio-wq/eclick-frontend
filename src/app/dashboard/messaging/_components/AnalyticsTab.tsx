'use client'

import { useEffect, useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${body?.message ?? body?.error ?? 'erro'}`)
  }
  return (await res.json()) as T
}

type Analytics = {
  total_sent:     number
  delivered_rate: number
  read_rate:      number
  failed_rate:    number
  by_template:    Array<{ template_id: string; name: string; sent: number; delivered: number; read: number; failed: number }>
  by_day:         Array<{ date: string; sent: number; delivered: number }>
}

type Period = '7d' | '30d' | 'custom'

export function AnalyticsTab({ onToast }: { onToast: (m: string, type?: 'success'|'error') => void }) {
  const [period, setPeriod]   = useState<Period>('30d')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [data, setData]       = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let qs = ''
      if (period === '7d')  qs = `?from=${new Date(Date.now() - 7  * 86_400_000).toISOString()}&to=${new Date().toISOString()}`
      if (period === '30d') qs = `?from=${new Date(Date.now() - 30 * 86_400_000).toISOString()}&to=${new Date().toISOString()}`
      if (period === 'custom' && from && to) {
        qs = `?from=${new Date(from).toISOString()}&to=${new Date(to + 'T23:59:59').toISOString()}`
      }
      const res = await api<Analytics>(`/messaging/analytics${qs}`)
      setData(res)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [period, from, to, onToast])

  useEffect(() => { load() }, [load])

  const has = data && data.total_sent > 0

  return (
    <>
      <div className="flex items-center gap-2 mb-5">
        <p className="text-zinc-400 text-sm flex-1">Resumo dos envios. Padrão: últimos 30 dias.</p>
        <div className="flex gap-1">
          {(['7d', '30d', 'custom'] as Period[]).map(p => (
            <button key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{
                borderColor: period === p ? '#00E5FF' : '#27272a',
                color:       period === p ? '#00E5FF' : '#a1a1aa',
                background:  period === p ? 'rgba(0,229,255,0.05)' : 'transparent',
              }}
            >{p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Personalizado'}</button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex gap-2 mb-5">
          <label className="text-xs text-zinc-400 flex-1">
            <span>De</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="an-input" />
          </label>
          <label className="text-xs text-zinc-400 flex-1">
            <span>Até</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="an-input" />
          </label>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Total enviado"  value={loading ? '…' : data?.total_sent ?? 0} />
        <Kpi label="Taxa entrega"   value={loading ? '…' : pct(data?.delivered_rate)} accent="#34d399" />
        <Kpi label="Taxa leitura"   value={loading ? '…' : pct(data?.read_rate)}      accent="#00E5FF" />
        <Kpi label="Falhas"         value={loading ? '…' : pct(data?.failed_rate)}    accent="#f87171" />
      </div>

      {!loading && !has && (
        <div className="rounded-2xl px-6 py-12 text-center text-zinc-500" style={{ background: '#111114', border: '1px dashed #27272a' }}>
          Nenhum envio no período selecionado.
        </div>
      )}

      {!loading && has && (
        <>
          {/* Line chart */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-zinc-300 text-sm font-semibold mb-3">Envios por dia</p>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data!.by_day} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#1e1e24" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#52525b" fontSize={11} />
                  <YAxis stroke="#52525b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Line type="monotone" dataKey="sent"      stroke="#00E5FF" strokeWidth={2} dot={false} name="Enviados" />
                  <Line type="monotone" dataKey="delivered" stroke="#34d399" strokeWidth={2} dot={false} name="Entregues" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-template table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
              <p className="text-zinc-300 text-sm font-semibold">Por template</p>
            </div>
            <table className="w-full text-sm">
              <thead style={{ background: '#0a0a0e' }}>
                <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left  px-4 py-2.5">Template</th>
                  <th className="text-right px-4 py-2.5">Enviados</th>
                  <th className="text-right px-4 py-2.5">Entregues</th>
                  <th className="text-right px-4 py-2.5">Lidos</th>
                  <th className="text-right px-4 py-2.5">Falhas</th>
                  <th className="text-right px-4 py-2.5">Taxa entrega</th>
                </tr>
              </thead>
              <tbody>
                {data!.by_template
                  .sort((a, b) => b.sent - a.sent)
                  .map(row => {
                    const rate = row.sent > 0 ? row.delivered / row.sent : 0
                    return (
                      <tr key={row.template_id} className="border-t" style={{ borderColor: '#1e1e24' }}>
                        <td className="px-4 py-2.5 text-white">{row.name}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">{row.sent}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400">{row.delivered}</td>
                        <td className="px-4 py-2.5 text-right text-cyan-400">{row.read}</td>
                        <td className="px-4 py-2.5 text-right text-red-400">{row.failed}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">{(rate * 100).toFixed(1)}%</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style jsx>{`
        .an-input {
          width: 100%; padding: 0.4rem 0.6rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.8125rem; outline: none; margin-top: 0.25rem;
        }
        .an-input:focus { border-color: #00E5FF; }
      `}</style>
    </>
  )
}

function Kpi({ label, value, accent = '#fafafa' }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-zinc-500 text-[11px] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: accent }}>{value}</p>
    </div>
  )
}

function pct(v: number | undefined): string {
  if (v === undefined) return '0%'
  return `${(v * 100).toFixed(1)}%`
}
