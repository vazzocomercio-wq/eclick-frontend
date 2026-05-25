'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, Search, Loader2, Wand2, Check, AlertTriangle, RotateCcw, Lock, BarChart3 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useTaskTracking } from '@/lib/telemetry/hooks'
import GeoImpactPanel from '@/components/ai-visibility/GeoImpactPanel'
import {
  OptimizerDraft, ApplyResult, TitleVariation, variantTypeLabel,
} from '@/components/ai-visibility/optimizer-labels'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Phase = 'idle' | 'generating' | 'draft' | 'applying' | 'applied' | 'error'
type Tab = 'optimize' | 'impact'

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : null
}

function DescriptionDiff({ before, after }: { before: string | null; after: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-xl p-4" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: '#71717a' }}>Descrição atual</span>
          <span className="text-[11px] tabular-nums" style={{ color: '#52525b' }}>{(before ?? '').length} chars</span>
        </div>
        <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-auto" style={{ color: '#a1a1aa', fontFamily: 'inherit' }}>
          {before?.trim() || '(sem descrição)'}
        </pre>
      </div>
      <div className="rounded-xl p-4" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.3)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#00E5FF' }}>Descrição otimizada pra IA</span>
          <span className="text-[11px] tabular-nums" style={{ color: '#52525b' }}>{(after ?? '').length} chars</span>
        </div>
        <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-auto" style={{ color: '#d4d4d8', fontFamily: 'inherit' }}>
          {after?.trim() || '—'}
        </pre>
      </div>
    </div>
  )
}

function VariantCard({ v, selected, onSelect }: { v: TitleVariation; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="text-left rounded-xl p-4 transition-colors w-full"
      style={{ background: selected ? 'rgba(0,229,255,0.08)' : '#18181b', border: `1px solid ${selected ? '#00E5FF' : '#27272a'}` }}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
            style={{ background: selected ? '#00E5FF' : '#27272a', color: selected ? '#06121a' : '#a1a1aa' }}>{v.variant}</span>
          <span className="text-[11px] uppercase tracking-wide" style={{ color: '#71717a' }}>{variantTypeLabel(v.type)}</span>
        </span>
        {selected && <Check size={15} style={{ color: '#00E5FF' }} />}
        {!selected && v.estimated_geo_lift > 0 && <span className="text-[11px] tabular-nums" style={{ color: '#4ADE80' }}>+{v.estimated_geo_lift}</span>}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug" style={{ color: '#fafafa' }}>{v.title}</p>
      <p className="mt-1 text-[11px] tabular-nums" style={{ color: '#52525b' }}>{v.title.length}/60 · busca-alvo: {v.target_query}</p>
    </button>
  )
}

export default function GeoOptimizerClient() {
  const params = useSearchParams()
  const [tab, setTab] = useState<Tab>('optimize')
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [draft, setDraft] = useState<OptimizerDraft | null>(null)
  const [variant, setVariant] = useState<'A' | 'B' | 'C'>('A')
  const [applied, setApplied] = useState<ApplyResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const task = useTaskTracking('geo_optimize')
  const started = useRef(false)

  // Prefill da URL vinda do GEO Score ("Otimizar com IA").
  useEffect(() => {
    const u = params.get('url')
    if (u) setUrl(u)
  }, [params])

  const onUrlChange = (v: string) => {
    setUrl(v)
    if (!started.current && v.trim()) { started.current = true; task.start(); task.step('url_pasted') }
  }

  const generate = useCallback(async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { setError('Cole uma URL válida (http/https).'); return }
    setError(null); setDraft(null); setApplied(null); setConfirming(false); setPhase('generating')
    task.start({ url: u }); task.step('generation_started')
    try {
      const headers = await authHeaders()
      if (!headers) { setError('Sessão expirada — recarregue a página.'); setPhase('error'); return }
      const res = await fetch(`${BACKEND}/ai-visibility/optimize`, { method: 'POST', headers, body: JSON.stringify({ url: u }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Falha ao gerar a otimização.')
      const d = await res.json() as OptimizerDraft
      setDraft(d); setVariant(d.title_variations?.[0]?.variant ?? 'A'); setPhase('draft')
      task.step('draft_generated')
    } catch (e) {
      setError((e as Error).message || 'Erro inesperado.'); setPhase('error'); task.complete('failed')
    }
  }, [url, task])

  const apply = useCallback(async () => {
    if (!draft) return
    setError(null); setPhase('applying')
    task.step('variant_selected')
    try {
      const headers = await authHeaders()
      if (!headers) { setError('Sessão expirada — recarregue a página.'); setPhase('draft'); return }
      const res = await fetch(`${BACKEND}/ai-visibility/optimize/${draft.optimizerId}/apply`, {
        method: 'POST', headers, body: JSON.stringify({ variant }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Falha ao aplicar no anúncio.')
      const r = await res.json() as ApplyResult
      setApplied(r); setPhase('applied'); setConfirming(false)
      task.step('applied'); task.complete('completed')
    } catch (e) {
      setError((e as Error).message || 'Erro inesperado.'); setPhase('draft'); setConfirming(false)
    }
  }, [draft, variant, task])

  const rollback = useCallback(async () => {
    if (!draft) return
    setError(null); setPhase('applying')
    try {
      const headers = await authHeaders()
      if (!headers) { setError('Sessão expirada — recarregue a página.'); setPhase('applied'); return }
      const res = await fetch(`${BACKEND}/ai-visibility/optimize/${draft.optimizerId}/rollback`, {
        method: 'POST', headers, body: JSON.stringify({ reason: 'manual_ui' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'Falha ao reverter.')
      setApplied(null); setPhase('draft')
    } catch (e) {
      setError((e as Error).message || 'Erro inesperado.'); setPhase('applied')
    }
  }, [draft])

  const busy = phase === 'generating' || phase === 'applying'

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto" style={{ color: '#fafafa' }}>
      {/* Hero */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center rounded-2xl shrink-0"
          style={{ width: 52, height: 52, background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)', boxShadow: '0 0 32px -12px rgba(0,229,255,0.4)' }}>
          <Wand2 size={26} style={{ color: '#00E5FF' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GEO Optimizer</h1>
          <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>
            A IA reescreve título e descrição pra seu produto ser citado por ChatGPT, Perplexity e Gemini — e publica no anúncio.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 p-1 rounded-lg w-fit" style={{ background: '#111114', border: '1px solid #27272a' }}>
        {([['optimize', 'Otimizar', Sparkles], ['impact', 'Impacto do piloto', BarChart3]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={tab === k ? { background: '#00E5FF', color: '#06121a' } : { background: 'transparent', color: '#a1a1aa' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'impact' ? (
        <div className="mt-6"><GeoImpactPanel /></div>
      ) : (
        <>
          {/* Input */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center flex-1 rounded-lg px-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
              <Search size={16} style={{ color: '#52525b' }} />
              <input value={url} onChange={e => onUrlChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !busy) generate() }}
                placeholder="https://produto.mercadolivre.com.br/MLB-..."
                disabled={busy}
                className="flex-1 bg-transparent outline-none px-2 py-2.5 text-sm" style={{ color: '#fafafa' }} />
            </div>
            <button onClick={generate} disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: busy ? '#1e1e24' : '#00E5FF', color: busy ? '#71717a' : '#06121a', cursor: busy ? 'not-allowed' : 'pointer' }}>
              {phase === 'generating' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {phase === 'generating' ? 'Gerando…' : 'Gerar otimização'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
          )}

          {phase === 'generating' && (
            <div className="mt-6 rounded-xl p-6 flex items-center gap-4" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <Loader2 size={26} className="animate-spin" style={{ color: '#00E5FF' }} />
              <div>
                <div className="text-sm font-medium">A IA está reescrevendo o anúncio…</div>
                <div className="text-xs mt-1" style={{ color: '#71717a' }}>Gerando 3 títulos e uma descrição estruturada pra motores de IA.</div>
              </div>
            </div>
          )}

          {draft && (phase === 'draft' || phase === 'applying' || phase === 'applied') && (
            <div className="mt-6 space-y-5">
              {/* Sucesso aplicado */}
              {phase === 'applied' && applied && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
                  <div className="flex items-center gap-2">
                    <Check size={18} style={{ color: '#4ADE80' }} />
                    <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>Publicado no anúncio</span>
                  </div>
                  <p className="text-[13px] mt-1.5" style={{ color: '#a1a1aa' }}>
                    Descrição atualizada no Mercado Livre.{' '}
                    {applied.titleLocked
                      ? <span><Lock size={11} className="inline mb-0.5" /> Título mantido — o ML trava o título de anúncios com vendas.</span>
                      : applied.titleApplied ? 'Título também atualizado.' : 'Título mantido.'}
                    {' '}O impacto começa a ser medido (veja na aba “Impacto do piloto”).
                  </p>
                  <button onClick={rollback} disabled={busy}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium"
                    style={{ background: '#18181b', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    <RotateCcw size={13} /> Reverter para o original
                  </button>
                </div>
              )}

              {/* Variações de título */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Escolha o título</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(draft.title_variations ?? []).map(v => (
                    <VariantCard key={v.variant} v={v} selected={variant === v.variant} onSelect={() => phase !== 'applied' && setVariant(v.variant)} />
                  ))}
                </div>
              </div>

              {/* Diff de descrição */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Descrição</h3>
                <DescriptionDiff before={draft.description_old} after={draft.description_new} />
              </div>

              {/* Apply (quando ainda não aplicado) */}
              {phase !== 'applied' && (
                confirming ? (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={18} style={{ color: '#F59E0B' }} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#F59E0B' }}>Publicar no seu anúncio real do Mercado Livre?</div>
                        <p className="text-[13px] mt-1" style={{ color: '#a1a1aa' }}>
                          A descrição será substituída ao vivo. Dá pra reverter a qualquer momento com um clique. Título da variação <b>{variant}</b> só é aplicado se o anúncio não tiver vendas.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={apply} disabled={busy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{ background: '#00E5FF', color: '#06121a', cursor: busy ? 'not-allowed' : 'pointer' }}>
                        {phase === 'applying' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Confirmar e publicar
                      </button>
                      <button onClick={() => setConfirming(false)} disabled={busy}
                        className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirming(true)} disabled={busy}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#00E5FF', color: '#06121a', cursor: busy ? 'not-allowed' : 'pointer' }}>
                    <Wand2 size={16} /> Aplicar variação {variant} no anúncio
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
