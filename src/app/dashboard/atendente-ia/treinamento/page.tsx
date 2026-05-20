'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { GraduationCap, Plus, Trash2, X, Save, Loader2, MessageSquare, CheckCircle2, Check, AlertCircle } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const CATEGORY_IDS = ['preco', 'prazo', 'produto', 'troca', 'tecnico', 'outro']

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
  const t = useTranslations('atendenteIa')
  const [agents, setAgents]       = useState<Agent[]>([])
  const [agentId, setAgentId]     = useState('')
  const [examples, setExamples]   = useState<TrainingExample[]>([])
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'validated'>('all')

  const [question, setQuestion]   = useState('')
  const [answer, setAnswer]       = useState('')
  const [category, setCategory]   = useState('outro')
  const [saving, setSaving]       = useState(false)
  const confirm = useConfirm()

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
      if (res.ok) { const v = await res.json(); setExamples(Array.isArray(v) ? v : []) }
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
    const ok = await confirm({
      title:        t('training.deleteConfirm.title'),
      message:      t('training.deleteConfirm.message'),
      confirmLabel: t('training.deleteConfirm.confirmLabel'),
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/training/${id}`, { method: 'DELETE', headers })
    loadExamples()
  }

  async function validateExample(id: string) {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/training/${id}/validate`, { method: 'PATCH', headers })
    loadExamples()
  }

  // Status filter: 'pending' = source 'human_edit' (auto-captured, awaiting human review)
  // 'validated' = source 'manual' (created by hand) OR 'validated' (explicitly approved)
  const isValidated = (e: TrainingExample) => e.source === 'manual' || e.source === 'validated'
  const filtered = examples
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .filter(e => filterStatus === 'all' || (filterStatus === 'pending' ? !isValidated(e) : isValidated(e)))

  const pendingCount   = examples.filter(e => !isValidated(e)).length
  const validatedCount = examples.filter(e => isValidated(e)).length

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={22} style={{ color: '#00E5FF' }} /> {t('training.pageTitle')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{t('training.pageSubtitle')}</p>
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
            <Plus size={15} /> {t('training.add')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('training.stats.total'),      value: examples.length, color: '#a1a1aa' },
          { label: t('training.stats.pending'),  value: pendingCount,    color: '#fb923c' },
          { label: t('training.stats.validated'),  value: validatedCount,  color: '#4ade80' },
          { label: t('training.stats.manual'),    value: examples.filter(e => e.source === 'manual').length, color: '#00E5FF' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 mr-1">{t('training.statusLabel')}</span>
        {[
          { id: 'all',       label: t('training.statusFilter.all'),     count: examples.length },
          { id: 'pending',   label: t('training.statusFilter.pending'), count: pendingCount },
          { id: 'validated', label: t('training.statusFilter.validated'), count: validatedCount },
        ].map(s => (
          <button key={s.id} onClick={() => setFilterStatus(s.id as 'all' | 'pending' | 'validated')}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{ background: filterStatus === s.id ? 'rgba(0,229,255,0.12)' : '#111114', color: filterStatus === s.id ? '#00E5FF' : '#71717a' }}>
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: filterCat === 'all' ? 'rgba(0,229,255,0.12)' : '#111114', color: filterCat === 'all' ? '#00E5FF' : '#71717a' }}>
          {t('training.allCategories')}
        </button>
        {CATEGORY_IDS.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{ background: filterCat === c ? 'rgba(0,229,255,0.12)' : '#111114', color: filterCat === c ? '#00E5FF' : '#71717a' }}>
            {t(`training.categories.${c}`)}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.2)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{t('training.form.title')}</p>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('training.form.categoryLabel')}</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_IDS.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: category === c ? 'rgba(0,229,255,0.12)' : '#1e1e24', color: category === c ? '#00E5FF' : '#a1a1aa' }}>
                  {t(`training.categories.${c}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('training.form.questionLabel')}</label>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder={t('training.form.questionPlaceholder')}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('training.form.answerLabel')}</label>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4}
              placeholder={t('training.form.answerPlaceholder')}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 resize-none"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          <div className="flex justify-end">
            <button onClick={save} disabled={!question.trim() || !answer.trim() || saving}
              className="glow-rainbow flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {t('training.save')}
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
        <div className="rounded-2xl p-10 text-center"
          style={{ background: '#0d0d10', border: '1px dashed #2a2a3f' }}>
          <div className="flex justify-center mb-3"><GraduationCap size={40} style={{ color: '#3f3f46' }} /></div>
          {!agentId ? (
            <p className="text-zinc-500 text-sm">{t('training.selectAgent')}</p>
          ) : (
            <>
              <h3 className="text-base font-bold text-white mb-1">{t('training.empty.title')}</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed mb-4">
                {t.rich('training.empty.description', {
                  highlight: (chunks) => <span className="text-zinc-300">{chunks}</span>,
                  pending: (chunks) => <span className="text-orange-400">{chunks}</span>,
                })}
              </p>
              <div className="flex justify-center gap-3 text-[11px] text-zinc-600">
                <span className="inline-flex items-center gap-1"><AlertCircle size={11} className="text-orange-400" /> {t('training.statusPending')}</span>
                <span className="inline-flex items-center gap-1"><Check size={11} className="text-green-400" /> {t('training.statusValidated')}</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ex => {
            const validated = isValidated(ex)
            return (
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: validated ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)',
                          color:      validated ? '#4ade80' : '#fb923c',
                        }}>
                        {validated ? <Check size={9} /> : <AlertCircle size={9} />}
                        {validated ? t('training.statusValidated') : t('training.statusPending')}
                      </span>
                      {ex.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#1e1e24', color: '#71717a' }}>
                          {CATEGORY_IDS.includes(ex.category) ? t(`training.categories.${ex.category}`) : ex.category}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-600">{t('training.usedTimes', { count: ex.times_used })}</span>
                      <span className="text-[10px] text-zinc-600 capitalize">{t('training.source', { source: ex.source })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    {!validated && (
                      <button onClick={() => validateExample(ex.id)} title={t('training.validateTooltip')}
                        className="p-1.5 rounded transition-colors hover:bg-green-400/10 text-zinc-500 hover:text-green-400">
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteExample(ex.id)} title={t('training.deleteTooltip')}
                      className="p-1.5 rounded transition-colors hover:bg-red-400/10 text-zinc-500 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
