'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from './api'
import {
  RfmDistribution, TopCustomer,
  fmtCurrency, fmtNumber,
} from './types'

type TFn = (key: string, values?: Record<string, string | number>) => string

/** Label de segmento automático: usa t() se a chave existe, senão o raw. */
function segLabel(t: TFn, seg: string): string {
  const known = ['campeoes', 'leais', 'promissores', 'novos', 'em_risco', 'perdidos', 'ocasionais']
  return known.includes(seg) ? t(`segmentLabels.${seg}`) : seg
}

const SEGMENTS_ORDER = ['campeoes','leais','promissores','novos','em_risco','perdidos','ocasionais']

function scoreColor(s: number): string {
  if (s >= 7) return '#34d399' // verde
  if (s >= 4) return '#fbbf24' // amarelo
  return '#f87171'              // vermelho
}

export function RfmTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const t = useTranslations('crm.customerHub.rfm')
  const router = useRouter()
  const [data, setData]               = useState<RfmDistribution | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [loading, setLoading]         = useState(true)
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dist, top] = await Promise.all([
        api<RfmDistribution>('/customer-hub/rfm-distribution'),
        api<TopCustomer[]>('/customer-hub/top-customers?limit=300&sort=rfm'),
      ])
      setData(dist); setTopCustomers(top)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  // Counts por segmento automático (vem dos top 300 — é proxy razoável; UI mostra o ranking).
  // Para cobertura completa, idealmente teríamos um endpoint /segments/auto-counts.
  // Por ora: usa overview.segments do OverviewTab via re-fetch separado.
  const [autoCounts, setAutoCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    api<{ segments: Record<string, number>; total_customers: number }>('/customer-hub/overview')
      .then(o => setAutoCounts(o.segments))
      .catch(() => { /* silent */ })
  }, [])

  const totalSegmented = useMemo(
    () => Object.values(autoCounts).reduce((s, n) => s + n, 0),
    [autoCounts],
  )

  const filteredCustomers = useMemo(() => {
    if (!segmentFilter) return topCustomers.slice(0, 50)
    return topCustomers.filter(c => c.segment === segmentFilter).slice(0, 100)
  }, [topCustomers, segmentFilter])

  function goToCampaign(segment?: string) {
    const url = segment ? `/dashboard/messaging?segment=${segment}` : '/dashboard/messaging'
    router.push(url)
  }

  if (loading) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
  if (!data) return <div className="text-zinc-500 text-sm">{t('noData')}</div>

  return (
    <>
      <p className="text-zinc-400 text-sm mb-5">{t('intro')}</p>

      {/* RFM explicação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <RfmCard
          letter="R"
          name={t('rCard.name')}
          color="#00E5FF"
          desc={t('rCard.desc')}
        />
        <RfmCard
          letter="F"
          name={t('fCard.name')}
          color="#34d399"
          desc={t('fCard.desc')}
        />
        <RfmCard
          letter="M"
          name={t('mCard.name')}
          color="#fbbf24"
          desc={t('mCard.desc')}
        />
      </div>

      {/* ScatterChart */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <p className="text-zinc-300 text-sm font-semibold mb-1">{t('mapTitle')}</p>
        <p className="text-zinc-500 text-[11px] mb-3">{t('mapDesc')}</p>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#1e1e24" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="frequency" name={t('axisFreq')} stroke="#52525b" fontSize={11} />
              <YAxis type="number" dataKey="recency"   name={t('axisRecency')} stroke="#52525b" fontSize={11} reversed />
              <ZAxis type="number" dataKey="monetary"  range={[20, 400]} name={t('axisMonetary')} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v, name) => {
                  const num = Number(v ?? 0)
                  if (name === t('axisMonetary'))  return fmtCurrency(num)
                  if (name === t('axisRecency'))   return t('daysValue', { n: num })
                  return num
                }}
              />
              <Scatter
                data={data.scatter}
                shape={(props: { cx?: number; cy?: number; payload?: { score: number; monetary: number } }) => {
                  const score = props.payload?.score ?? 0
                  const m = props.payload?.monetary ?? 0
                  // size proporcional ao monetary, capado em [4, 12]
                  const r = Math.max(4, Math.min(12, 4 + Math.sqrt(m) / 30))
                  return <circle cx={props.cx} cy={props.cy} r={r} fill={scoreColor(score)} fillOpacity={0.7} stroke={scoreColor(score)} />
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de segmentos automáticos */}
      <div className="rounded-2xl overflow-hidden mb-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-zinc-300 text-sm font-semibold">{t('autoSegments')}</p>
          {segmentFilter && (
            <button onClick={() => setSegmentFilter(null)} className="text-xs text-zinc-400 hover:text-white">{t('clearFilter')}</button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a0a0e' }}>
            <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
              <th className="text-left  px-4 py-2.5">{t('colSegment')}</th>
              <th className="text-right px-4 py-2.5">{t('colCustomers')}</th>
              <th className="text-right px-4 py-2.5">{t('colPctTotal')}</th>
              <th className="text-right px-4 py-2.5">{t('colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {SEGMENTS_ORDER
              .filter(s => (autoCounts[s] ?? 0) > 0)
              .sort((a, b) => (autoCounts[b] ?? 0) - (autoCounts[a] ?? 0))
              .map(seg => {
                const cnt = autoCounts[seg] ?? 0
                const pct = totalSegmented > 0 ? cnt / totalSegmented : 0
                return (
                  <tr key={seg}
                    onClick={() => setSegmentFilter(seg === segmentFilter ? null : seg)}
                    className="border-t cursor-pointer hover:bg-zinc-900"
                    style={{
                      borderColor: '#1e1e24',
                      background: seg === segmentFilter ? 'rgba(0,229,255,0.05)' : undefined,
                    }}>
                    <td className="px-4 py-2.5 text-white">{segLabel(t, seg)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-300">{fmtNumber(cnt)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">{(pct * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); goToCampaign(seg) }}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >{t('createCampaign')}</button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Tabela de clientes filtrada */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-zinc-300 text-sm font-semibold">
            {segmentFilter ? t('customersInSegment', { segment: segLabel(t, segmentFilter) }) : t('topByScore')}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a0a0e' }}>
            <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
              <th className="text-left  px-4 py-2.5">{t('colCustomer')}</th>
              <th className="text-right px-4 py-2.5">{t('colRfmScore')}</th>
              <th className="text-right px-4 py-2.5">{t('colRecency')}</th>
              <th className="text-right px-4 py-2.5">{t('colFreq')}</th>
              <th className="text-right px-4 py-2.5">{t('colMonetary')}</th>
              <th className="text-left  px-4 py-2.5">{t('colSegment')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map(c => (
              <tr key={c.id} className="border-t" style={{ borderColor: '#1e1e24' }}>
                <td className="px-4 py-2.5 text-white truncate max-w-xs">{c.display_name ?? c.phone ?? c.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 text-right" style={{ color: scoreColor(Number(c.rfm_score ?? 0)) }}>
                  {c.rfm_score != null ? Number(c.rfm_score).toFixed(1) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{c.rfm_recency_days != null ? `${c.rfm_recency_days}d` : '—'}</td>
                <td className="px-4 py-2.5 text-right text-zinc-300">{c.rfm_frequency ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-zinc-300">{fmtCurrency(c.rfm_monetary)}</td>
                <td className="px-4 py-2.5 text-zinc-400">{c.segment ? segLabel(t, c.segment) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RfmCard({ letter, name, color, desc }: { letter: string; name: string; color: string; desc: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: `1px solid ${color}40` }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold" style={{ background: `${color}1a`, color }}>
          {letter}
        </div>
        <p className="text-white font-semibold">{name}</p>
      </div>
      <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
    </div>
  )
}
