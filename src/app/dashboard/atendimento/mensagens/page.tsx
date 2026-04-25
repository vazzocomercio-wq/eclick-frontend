'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, MessageCircle, ExternalLink, CheckCircle2,
  Clock, InboxIcon,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionItem = {
  id: string; title: string; thumbnail: string | null
  price: number; permalink: string | null
}

type Question = {
  id: number; item_id: string; text: string; status: string
  date_created: string; buyer_id: number
  item: QuestionItem | null
  answer?: { text: string; date_created: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Message thread card ───────────────────────────────────────────────────────

function MessageCard({ q }: { q: Question }) {
  const answered = q.status === 'ANSWERED' || !!q.answer
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      {/* Product row */}
      {q.item && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: '#1e1e24', background: '#0f0f12' }}>
          {q.item.thumbnail && (
            <img src={q.item.thumbnail} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" loading="lazy" />
          )}
          <p className="text-[11px] font-medium text-zinc-300 truncate flex-1">{q.item.title}</p>
          <span className="text-[10px] text-zinc-600 shrink-0">{fmtBRL(q.item.price)}</span>
          {q.item.permalink && (
            <a href={q.item.permalink} target="_blank" rel="noreferrer"
              className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors">
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {/* Question bubble */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
            C
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-zinc-400">Comprador #{q.buyer_id}</span>
              <span className="text-[9px] text-zinc-600">{timeAgo(q.date_created)}</span>
            </div>
            <p className="text-[12px] text-zinc-200 leading-relaxed">{q.text}</p>
          </div>
        </div>
      </div>

      {/* Answer bubble */}
      {q.answer && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
              V
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-zinc-400">Você</span>
                <span className="text-[9px] text-zinc-600">{timeAgo(q.answer.date_created)}</span>
                <CheckCircle2 size={9} className="text-green-500" />
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{q.answer.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Unanswered indicator */}
      {!answered && (
        <div className="px-4 pb-3">
          <a href="https://www.mercadolivre.com.br/atividades/perguntas" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-semibold"
            style={{ color: '#facc15' }}>
            <Clock size={10} />
            Aguardando resposta · Responder no ML
            <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabKey = 'unanswered' | 'answered'

export default function MensagensPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answered,  setAnswered]  = useState<Question[]>([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<TabKey>('unanswered')

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }

    try {
      const [uRes, aRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/questions`,                    { headers: h }),
        fetch(`${BACKEND}/ml/questions?status=ANSWERED`,    { headers: h }),
      ])
      if (uRes.status === 'fulfilled' && uRes.value.ok) {
        const d = await uRes.value.json()
        setQuestions(d?.questions ?? d ?? [])
      }
      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const d = await aRes.value.json()
        setAnswered(d?.questions ?? d ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = tab === 'unanswered' ? questions : answered

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Atendimento</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Mensagens</h2>
          <p className="text-zinc-500 text-xs mt-1">Perguntas e conversas com compradores no Mercado Livre.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://www.mercadolivre.com.br/atividades/mensagens" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <ExternalLink size={13} />
            Inbox ML
          </a>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b pb-0" style={{ borderColor: '#1e1e24' }}>
        {([
          { key: 'unanswered', label: 'Pendentes', count: questions.length },
          { key: 'answered',   label: 'Respondidas', count: answered.length },
        ] as { key: TabKey; label: string; count: number }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px"
            style={{
              borderColor: tab === t.key ? '#00E5FF' : 'transparent',
              color:       tab === t.key ? '#00E5FF' : '#71717a',
            }}>
            {t.label}
            {t.count > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                style={{ background: tab === t.key ? 'rgba(0,229,255,0.15)' : 'rgba(113,113,122,0.2)', color: tab === t.key ? '#00E5FF' : '#71717a' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">Carregando mensagens…</div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          {tab === 'unanswered'
            ? <><CheckCircle2 size={32} className="text-green-500" /><p className="text-sm text-zinc-400">Nenhuma pergunta pendente</p></>
            : <><InboxIcon size={32} className="text-zinc-700" /><p className="text-sm text-zinc-400">Nenhuma mensagem respondida</p></>
          }
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(q => <MessageCard key={q.id} q={q} />)}
        </div>
      )}

      {/* Note about direct messages */}
      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.12)' }}>
        <MessageCircle size={12} className="text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Mensagens diretas de pedidos estão disponíveis apenas no painel do Mercado Livre.
          Clique em <strong className="text-zinc-300">Inbox ML</strong> para acessar a caixa de entrada completa.
        </p>
      </div>
    </div>
  )
}
