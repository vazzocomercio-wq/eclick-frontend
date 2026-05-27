'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Search, Loader2, ShoppingBag, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useTaskTracking, useTrackEvent } from '@/lib/telemetry/hooks'
import GeoScoreResultView from '@/components/ai-visibility/GeoScoreResultView'
import { GeoScoreData, GeoRecommendation } from '@/components/ai-visibility/geo-labels'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'
const LOADING_MSGS = [
  'Lendo o anúncio…',
  'Analisando título e descrição…',
  'Avaliando atributos e avaliações…',
  'Checando dados estruturados e acesso de IA…',
  'Gerando recomendações…',
]

type Phase = 'idle' | 'analyzing' | 'done' | 'error'

interface TtProduct { tts_product_id: string; title: string | null; status: string | null; main_image_url: string | null }

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : null
}

function LoadingSkeleton({ msg }: { msg: string }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl p-6 flex items-center gap-4" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: '#00E5FF' }} />
        <div>
          <div className="text-sm font-medium" style={{ color: '#fafafa' }}>{msg}</div>
          <div className="text-xs mt-1" style={{ color: '#71717a' }}>Isso leva de 30 a 60 segundos — a IA está avaliando 8 dimensões.</div>
        </div>
      </div>
      <div className="rounded-xl p-5 space-y-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-2 rounded-full animate-pulse" style={{ background: '#27272a', width: `${90 - i * 9}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function GeoScoreClient() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [data, setData] = useState<GeoScoreData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msgIdx, setMsgIdx] = useState(0)
  const [ttOpen, setTtOpen] = useState(false)
  const [ttProducts, setTtProducts] = useState<TtProduct[]>([])
  const [ttLoading, setTtLoading] = useState(false)
  const [ttError, setTtError] = useState<string | null>(null)

  const task = useTaskTracking('geo_audit_complete')
  const track = useTrackEvent()
  const funnelStarted = useRef(false)

  // Rotaciona as mensagens de loading.
  useEffect(() => {
    if (phase !== 'analyzing') return
    const id = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 6000)
    return () => clearInterval(id)
  }, [phase])

  // url_pasted: inicia o funil na primeira digitação não-vazia. O abandono
  // (se sair sem result_viewed) é automático no unmount via o hook.
  const onUrlChange = (v: string) => {
    setUrl(v)
    if (!funnelStarted.current && v.trim()) { funnelStarted.current = true; task.start(); task.step('url_pasted') }
  }

  const analyze = useCallback(async (urlArg?: string) => {
    const u = (urlArg ?? url).trim()
    if (!/^https?:\/\//i.test(u)) { setError('Cole uma URL válida (começando com http/https).'); return }

    setError(null); setData(null); setMsgIdx(0); setPhase('analyzing')
    task.start({ url: u }) // idempotente (já iniciado no url_pasted)
    task.step('analysis_started')

    try {
      const headers = await authHeaders()
      if (!headers) { setError('Sessão expirada — recarregue a página.'); setPhase('error'); task.complete('failed'); return }

      const postRes = await fetch(`${BACKEND}/ai-visibility/score`, {
        method: 'POST', headers, body: JSON.stringify({ url: u }),
      })
      if (!postRes.ok) throw new Error((await postRes.json().catch(() => ({})))?.message || 'Falha ao iniciar a análise.')
      const { jobId } = await postRes.json() as { jobId: string; status: string; cached: boolean }

      // Poll até completar (cache hit já volta completed; mesmo assim buscamos o detalhe).
      for (let i = 0; i < 40; i++) {
        const r = await fetch(`${BACKEND}/ai-visibility/score/${jobId}`, { headers })
        if (r.ok) {
          const d = await r.json() as GeoScoreData
          if (d.status === 'completed') {
            setData(d); setPhase('done')
            task.step('result_viewed')
            task.complete('completed', { score: d.score })
            return
          }
          if (d.status === 'failed') {
            setError(d.error || 'A análise falhou. Tente novamente.'); setPhase('error')
            task.complete('failed')
            return
          }
        }
        await new Promise(res => setTimeout(res, 5000))
      }
      setError('A análise está demorando mais que o normal. Veja no histórico em instantes.'); setPhase('error')
      task.complete('timeout')
    } catch (e) {
      setError((e as Error).message || 'Erro inesperado.'); setPhase('error')
      task.complete('failed')
    }
  }, [url, task])

  // Abre o seletor e carrega os produtos TikTok da org (uma vez).
  const toggleTt = async () => {
    const opening = !ttOpen
    setTtOpen(opening)
    if (opening && ttProducts.length === 0 && !ttLoading) {
      setTtLoading(true); setTtError(null)
      try {
        const headers = await authHeaders()
        if (!headers) { setTtError('Sessão expirada — recarregue a página.'); return }
        const r = await fetch(`${BACKEND}/tiktok-shop/products`, { headers })
        if (!r.ok) throw new Error('Não consegui listar os produtos do TikTok Shop. A loja está conectada?')
        setTtProducts((await r.json()) as TtProduct[])
      } catch (e) { setTtError((e as Error).message) }
      finally { setTtLoading(false) }
    }
  }

  // Produto TikTok → URL sintética → reusa o mesmo fluxo de análise.
  const pickTt = (p: TtProduct) => {
    const synthetic = `https://shop.tiktok.com/product/${p.tts_product_id}`
    setUrl(synthetic); setTtOpen(false)
    if (!funnelStarted.current) { funnelStarted.current = true; task.start(); task.step('url_pasted') }
    void analyze(synthetic)
  }

  const onRecClick = (rec: GeoRecommendation) => {
    task.step('recommendation_clicked')
    task.step('fix_applied') // o botão "Aplicar manualmente" é a interação de recomendação na UI
    track('geo_score.recommendation_clicked', { properties: { dimension: rec.dimension, severity: rec.severity, url: data?.url } })
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto" style={{ color: '#fafafa' }}>
      {/* Hero */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center rounded-2xl shrink-0"
          style={{ width: 52, height: 52, background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)', boxShadow: '0 0 32px -12px rgba(0,229,255,0.4)' }}>
          <Sparkles size={26} style={{ color: '#00E5FF' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GEO Score Auditor</h1>
          <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>
            Cole a URL de um listing do Mercado Livre ou Shopee — ou escolha um produto do TikTok Shop — para analisar a visibilidade nos motores de IA.
          </p>
        </div>
      </div>

      {/* Input + ação */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center flex-1 rounded-lg px-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <Search size={16} style={{ color: '#52525b' }} />
          <input
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && phase !== 'analyzing') analyze() }}
            placeholder="https://produto.mercadolivre.com.br/MLB-..."
            disabled={phase === 'analyzing'}
            className="flex-1 bg-transparent outline-none px-2 py-2.5 text-sm"
            style={{ color: '#fafafa' }}
          />
        </div>
        <button
          onClick={() => analyze()}
          disabled={phase === 'analyzing'}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: phase === 'analyzing' ? '#1e1e24' : '#00E5FF', color: phase === 'analyzing' ? '#71717a' : '#06121a', cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer' }}
        >
          {phase === 'analyzing' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {phase === 'analyzing' ? 'Analisando…' : 'Analisar agora'}
        </button>
      </div>

      {/* Seletor de produtos do TikTok Shop (não têm URL pública) */}
      <div className="mt-3">
        <button
          onClick={toggleTt}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 transition-colors"
          style={{ background: '#121214', border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <ShoppingBag size={15} style={{ color: '#00E5FF' }} />
          Analisar um produto do TikTok Shop
          <ChevronDown size={15} style={{ transform: ttOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {ttOpen && (
          <div className="mt-3 rounded-xl p-3 max-h-80 overflow-auto" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            {ttLoading && (
              <div className="flex items-center gap-2 text-sm p-2" style={{ color: '#a1a1aa' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: '#00E5FF' }} /> Carregando seus produtos…
              </div>
            )}
            {ttError && <div className="text-sm p-2" style={{ color: '#f87171' }}>{ttError}</div>}
            {!ttLoading && !ttError && ttProducts.length === 0 && (
              <div className="text-sm p-2" style={{ color: '#71717a' }}>Nenhum produto importado. Importe em Integrações &gt; TikTok Shop.</div>
            )}
            <div className="space-y-1">
              {ttProducts.map(p => (
                <button
                  key={p.tts_product_id}
                  onClick={() => pickTt(p)}
                  disabled={phase === 'analyzing'}
                  className="w-full flex items-center gap-3 rounded-lg p-2 text-left"
                  style={{ background: '#18181b', border: '1px solid #27272a', cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer' }}
                >
                  {p.main_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.main_image_url} alt="" className="rounded object-cover shrink-0" style={{ width: 40, height: 40 }} />
                  ) : (
                    <div className="rounded shrink-0" style={{ width: 40, height: 40, background: '#27272a' }} />
                  )}
                  <span className="flex-1 text-sm truncate" style={{ color: '#fafafa' }}>{p.title || p.tts_product_id}</span>
                  <Sparkles size={14} style={{ color: '#00E5FF' }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <div className="mt-6">
        {phase === 'analyzing' && <LoadingSkeleton msg={LOADING_MSGS[msgIdx]} />}
        {phase === 'done' && data && <GeoScoreResultView data={data} onRecommendationClick={onRecClick} />}
      </div>
    </div>
  )
}
