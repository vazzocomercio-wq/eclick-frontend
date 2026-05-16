'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Check, X, AlertOctagon, ChevronRight, Send, Eye, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface ApprovedRec {
  id:                   string
  campaign_item_id:     string
  recommended_price:    number | null
  recommended_quantity: number | null
  recommendation:       string
  status:               string
  ml_campaign_items?: { ml_item_id: string; ml_campaign_id: string; original_price: number | null }
  ml_campaigns?:      { name: string | null; ml_promotion_type: string }
  seller_id:            number
}

interface ValidationResult {
  recommendation_id: string
  is_valid:          boolean
  errors:            Array<{ code: string; message: string }>
  warnings:          Array<{ code: string; message: string }>
  ml_item_id?:       string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ApplyWizardPage() {
  const router = useRouter()
  const { selected: selectedSellerId, connections } = useMlAccount()
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [recos, setRecos]         = useState<ApprovedRec[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [validations, setValidations] = useState<ValidationResult[]>([])
  const [applying, setApplying]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [applyMode, setApplyMode] = useState<'safe' | 'best_effort'>('safe')

  const sid = selectedSellerId ?? getStoredSellerId() ?? connections[0]?.seller_id

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const params = new URLSearchParams()
      if (sid != null) params.set('seller_id', String(sid))
      params.set('status', 'approved') // status approved + edited (controler aceita um por vez)
      params.set('limit',  '200')
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = await r.json()
      const approved = (body.recommendations ?? []) as ApprovedRec[]
      // Tambem busca status=edited
      params.set('status', 'edited')
      const r2 = await fetch(`${BACKEND}/ml-campaigns/recommendations?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const body2 = await r2.json()
      const edited = (body2.recommendations ?? []) as ApprovedRec[]
      setRecos([...approved, ...edited])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sid])

  useEffect(() => { void load() }, [load])

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function selectAll() {
    setSelected(new Set(recos.map(r => r.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function validate() {
    if (selected.size === 0) return
    setApplying(true); setError(null)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/validate`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recommendation_ids: [...selected] }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = await r.json() as ValidationResult[]
      setValidations(body)
      setStep(2)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  async function apply() {
    if (!sid) { setError('Selecione uma conta ML'); return }
    setApplying(true); setError(null)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/apply/batch`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          recommendation_ids: [...selected],
          seller_id:          sid,
          apply_mode:         applyMode,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      const body = await r.json()
      if (body.job_id) {
        router.push(`/dashboard/ml-campaigns/apply/${body.job_id}`)
      } else {
        setStep(3)
      }
    } catch (e) {
      setError((e as Error).message)
      setApplying(false)
    }
  }

  const validCount   = validations.filter(v => v.is_valid).length
  const invalidCount = validations.filter(v => !v.is_valid).length

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <span className="text-zinc-300">Aplicar em Lote</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send size={22} className="text-cyan-400" />
            Aplicar Recomendações no ML
          </h1>
          <p className="text-xs text-zinc-500 mt-1">3 passos: selecionar → validar → aplicar</p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        <Step n={1} label="Selecionar"     active={step === 1} done={step > 1} />
        <ChevronRight size={14} className="text-zinc-600" />
        <Step n={2} label="Validar"        active={step === 2} done={step > 2} />
        <ChevronRight size={14} className="text-zinc-600" />
        <Step n={3} label="Aplicar"        active={step === 3} done={false} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      {/* Step 1: Selecionar */}
      {step === 1 && (
        <>
          <div className="rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs"
            style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <span className="text-zinc-400">{recos.length} aprovadas pendentes de aplicar</span>
            <span className="text-zinc-600">·</span>
            <button onClick={selectAll} className="text-cyan-400 hover:underline">Selecionar todas</button>
            <button onClick={clearAll} className="text-zinc-500 hover:text-red-400">Limpar</button>
            <span className="ml-auto font-semibold text-zinc-200">{selected.size} selecionada{selected.size === 1 ? '' : 's'}</span>
          </div>

          {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

          {!loading && recos.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <Sparkles size={48} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-300 font-medium">Nenhuma recomendação aprovada</p>
              <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
                Aprove recomendações na <Link href="/dashboard/ml-campaigns/recommendations" className="text-cyan-400 hover:underline">Inbox de Recomendações</Link> primeiro.
              </p>
            </div>
          )}

          {recos.length > 0 && (
            <div className="space-y-2">
              {recos.map(r => (
                <SelectableRow key={r.id} reco={r} selected={selected.has(r.id)} onToggle={() => toggleSelect(r.id)} />
              ))}
            </div>
          )}

          {selected.size > 0 && (
            <div className="sticky bottom-4 rounded-xl p-3 flex items-center justify-between"
              style={{ background: 'rgba(12,12,16,0.95)', border: '1px solid #1a1a1f', backdropFilter: 'blur(8px)' }}>
              <span className="text-xs text-zinc-300">
                <strong className="text-cyan-400">{selected.size}</strong> selecionada{selected.size === 1 ? '' : 's'} pra validar
              </span>
              <button onClick={validate} disabled={applying}
                className="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#000' }}>
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Validar selecionadas →
              </button>
            </div>
          )}
        </>
      )}

      {/* Step 2: Validar */}
      {step === 2 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KpiBox label="Total"     value={validations.length} color="#fafafa" />
            <KpiBox label="Validadas" value={validCount}          color="#22c55e" />
            <KpiBox label="Erros"     value={invalidCount}        color="#ef4444" />
          </div>

          <div className="space-y-2">
            {validations.map(v => <ValidationRow key={v.recommendation_id} v={v} />)}
          </div>

          {/* Apply mode toggle */}
          <div className="rounded-xl p-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-2">Modo de aplicação</p>
            <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
              <input type="radio" checked={applyMode === 'safe'} onChange={() => setApplyMode('safe')} />
              <span><strong>Safe:</strong> não aplica nada se houver QUALQUER erro</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="radio" checked={applyMode === 'best_effort'} onChange={() => setApplyMode('best_effort')} />
              <span><strong>Best effort:</strong> aplica as válidas, ignora as com erro</span>
            </label>
          </div>

          <div className="sticky bottom-4 rounded-xl p-3 flex items-center justify-between"
            style={{ background: 'rgba(12,12,16,0.95)', border: '1px solid #1a1a1f', backdropFilter: 'blur(8px)' }}>
            <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-zinc-200">← Voltar</button>
            <button onClick={apply}
              disabled={applying || (applyMode === 'safe' && invalidCount > 0) || validCount === 0}
              className="submit-glow px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: '#22c55e', color: '#000' }}>
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Aplicar {applyMode === 'best_effort' ? `${validCount} válidas` : `${validations.length} no ML`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  const color = done ? '#22c55e' : active ? '#00E5FF' : '#52525b'
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
        {done ? <Check size={12} /> : n}
      </div>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

function SelectableRow({ reco, selected, onToggle }: { reco: ApprovedRec; selected: boolean; onToggle: () => void }) {
  const item = reco.ml_campaign_items
  const discount = (item?.original_price && reco.recommended_price)
    ? Math.round(((item.original_price - reco.recommended_price) / item.original_price) * 100)
    : null

  return (
    <div onClick={onToggle}
      className="rounded-lg p-3 cursor-pointer transition-all"
      style={{
        background: selected ? 'rgba(0,229,255,0.06)' : '#0c0c10',
        border: `1px solid ${selected ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}`,
      }}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-200">{item?.ml_item_id ?? '—'}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold text-emerald-400"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              {reco.status === 'edited' ? 'EDITADA' : 'APROVADA'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            <span>{reco.ml_campaigns?.name ?? '—'}</span>
            <span>{reco.ml_campaigns?.ml_promotion_type}</span>
          </div>
          <div className="flex items-center gap-3 text-xs mt-2">
            <span>
              Preço: <strong className="text-zinc-200">{brl(reco.recommended_price)}</strong>
              {discount && discount > 0 && <span className="ml-1 text-emerald-400">−{discount}%</span>}
            </span>
            <span>·</span>
            <span>Qty: <strong className="text-zinc-200">{reco.recommended_quantity ?? '—'}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ValidationRow({ v }: { v: ValidationResult }) {
  return (
    <div className="rounded-lg p-3"
      style={{
        background: '#0c0c10',
        border: `1px solid ${v.is_valid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}>
      <div className="flex items-start gap-2">
        {v.is_valid ? <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    : <AlertOctagon size={14} className="text-red-400 mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-zinc-200">{v.ml_item_id ?? v.recommendation_id}</p>
          {v.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {v.errors.map((e, i) => (
                <li key={i} className="text-[11px] text-red-300">• {e.message}</li>
              ))}
            </ul>
          )}
          {v.warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {v.warnings.map((w, i) => (
                <li key={i} className="text-[11px] text-amber-300">⚠ {w.message}</li>
              ))}
            </ul>
          )}
          {v.is_valid && v.warnings.length === 0 && (
            <p className="text-[11px] text-emerald-400">Pronto pra aplicar</p>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}
