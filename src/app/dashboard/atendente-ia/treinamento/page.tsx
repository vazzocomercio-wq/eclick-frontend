'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { GraduationCap, Plus, Trash2, X, Save, Loader2, MessageSquare, CheckCircle2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const CATEGORIES = [
  { id: 'preco',    label: 'Preço' },
  { id: 'prazo',    label: 'Prazo' },
  { id: 'produto',  label: 'Produto' },
  { id: 'troca',    label: 'Troca' },
  { id: 'tecnico',  label: 'Técnico' },
  { id: 'outro',    label: 'Outro' },
]

interface TrainingExample {
  id: string
  question: string
  ideal_answer: string
  category?: string
  source: string
  times_used: number
  created_at: string
}

interface Agent { id: string; name: string }

export default function TreinamentoPage() {
  const [agents, setAgents]       = useState<Agent[]>([])
  const [agentId, setAgentId]     = useState('')
  const [examples, setExamples]   = useState<TrainingExample[]>([])
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [filterCat, setFilterCat] = useState('all')

  const [question, setQuestion]   = useState('')
  const [answer, setAnswer]       = useState('')
  const [category, setCategory]   = useState('outro')
  const [saving, setSaving]       = useState(false)

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }, [])

  const loadAgents = useCallback(async () => {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/atendente-ia/agents`, { headers })
    if (res.ok) {
      const data = await res.json()
      setAgents(data)
      if (data.length > 0 && !agentId) setAgentId(data[0].id)
    }
  }, [getHeaders, agentId])

  const loadExamples = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/atendente-ia/agents/${agentId}/training`, { headers })
      if (res.ok) setExamples(await res.json())
    } finally { setLoading(false) }
  }, [getHeaders, agentId])

  useEffect(() => { loadAgents() }, [loadAgents])
  useEffect(() => { loadExamples() }, [loadExamples])

  async function save() {
    if (!question.trim() || !answer.trim() || !agentId) return
    setSaving(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/atendente-ia/agents/${agentId}/training`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, ideal_answer: answer, category, source: 'manual' }),
      })
      setShowForm(false); setQuestion(''); setAnswer(''); setCategory('outro')
      loadExamples()
    } finally { setSaving(false) }
  }

  async function deleteExample(id: string) {
    if (!confirm('Excluir este exemplo?')) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/training/${id}`, { method: 'DELETE', headers })
    loadExamples()
  }

  const filtered = filterCat === 'all' ? examples : examples.filter(e => e.category === filterCat)

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={22} style={{ color: '#00E5FF' }} /> Treinamento
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Exemplos de perguntas e respostas ideais</p>
        </div>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-white"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowForm(true)} disabled={!agentId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: examples.length },
          ...CATEGORIES.slice(0, 3).map(c => ({ label: c.label, value: examples.filter(e => e.category === c.id).length })),
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: filterCat === 'all' ? 'rgba(0,229,255,0.12)' : '#111114', color: filterCat === 'all' ? '#00E5FF' : '#71717a' }}>
          Todos
        </button>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{ background: filterCat === c.id ? 'rgba(0,229,255,0.12)' : '#111114', color: filterCat === c.id ? '#00E5FF' : '#71717a' }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.2)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Novo exemplo de treinamento</p>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Categoria</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: category === c.id ? 'rgba(0,229,255,0.12)' : '#1e1e24', color: category === c.id ? '#00E5FF' : '#a1a1aa' }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Pergunta do cliente</label>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ex: O produto tem garantia?"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Resposta ideal</label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4}
              placeholder="Ex: Sim! Todos os nossos produtos têm 12 meses de garantia contra defeitos de fabricação."
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 resize-none"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={!question.trim() || !answer.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <GraduationCap size={36} style={{ color: '#27272a' }} />
          <p className="text-zinc-500 text-sm">{!agentId ? 'Selecione um agente' : 'Nenhum exemplo de treinamento'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ex => (
            <div key={ex.id} className="rounded-2xl p-4 group" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={13} className="mt-0.5 shrink-0" style={{ color: '#71717a' }} />
                    <p className="text-sm text-zinc-200">{ex.question}</p>
                  </div>
                  <div className="flex items-start gap-2 pl-4" style={{ borderLeft: '2px solid rgba(0,229,255,0.2)' }}>
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: '#00E5FF' }} />
                    <p className="text-sm text-zinc-400 leading-relaxed">{ex.ideal_answer}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ex.category && (
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#1e1e24', color: '#71717a' }}>
                        {CATEGORIES.find(c => c.id === ex.category)?.label ?? ex.category}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600">Usado {ex.times_used}×</span>
                    <span className="text-[10px] text-zinc-600 capitalize">{ex.source}</span>
                  </div>
                </div>
                <button onClick={() => deleteExample(ex.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 shrink-0 mt-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
