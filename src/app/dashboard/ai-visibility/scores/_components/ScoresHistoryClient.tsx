'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, Eye, RefreshCw, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import GeoScoreResultView from '@/components/ai-visibility/GeoScoreResultView'
import { GeoScoreData, scoreBand, labelFromUrl, platformLabel, skipReasonLabel } from '@/components/ai-visibility/geo-labels'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Row {
  id: string
  url: string
  platform: string
  status: string
  cost_usd: number | null
  created_at: string
  completed_at: string | null
  ai_audit_results?: { geo_score: number | null; skip_reason?: string | null }[]
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : null
}

function ScoreBadge({ score, skipReason }: { score: number | null; skipReason?: string | null }) {
  if (skipReason) return (
    <span title={skipReasonLabel(skipReason)} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)' }}>N/A</span>
  )
  if (score == null) return <span className="text-xs" style={{ color: '#52525b' }}>—</span>
  const b = scoreBand(score)
  return (
    <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
      style={{ background: b.color + '22', color: b.color, border: `1px solid ${b.color}55` }}>
      {score}
    </span>
  )
}

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  completed:  { t: 'Concluído',    c: '#4ADE80' },
  processing: { t: 'Processando',  c: '#00E5FF' },
  pending:    { t: 'Na fila',      c: '#a1a1aa' },
  retry:      { t: 'Retentando',   c: '#F59E0B' },
  failed:     { t: 'Falhou',       c: '#EF4444' },
}

export default function ScoresHistoryClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('')
  const [scoreRange, setScoreRange] = useState('')   // ''|lt30|30-60|60-80|gt80
  const [period, setPeriod] = useState('')           // ''|7|30
  const [sort, setSort] = useState('created_at')     // created_at|cost_usd
  const [detail, setDetail] = useState<GeoScoreData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      if (!headers) { setRows([]); return }
      const qs = new URLSearchParams({ limit: '50', sort_by: sort })
      if (platform) qs.set('filter_platform', platform)
      const r = await fetch(`${BACKEND}/ai-visibility/scores?${qs}`, { headers })
      const d = r.ok ? await r.json() : { items: [] }
      setRows(Array.isArray(d.items) ? d.items : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [platform, sort])

  useEffect(() => { load() }, [load])

  const openDetail = async (id: string) => {
    setDetailLoading(true); setDetail(null)
    try {
      const headers = await authHeaders()
      if (!headers) return
      const r = await fetch(`${BACKEND}/ai-visibility/score/${id}`, { headers })
      if (r.ok) setDetail(await r.json() as GeoScoreData)
    } finally { setDetailLoading(false) }
  }

  // Filtros client-side (score range + período).
  const filtered = rows.filter(row => {
    const score = row.ai_audit_results?.[0]?.geo_score ?? null
    if (scoreRange && score != null) {
      if (scoreRange === 'lt30' && !(score <= 30)) return false
      if (scoreRange === '30-60' && !(score > 30 && score <= 60)) return false
      if (scoreRange === '60-80' && !(score > 60 && score <= 80)) return false
      if (scoreRange === 'gt80' && !(score > 80)) return false
    }
    if (scoreRange && score == null) return false
    if (period) {
      const days = (Date.now() - new Date(row.created_at).getTime()) / 86400000
      if (days > Number(period)) return false
    }
    return true
  })

  const selectStyle = { background: '#0a0a0e', border: '1px solid #27272a', color: '#e4e4e7' }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto" style={{ color: '#fafafa' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de auditorias</h1>
          <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>GEO Score dos listings já analisados.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none" style={selectStyle}>
          <option value="">Todas plataformas</option>
          <option value="mercadolivre">Mercado Livre</option>
          <option value="shopee">Shopee</option>
          <option value="amazon">Amazon</option>
          <option value="generic">Site</option>
        </select>
        <select value={scoreRange} onChange={e => setScoreRange(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none" style={selectStyle}>
          <option value="">Qualquer score</option>
          <option value="lt30">Crítico (≤30)</option>
          <option value="30-60">Atenção (31-60)</option>
          <option value="60-80">Bom (61-80)</option>
          <option value="gt80">Excelente (&gt;80)</option>
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none" style={selectStyle}>
          <option value="">Qualquer período</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-lg px-2.5 py-1.5 outline-none" style={selectStyle}>
          <option value="created_at">Mais recentes</option>
          <option value="cost_usd">Maior custo</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="mt-5 rounded-xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a', color: '#71717a' }} className="text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-2.5">Listing</th>
              <th className="text-center font-medium px-3 py-2.5">Score</th>
              <th className="text-left font-medium px-3 py-2.5 hidden sm:table-cell">Plataforma</th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Status</th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Data</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#71717a' }}>Carregando…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#71717a' }}>
                Nenhuma auditoria ainda. Rode uma no <Link href="/dashboard/ai-visibility/score" style={{ color: '#00E5FF' }}>GEO Score Auditor</Link>.
              </td></tr>
            )}
            {!loading && filtered.map(row => {
              const score = row.ai_audit_results?.[0]?.geo_score ?? null
              const skipReason = row.ai_audit_results?.[0]?.skip_reason ?? null
              const st = STATUS_LABEL[row.status] ?? { t: row.status, c: '#a1a1aa' }
              return (
                <tr key={row.id} style={{ borderTop: '1px solid #1e1e24' }} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-[220px]" style={{ color: '#e4e4e7' }}>{labelFromUrl(row.url)}</div>
                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] mt-0.5" style={{ color: '#52525b' }}>
                      abrir <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-center"><ScoreBadge score={score} skipReason={skipReason} /></td>
                  <td className="px-3 py-3 hidden sm:table-cell" style={{ color: '#a1a1aa' }}>{platformLabel(row.platform)}</td>
                  <td className="px-3 py-3 hidden md:table-cell"><span style={{ color: st.c }}>{st.t}</span></td>
                  <td className="px-3 py-3 hidden md:table-cell tabular-nums" style={{ color: '#71717a' }}>
                    {new Date(row.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.status === 'completed' && (
                      <button onClick={() => openDetail(row.id)} className="inline-flex items-center gap-1 text-[12px]" style={{ color: '#00E5FF' }}>
                        <Eye size={13} /> Detalhes
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhe */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => { setDetail(null) }}>
          <div className="w-full max-w-3xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold" style={{ color: '#fafafa' }}>Detalhe da auditoria</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg" style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa' }}>
                <X size={16} />
              </button>
            </div>
            {detailLoading && <div className="rounded-xl p-8 text-center" style={{ background: '#18181b', border: '1px solid #27272a', color: '#71717a' }}>Carregando…</div>}
            {detail && <GeoScoreResultView data={detail} />}
          </div>
        </div>
      )}
    </div>
  )
}
