'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Search, Loader2 } from 'lucide-react'
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

  const task = useTaskTracking('geo_audit_complete')
  const track = useTrackEvent()
  const phaseRef = useRef<Phase>('idle')
  useEffect(() => { phaseRef.current = phase }, [phase])

  // Rotaciona as mensagens de loading.
  useEffect(() => {
    if (phase !== 'analyzing') return
    const id = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 6000)
    return () => clearInterval(id)
  }, [phase])

  // Abandono: se sair no meio da análise, marca o funil.
  useEffect(() => () => { if (phaseRef.current === 'analyzing') task.abandon('analyzing') }, [task])

  const analyze = useCallback(async () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { setError('Cole uma URL válida (começando com http/https).'); return }

    setError(null); setData(null); setMsgIdx(0); setPhase('analyzing')
    task.start({ url: u })

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

  const onRecClick = (rec: GeoRecommendation) => {
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
            Cole a URL de um listing do Mercado Livre ou Shopee para analisar a visibilidade nos motores de IA.
          </p>
        </div>
      </div>

      {/* Input + ação */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center flex-1 rounded-lg px-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <Search size={16} style={{ color: '#52525b' }} />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && phase !== 'analyzing') analyze() }}
            placeholder="https://produto.mercadolivre.com.br/MLB-..."
            disabled={phase === 'analyzing'}
            className="flex-1 bg-transparent outline-none px-2 py-2.5 text-sm"
            style={{ color: '#fafafa' }}
          />
        </div>
        <button
          onClick={analyze}
          disabled={phase === 'analyzing'}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: phase === 'analyzing' ? '#1e1e24' : '#00E5FF', color: phase === 'analyzing' ? '#71717a' : '#06121a', cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer' }}
        >
          {phase === 'analyzing' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {phase === 'analyzing' ? 'Analisando…' : 'Analisar agora'}
        </button>
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
