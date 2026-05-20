'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { BookOpen, Plus, Trash2, Tag, Loader2, X, Save, FileText, HelpCircle, ShieldCheck, Smile, AlignLeft, Search, Sparkles } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const TYPES = [
  { id: 'faq',          icon: <HelpCircle size={14} /> },
  { id: 'policy',       icon: <ShieldCheck size={14} /> },
  { id: 'product_info', icon: <FileText size={14} /> },
  { id: 'greeting',     icon: <Smile size={14} /> },
  { id: 'custom',       icon: <AlignLeft size={14} /> },
]

interface KnowledgeItem {
  id: string
  agent_id: string
  type: string
  title: string
  content: string
  tags: string[]
  times_used: number
  is_active: boolean
  created_at: string
}

interface Agent { id: string; name: string }

export default function ConhecimentoPage() {
  const t = useTranslations('atendenteIa')
  const [agents, setAgents]         = useState<Agent[]>([])
  const [agentId, setAgentId]       = useState('')
  const [items, setItems]           = useState<KnowledgeItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [filterType, setFilterType] = useState('all')

  // Form state
  const [type, setType]       = useState('faq')
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags]       = useState<string[]>([])
  const [newTag, setNewTag]   = useState('')
  const [saving, setSaving]   = useState(false)

  // Semantic search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(KnowledgeItem & { score?: number })[] | null>(null)
  const [searching,    setSearching]    = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
  }, [])

  const loadAgents = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/atendente-ia/agents`, { headers })
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
        if (data.length > 0 && !agentId) setAgentId(data[0].id)
      }
    } catch { /* silent */ }
  }, [getHeaders, agentId])

  const loadItems = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/atendente-ia/agents/${agentId}/knowledge`, { headers })
      if (res.ok) { const v = await res.json(); setItems(Array.isArray(v) ? v : []) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [getHeaders, agentId])

  useEffect(() => { loadAgents() }, [loadAgents])
  useEffect(() => { loadItems() }, [loadItems])

  async function saveItem() {
    if (!title.trim() || !content.trim() || !agentId) return
    setSaving(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/atendente-ia/agents/${agentId}/knowledge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, title, content, tags }),
      })
      setShowForm(false)
      setTitle(''); setContent(''); setTags([]); setType('faq')
      loadItems()
    } finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    const ok = await confirm({
      title:        t('knowledge.deleteConfirm.title'),
      message:      t('knowledge.deleteConfirm.message'),
      confirmLabel: t('knowledge.deleteConfirm.confirmLabel'),
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/atendente-ia/knowledge/${id}`, { method: 'DELETE', headers })
    loadItems()
  }

  async function runSemanticSearch() {
    const q = searchQuery.trim()
    if (!q) { setSearchResults(null); return }
    if (!agentId) return
    setSearching(true)
    try {
      const headers = await getHeaders()
      const url = `${BACKEND}/ai/knowledge?agent_id=${encodeURIComponent(agentId)}&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers })
      if (res.ok) { const v = await res.json(); setSearchResults(Array.isArray(v) ? v as KnowledgeItem[] : []) }
    } catch { /* silent */ } finally { setSearching(false) }
  }

  // When semantic search is active, show those results; otherwise apply local type filter
  const filtered = searchResults
    ? searchResults
    : filterType === 'all' ? items : items.filter(i => i.type === filterType)

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={22} style={{ color: '#00E5FF' }} /> {t('knowledge.pageTitle')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{t('knowledge.pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent selector */}
          {agents.length > 0 && (
            <div className="relative">
              <select value={agentId} onChange={e => setAgentId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-white"
                style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => setShowForm(true)} disabled={!agentId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={15} /> {t('knowledge.add')}
          </button>
        </div>
      </div>

      {/* Semantic search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-2xl">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSemanticSearch() }}
            placeholder={t('knowledge.searchPlaceholder')}
            className="w-full pl-9 pr-10 py-2 rounded-xl text-sm text-white placeholder-zinc-600"
            style={{ background: '#111114', border: '1px solid #1e1e24' }} />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X size={12} />
            </button>
          )}
        </div>
        <button onClick={runSemanticSearch} disabled={!searchQuery.trim() || !agentId || searching}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
          {searching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {searching ? t('knowledge.searching') : t('knowledge.searchButton')}
        </button>
        {searchResults && (
          <span className="text-[11px] text-zinc-500">
            {t('knowledge.searchResults', { count: searchResults.length })}
          </span>
        )}
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterType('all')}
          className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{ background: filterType === 'all' ? 'rgba(0,229,255,0.12)' : '#111114', color: filterType === 'all' ? '#00E5FF' : '#71717a' }}>
          {t('knowledge.allFilter', { count: items.length })}
        </button>
        {TYPES.map(ty => {
          const count = items.filter(i => i.type === ty.id).length
          if (count === 0) return null
          return (
            <button key={ty.id} onClick={() => setFilterType(ty.id)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ background: filterType === ty.id ? 'rgba(0,229,255,0.12)' : '#111114', color: filterType === ty.id ? '#00E5FF' : '#71717a' }}>
              {ty.icon}{t(`knowledge.types.${ty.id}`)} ({count})
            </button>
          )
        })}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.2)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{t('knowledge.form.title')}</p>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('knowledge.form.typeLabel')}</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(ty => (
                <button key={ty.id} onClick={() => setType(ty.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: type === ty.id ? 'rgba(0,229,255,0.12)' : '#1e1e24', color: type === ty.id ? '#00E5FF' : '#a1a1aa', border: `1px solid ${type === ty.id ? 'rgba(0,229,255,0.3)' : 'transparent'}` }}>
                  {ty.icon}{t(`knowledge.types.${ty.id}`)}
                </button>
              ))}
            </div>
          </div>
          {/* Title */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('knowledge.form.titleLabel')}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('knowledge.form.titlePlaceholder')}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          {/* Content */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('knowledge.form.contentLabel')}</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              placeholder={type === 'faq' ? t('knowledge.form.contentPlaceholderFaq') : t('knowledge.form.contentPlaceholder')}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 resize-none"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
          </div>
          {/* Tags */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">{t('knowledge.form.tagsLabel')}</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: '#27272a', color: '#a1a1aa' }}>
                  {tag}
                  <button onClick={() => setTags(tg => tg.filter(x => x !== tag))}><X size={9} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setTags(tg => [...tg, newTag.trim()]); setNewTag('') }}}
                placeholder={t('knowledge.form.tagPlaceholder')}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs text-white placeholder-zinc-600"
                style={{ background: '#1e1e24', border: '1px solid #27272a' }} />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={saveItem} disabled={!title.trim() || !content.trim() || saving}
              className="glow-rainbow flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {t('knowledge.save')}
            </button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-2">
          <BookOpen size={36} style={{ color: '#27272a' }} />
          <p className="text-zinc-500 text-sm">{!agentId ? t('knowledge.selectAgent') : t('knowledge.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(item => {
            const typeInfo = TYPES.find(t => t.id === item.type)
            return (
              <div key={item.id} className="rounded-2xl p-4 space-y-3 group"
                style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-zinc-500">{typeInfo?.icon}</span>
                    <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                  </div>
                  <button onClick={() => deleteItem(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{item.content}</p>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]"
                        style={{ background: '#1e1e24', color: '#52525b' }}>
                        <Tag size={8} />{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#1e1e24', color: '#52525b' }}>
                    {typeInfo ? t(`knowledge.types.${typeInfo.id}`) : ''}
                  </span>
                  <span className="text-[10px] text-zinc-600">{t('knowledge.usedTimes', { count: item.times_used })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
