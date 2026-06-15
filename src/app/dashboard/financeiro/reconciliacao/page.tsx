'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, RefreshCw, Play, CheckCircle2, AlertTriangle, Scale,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const CYAN = '#00E5FF'

interface Bucket {
  bucket: string; orders: number; revenue: number; fees: number; observed_take_pct: number | null
}
interface Reconciliation {
  channel: string; period_key: string; revenue: number; fees: number
  observed_take_pct: number | null; configured_take_pct: number | null; diff_pct: number | null
  flagged: boolean; by_bucket: Bucket[]; computed_at: string
}

const CHANNELS: Array<{ key: string; label: string }> = [
  { key: 'shopee', label: 'Shopee' },
  { key: 'tiktok_shop', label: 'TikTok Shop' },
]

const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`)
function prevMonth() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
}

export default function ReconciliacaoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [channel, setChannel] = useState('shopee')
  const [month, setMonth] = useState(prevMonth())
  const [rec, setRec] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada — faça login de novo.')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const loadLatest = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const h = await getHeaders()
      const r = await fetch(`${BACKEND}/financeiro/reconcile?channel=${channel}`, { headers: h }).then(x => x.json())
      setRec(r && r.period_key ? r : null)
      if (r?.period_key) setMonth(r.period_key)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar.')
    } finally { setLoading(false) }
  }, [getHeaders, channel])

  useEffect(() => { void loadLatest() }, [loadLatest])

  const run = useCallback(async () => {
    setRunning(true); setErr('')
    try {
      const h = await getHeaders()
      const r = await fetch(`${BACKEND}/financeiro/reconcile/run`, {
        method: 'POST', headers: h, body: JSON.stringify({ channel, month }),
      }).then(x => x.json())
      if (r?.period_key) setRec(r)
      else throw new Error('Resposta inesperada do servidor.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao rodar.')
    } finally { setRunning(false) }
  }, [getHeaders, channel, month])

  const takeHex = (observed: number | null, configured: number | null) => {
    if (observed == null || configured == null) return '#a1a1aa'
    return Math.abs(observed - configured) > 2 ? '#fcd34d' : '#4ade80'
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8" style={{ background: '#09090b', color: '#fafafa' }}>
      <div className="mx-auto max-w-4xl">
        {/* header */}
        <div className="mb-6">
          <Link href="/dashboard/financeiro/resultado" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-3">
            <ArrowLeft size={14} /> Central de Resultado
          </Link>
          <div className="flex items-center gap-2">
            <Scale size={20} style={{ color: CYAN }} />
            <h1 className="text-2xl font-extrabold tracking-tight">Reconciliação de take rate</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Confere o take rate <strong>estimado</strong> (configurado) contra o take <strong>real</strong> observado
            no escrow/fatura do mês. Se divergir mais de 2 pontos, vem sinalizado pra recalibrar.
          </p>
        </div>

        {/* controles */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
            {CHANNELS.map(c => (
              <button key={c.key} onClick={() => setChannel(c.key)}
                className="px-3 py-1.5 text-sm transition-colors"
                style={{ background: channel === c.key ? CYAN : 'transparent', color: channel === c.key ? '#09090b' : '#a1a1aa', fontWeight: channel === c.key ? 700 : 400 }}>
                {c.label}
              </button>
            ))}
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm" style={{ background: '#0a0a0e', border: '1px solid #1e1e24', color: '#fafafa' }} />
          <button onClick={run} disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: CYAN, color: '#09090b' }}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Calculando…' : 'Rodar reconciliação'}
          </button>
          <button onClick={loadLatest} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 disabled:opacity-50"
            style={{ border: '1px solid #1e1e24' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Último
          </button>
        </div>

        {err && (
          <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
        )}

        {loading && <p className="text-sm text-zinc-500">Carregando…</p>}

        {!loading && !rec && (
          <div className="rounded-xl p-6 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-sm text-zinc-400">Nenhuma reconciliação ainda pra {CHANNELS.find(c => c.key === channel)?.label}.</p>
            <p className="text-xs text-zinc-600 mt-1">Escolha o mês e clique em “Rodar reconciliação”. (O sistema também roda sozinho todo dia 2.)</p>
          </div>
        )}

        {!loading && rec && (
          <div className="space-y-4">
            {/* card principal */}
            <div className="rounded-2xl p-5" style={{
              background: rec.flagged ? 'rgba(252,211,153,0.06)' : 'rgba(74,222,128,0.06)',
              border: `1px solid ${rec.flagged ? 'rgba(252,211,153,0.3)' : 'rgba(74,222,128,0.3)'}`,
            }}>
              <div className="flex items-start gap-3">
                {rec.flagged ? <AlertTriangle size={20} className="text-amber-300 shrink-0 mt-0.5" /> : <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm text-zinc-300">
                    {rec.flagged
                      ? <>O take real <strong>diverge</strong> do configurado em <strong>{pct(Math.abs(rec.diff_pct ?? 0))}</strong> — vale recalibrar o take rate / regras por faixa.</>
                      : <>O take configurado está <strong>alinhado</strong> com o real (diferença &le; 2 pts).</>}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <Metric label="Take real (mês)" value={pct(rec.observed_take_pct)} color={takeHex(rec.observed_take_pct, rec.configured_take_pct)} big />
                    <Metric label="Configurado" value={pct(rec.configured_take_pct)} />
                    <Metric label="Diferença" value={rec.diff_pct == null ? '—' : `${rec.diff_pct > 0 ? '+' : ''}${rec.diff_pct.toFixed(1)} pts`} color={takeHex(rec.observed_take_pct, rec.configured_take_pct)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Metric label="Receita do mês" value={brl(rec.revenue)} />
                    <Metric label="Taxas reais (escrow)" value={brl(rec.fees)} />
                  </div>
                </div>
              </div>
            </div>

            {/* quebra por faixa */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
                <h2 className="text-sm font-semibold">Take real por faixa de ticket</h2>
                <p className="text-xs text-zinc-600 mt-0.5">O take varia por preço — item barato paga mais. É isso que as regras por faixa capturam.</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="px-5 py-2 font-medium">Faixa (R$)</th>
                    <th className="px-5 py-2 font-medium text-right">Pedidos</th>
                    <th className="px-5 py-2 font-medium text-right">Receita</th>
                    <th className="px-5 py-2 font-medium text-right">Taxas</th>
                    <th className="px-5 py-2 font-medium text-right">Take real</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.by_bucket.map(b => (
                    <tr key={b.bucket} style={{ borderTop: '1px solid #18181b' }}>
                      <td className="px-5 py-2.5 text-zinc-300">{b.bucket}</td>
                      <td className="px-5 py-2.5 text-right text-zinc-400 tabular-nums">{b.orders}</td>
                      <td className="px-5 py-2.5 text-right text-zinc-400 tabular-nums">{brl(b.revenue)}</td>
                      <td className="px-5 py-2.5 text-right text-zinc-400 tabular-nums">{brl(b.fees)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color: CYAN }}>{pct(b.observed_take_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-zinc-600">
              Mês {rec.period_key} · calculado em {new Date(rec.computed_at).toLocaleString('pt-BR')} ·
              fonte: ledger real (platform_charges, exceto publicidade) ÷ receita dos pedidos.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`${big ? 'text-2xl font-black' : 'text-base font-semibold'} tabular-nums mt-0.5`} style={{ color: color ?? '#fafafa' }}>{value}</p>
    </div>
  )
}
