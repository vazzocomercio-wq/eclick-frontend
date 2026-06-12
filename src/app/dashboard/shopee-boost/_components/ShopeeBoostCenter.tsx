'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, RefreshCw, Rocket, Loader2, Clock, History,
  Play, EyeOff, Undo2, ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 Auto-Boost Inteligente — usa os 5 slots GRATUITOS de boost da Shopee
 *  (4h cada) escolhendo os produtos certos 24/7: Algorithm Score × margem ×
 *  giro × estoque, com rotação (todos merecem vitrine). Consome
 *  GET /shopee/boost/overview + POST /shopee/boost/{config,run}. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'
const SHOPEE = '#EE4D2D'

type Strategy = 'balanced' | 'margin' | 'visibility' | 'giro'

interface BoostConfig {
  enabled:           boolean
  strategy:          Strategy
  excluded_item_ids: number[]
  max_per_cycle:     number
  rotation_hours:    number
}
interface Candidate {
  item_id: number; product_id: string; title: string | null
  algo_score: number; margin_pct: number | null; stock: number
  sales_30d: number; composite: number; motivo: string
  blocked_by_rotation: boolean; last_boosted_at: string | null
  fail_reason?: string
}
interface HistoryRow {
  item_id: number; title: string | null; boosted_at: string
  algo_score: number | null; margin_pct: number | null; stock: number | null
  sales_30d: number | null; composite: number | null; motivo: string | null; source: string
}
interface ShopOverview {
  shop_id: number; nickname: string; config: BoostConfig
  active: Array<{ item_id: number; cool_down_second: number }>
  candidates: Candidate[]; history: HistoryRow[]; api_error: string | null
}
interface Overview { gate_on: boolean; shops: ShopOverview[] }
interface CycleResult {
  shop_id: number; active_count: number; free_slots: number
  boosted: Candidate[]; failed?: Candidate[]; skipped_reason?: string
}

export default function ShopeeBoostCenter() {
  const t = useTranslations('shopeeBoost')
  const [data, setData]       = useState<Overview | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/boost/overview`, { headers })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message ?? `HTTP ${res.status}`) }
      setData(await res.json() as Overview)
    } catch (e) {
      setError((e as Error).message); setData(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}><Rocket size={18} /></div>
        <div>
          <h1 className="text-white text-lg font-semibold">{t('title')}</h1>
          <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={data.gate_on
                ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
                : { background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
              {data.gate_on ? t('gateOn') : t('gateOff')}
            </span>
          )}
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}>
            <RefreshCw size={12} /> {t('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-xs text-red-300 flex-1">{error}</p>
          <button onClick={load} className="text-xs text-red-300 underline">{t('retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center"><Loader2 size={16} className="animate-spin" /> {t('loading')}</div>
      ) : data && (
        <div className="flex flex-col gap-5">
          {data.shops.map(shop => <ShopCard key={shop.shop_id} shop={shop} onChanged={load} t={t} />)}
        </div>
      )}
    </div>
  )
}

function ShopCard({ shop, onChanged, t }: { shop: ShopOverview; onChanged: () => void; t: ReturnType<typeof useTranslations> }) {
  const [cfg, setCfg]           = useState<BoostConfig>(shop.config)
  const [savingCfg, setSavingCfg] = useState(false)
  const [running, setRunning]   = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [result, setResult]     = useState<CycleResult | null>(null)
  const [err, setErr]           = useState<string | null>(null)
  const [showHist, setShowHist] = useState(false)

  async function saveConfig(patch: Partial<BoostConfig>) {
    setSavingCfg(true); setErr(null)
    const next = { ...cfg, ...patch }
    setCfg(next)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/boost/config`, {
        method: 'POST', headers,
        body: JSON.stringify({ shop_id: shop.shop_id, ...patch }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`)
      setCfg(j.config as BoostConfig)
    } catch (e) {
      setErr((e as Error).message); setCfg(cfg)
    } finally { setSavingCfg(false) }
  }

  async function runNow() {
    setRunning(true); setErr(null); setResult(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/boost/run`, {
        method: 'POST', headers, body: JSON.stringify({ shop_id: shop.shop_id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`)
      setResult(j as CycleResult)
      setConfirm(false)
      onChanged()
    } catch (e) { setErr((e as Error).message) }
    finally { setRunning(false) }
  }

  const excluded = new Set(cfg.excluded_item_ids)
  function toggleExclude(itemId: number) {
    const next = excluded.has(itemId)
      ? cfg.excluded_item_ids.filter(id => id !== itemId)
      : [...cfg.excluded_item_ids, itemId]
    void saveConfig({ excluded_item_ids: next })
  }

  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      {/* header da loja */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">{shop.nickname}</p>
          <p className="text-[11px] text-zinc-600">Shopee #{shop.shop_id}</p>
        </div>

        {/* toggle */}
        <button onClick={() => saveConfig({ enabled: !cfg.enabled })} disabled={savingCfg}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors disabled:opacity-50"
          style={cfg.enabled
            ? { background: 'rgba(0,229,255,0.1)', color: CYAN, border: '1px solid rgba(0,229,255,0.35)' }
            : { background: '#111114', color: '#71717a', border: '1px solid #27272a' }}>
          <span className="w-7 h-3.5 rounded-full relative transition-colors" style={{ background: cfg.enabled ? CYAN : '#3f3f46' }}>
            <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-zinc-900 transition-all" style={{ left: cfg.enabled ? 15 : 2 }} />
          </span>
          {cfg.enabled ? t('autoOn') : t('autoOff')}
        </button>

        {/* estratégia */}
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {t('strategy')}
          <select value={cfg.strategy} onChange={e => saveConfig({ strategy: e.target.value as Strategy })}
            className="rounded-lg px-2 py-1 text-[11px] outline-none"
            style={{ background: '#0a0a0e', color: '#e4e4e7', border: '1px solid #27272a' }}>
            <option value="balanced">{t('strategyBalanced')}</option>
            <option value="margin">{t('strategyMargin')}</option>
            <option value="visibility">{t('strategyVisibility')}</option>
            <option value="giro">{t('strategyGiro')}</option>
          </select>
        </label>

        {/* rotação */}
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {t('rotation')}
          <input type="number" min={4} max={720} value={cfg.rotation_hours}
            onChange={e => setCfg({ ...cfg, rotation_hours: Number(e.target.value) })}
            onBlur={e => saveConfig({ rotation_hours: Number(e.target.value) })}
            className="w-16 rounded-lg px-2 py-1 text-[11px] outline-none tabular-nums"
            style={{ background: '#0a0a0e', color: '#e4e4e7', border: '1px solid #27272a' }} />
          h
        </label>

        {/* rodar agora */}
        <div className="ml-auto">
          {confirm ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirm(false)} className="rounded-lg px-3 py-1.5 text-[11px] font-medium" style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>{t('cancel')}</button>
              <button onClick={runNow} disabled={running}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                style={{ background: SHOPEE, color: '#fff' }}>
                {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {running ? t('running') : t('confirmRun')}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: CYAN, color: '#06181c' }}>
              <Play size={12} /> {t('runNow')}
            </button>
          )}
        </div>
      </div>

      {shop.api_error && (
        <div className="rounded-lg p-2.5 text-[11px] text-amber-300/90" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          {shop.api_error}
        </div>
      )}
      {err && (
        <div className="rounded-lg p-2.5 text-[11px] text-red-300" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
          {err}
        </div>
      )}
      {result && (
        <div className="rounded-lg p-3 text-[11px]" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)' }}>
          {result.skipped_reason ? (
            <p className="text-amber-300/90">{result.skipped_reason}</p>
          ) : (
            <>
              <p className="text-emerald-300 font-semibold mb-1">{t('runResult', { count: result.boosted.length })}</p>
              {result.boosted.map(b => (
                <p key={b.item_id} className="text-zinc-400">#{b.item_id} · {b.title ?? '—'} — {b.motivo}</p>
              ))}
              {result.failed?.map(b => (
                <p key={b.item_id} className="text-red-300">#{b.item_id} — {b.fail_reason}</p>
              ))}
            </>
          )}
        </div>
      )}

      {/* boosts ativos agora */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">{t('activeNow', { count: shop.active.length })}</p>
        {shop.active.length === 0 ? (
          <p className="text-[11px] text-zinc-600">{t('noActive')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {shop.active.map(a => (
              <span key={a.item_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: 'rgba(238,77,45,0.1)', color: '#fda4af', border: '1px solid rgba(238,77,45,0.3)' }}>
                <Rocket size={11} /> #{a.item_id}
                <span className="text-zinc-500 flex items-center gap-0.5"><Clock size={10} /> {fmtCooldown(a.cool_down_second)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* próximos candidatos */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">{t('candidates')}</p>
        {shop.candidates.length === 0 ? (
          <p className="text-[11px] text-zinc-600">{t('noCandidates')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {shop.candidates.map((c, idx) => {
              const isExcluded = excluded.has(c.item_id)
              return (
                <div key={c.item_id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: '#111114', border: '1px solid #1e1e24', opacity: isExcluded ? 0.45 : c.blocked_by_rotation ? 0.65 : 1 }}>
                  <span className="text-[11px] font-bold tabular-nums w-5 text-center" style={{ color: idx < 5 ? CYAN : '#52525b' }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{c.title ?? `#${c.item_id}`}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{c.motivo}</p>
                  </div>
                  {c.blocked_by_rotation && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                      {t('inRotation')}
                    </span>
                  )}
                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: '#e4e4e7' }}>{c.composite.toFixed(2)}</span>
                  <button onClick={() => toggleExclude(c.item_id)} disabled={savingCfg}
                    title={isExcluded ? t('includeBack') : t('exclude')}
                    className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-50">
                    {isExcluded ? <Undo2 size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {cfg.excluded_item_ids.length > 0 && (
          <p className="text-[10px] text-zinc-600 mt-1.5">{t('excludedCount', { count: cfg.excluded_item_ids.length })}: {cfg.excluded_item_ids.map(String).join(', ')}</p>
        )}
      </div>

      {/* histórico */}
      <div>
        <button onClick={() => setShowHist(!showHist)} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
          <History size={12} /> {t('history', { count: shop.history.length })}
          {showHist ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showHist && (
          shop.history.length === 0 ? (
            <p className="text-[11px] text-zinc-600 mt-1.5">{t('noHistory')}</p>
          ) : (
            <div className="rounded-lg overflow-hidden mt-2" style={{ border: '1px solid #1a1a1f' }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-zinc-500" style={{ background: '#111114', borderBottom: '1px solid #1e1e24' }}>
                    <th className="text-left font-medium px-2.5 py-1.5">{t('histWhen')}</th>
                    <th className="text-left font-medium px-2.5 py-1.5">{t('histItem')}</th>
                    <th className="text-left font-medium px-2.5 py-1.5">{t('histReason')}</th>
                    <th className="text-center font-medium px-2.5 py-1.5">{t('histSource')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shop.history.map((h, i) => (
                    <tr key={`${h.item_id}-${h.boosted_at}-${i}`} style={{ borderBottom: '1px solid #15151a' }}>
                      <td className="px-2.5 py-1.5 text-zinc-500 whitespace-nowrap">{fmtDate(h.boosted_at)}</td>
                      <td className="px-2.5 py-1.5 text-zinc-300 max-w-[220px] truncate">{h.title ?? `#${h.item_id}`}</td>
                      <td className="px-2.5 py-1.5 text-zinc-500">{h.motivo ?? '—'}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={h.source === 'auto'
                          ? { background: 'rgba(0,229,255,0.08)', color: CYAN }
                          : { background: '#1a1a1f', color: '#a1a1aa' }}>
                          {h.source === 'auto' ? t('srcAuto') : t('srcManual')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function fmtCooldown(sec: number): string {
  const s = Math.max(0, Number(sec) || 0)
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}
