'use client'

/**
 * Estúdio do Blog da Loja — voz da marca, fonte, prompts editáveis da IA e
 * base de conhecimento. Espelha o /store-blog/settings + /studio/* do backend.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { ChevronLeft, Loader2, Save, RotateCcw, Sparkles, Check, Trash2, Link2, FileText, Wand2, Type, BookOpen, AlertCircle } from 'lucide-react'
import { FONT_PAIRS_V3_DEFINITIONS, FONT_PAIRS_V3 } from '@/lib/storefront/v3/font-pairs'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Settings { voice: string | null; display_font: string | null }
interface Prompt { key: 'article' | 'ideate'; prompt: string; is_default: boolean }
interface Knowledge { id: string; source_type: 'url' | 'text'; value: string; title: string | null; extracted_text: string | null }

export default function StoreBlogStudioPage() {
  const [settings, setSettings] = useState<Settings>({ voice: null, display_font: null })
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [knowledge, setKnowledge] = useState<Knowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${BACKEND}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}`, ...(init?.headers ?? {}) },
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error((body && (body.message as string)) || `HTTP ${res.status}`)
    return body as T
  }, [])

  useEffect(() => {
    Promise.all([
      api<Settings>('/store-blog/settings'),
      api<Prompt[]>('/store-blog/studio/prompts'),
      api<Knowledge[]>('/store-blog/studio/knowledge'),
    ]).then(([s, p, k]) => { setSettings(s); setPrompts(p); setKnowledge(k) }).catch(() => {}).finally(() => setLoading(false))
  }, [api])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/dashboard/loja/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
        <ChevronLeft size={16} /> Voltar pro Blog da Loja
      </Link>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-cyan-400"><Wand2 size={18} /><span className="text-xs font-semibold uppercase tracking-wider">Estúdio</span></div>
        <h1 className="mt-1 text-2xl font-bold text-zinc-50">Estúdio do Blog</h1>
        <p className="mt-1 text-sm text-zinc-400">Voz da marca, fonte, prompts da IA e base de conhecimento — ancore o conteúdo no jeito da sua loja.</p>
      </div>

      {error && <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 size={16} className="animate-spin" /> …</div>
      ) : (
        <div className="flex flex-col gap-8">
          <FontVoice settings={settings} setSettings={setSettings} api={api} setError={setError} />
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Prompts da IA</h2>
            <div className="flex flex-col gap-4">
              {prompts.map((p) => <PromptCard key={p.key} prompt={p} onChange={(u) => setPrompts((prev) => prev.map((x) => x.key === u.key ? u : x))} api={api} setError={setError} />)}
            </div>
          </section>
          <KnowledgePanel knowledge={knowledge} setKnowledge={setKnowledge} api={api} setError={setError} />
        </div>
      )}
    </div>
  )
}

type Api = <T,>(path: string, init?: RequestInit) => Promise<T>

function FontVoice({ settings, setSettings, api, setError }: { settings: Settings; setSettings: (s: Settings) => void; api: Api; setError: (s: string | null) => void }) {
  const [voice, setVoice] = useState(settings.voice ?? '')
  const [font, setFont] = useState(settings.display_font ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(patch: Partial<Settings>) {
    setSaving(true); setError(null)
    try {
      const s = await api<Settings>('/store-blog/settings', { method: 'PUT', body: JSON.stringify(patch) })
      setSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-3 flex items-center gap-2"><Type size={16} className="text-cyan-400" /><span className="text-sm font-medium text-zinc-200">Fonte dos títulos do blog</span></div>
      <select value={font} onChange={(e) => { setFont(e.target.value); void save({ display_font: e.target.value || null }) }}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500">
        <option value="">Herdar do tema da loja</option>
        {FONT_PAIRS_V3.map((k) => <option key={k} value={k}>{FONT_PAIRS_V3_DEFINITIONS[k].label}</option>)}
      </select>

      <div className="mb-2 mt-5 flex items-center gap-2"><Sparkles size={16} className="text-cyan-400" /><span className="text-sm font-medium text-zinc-200">Voz da marca</span></div>
      <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={4}
        placeholder="Ex: tom acolhedor e direto, fala de você pro cliente, foca em benefício real, sem exagero."
        className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500" />
      <button type="button" onClick={() => void save({ voice: voice.trim() || null })} disabled={saving}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Salvo' : 'Salvar'}
      </button>
    </section>
  )
}

function PromptCard({ prompt, onChange, api, setError }: { prompt: Prompt; onChange: (p: Prompt) => void; api: Api; setError: (s: string | null) => void }) {
  const [text, setText] = useState(prompt.prompt)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const label = prompt.key === 'article' ? 'Prompt do artigo' : 'Prompt de pautas'

  async function onSave() {
    setSaving(true); setError(null)
    try { await api(`/store-blog/studio/prompts/${prompt.key}`, { method: 'PUT', body: JSON.stringify({ prompt: text }) }); onChange({ ...prompt, prompt: text, is_default: false }); setJustSaved(true); setTimeout(() => setJustSaved(false), 2000) }
    catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  async function onReset() {
    setSaving(true); setError(null)
    try { await api(`/store-blog/studio/prompts/${prompt.key}`, { method: 'DELETE' }); const fresh = (await api<Prompt[]>('/store-blog/studio/prompts')).find((x) => x.key === prompt.key); if (fresh) { onChange(fresh); setText(fresh.prompt) } }
    catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  async function onGenerate() {
    if (!instruction.trim()) return
    setGenerating(true); setError(null)
    try { const { prompt: g } = await api<{ prompt: string }>(`/store-blog/studio/prompts/${prompt.key}/generate`, { method: 'POST', body: JSON.stringify({ instruction: instruction.trim(), current_prompt: text }) }); if (g) setText(g); setGenOpen(false); setInstruction('') }
    catch (e) { setError((e as Error).message) } finally { setGenerating(false) }
  }
  const dirty = text.trim() !== prompt.prompt.trim()

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-100">{label}</span>
        <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${prompt.is_default ? 'bg-zinc-700/40 text-zinc-400' : 'bg-cyan-500/15 text-cyan-400'}`}>{prompt.is_default ? 'Padrão' : 'Personalizado'}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
        className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100 outline-none focus:border-cyan-500" />
      {genOpen && (
        <div className="mt-3 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="O que mudar? Ex: tom mais divertido, foco em presentes"
            className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onGenerate} disabled={generating || !instruction.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">{generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}Gerar</button>
            <button type="button" onClick={() => setGenOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-100">Cancelar</button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSave} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : justSaved ? <Check size={16} /> : <Save size={16} />}{justSaved ? 'Salvo' : 'Salvar'}</button>
        {!genOpen && <button type="button" onClick={() => setGenOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10"><Sparkles size={16} /> Gerar com IA</button>}
        {!prompt.is_default && <button type="button" onClick={onReset} disabled={saving} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-50"><RotateCcw size={16} /> Restaurar padrão</button>}
      </div>
    </div>
  )
}

function KnowledgePanel({ knowledge, setKnowledge, api, setError }: { knowledge: Knowledge[]; setKnowledge: React.Dispatch<React.SetStateAction<Knowledge[]>>; api: Api; setError: (s: string | null) => void }) {
  const [type, setType] = useState<'url' | 'text'>('url')
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function onAdd() {
    if (!value.trim()) return
    setAdding(true); setError(null)
    try { const added = await api<Knowledge>('/store-blog/studio/knowledge', { method: 'POST', body: JSON.stringify({ source_type: type, value: value.trim() }) }); setKnowledge((p) => [added, ...p]); setValue('') }
    catch (e) { setError((e as Error).message) } finally { setAdding(false) }
  }
  async function onRemove(id: string) {
    setBusyId(id)
    try { await api(`/store-blog/studio/knowledge/${id}`, { method: 'DELETE' }); setKnowledge((p) => p.filter((k) => k.id !== id)) } catch { /* ignore */ } finally { setBusyId(null) }
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Base de conhecimento</h2>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <p className="mb-3 flex items-center gap-2 text-xs text-zinc-400"><BookOpen size={16} className="text-cyan-400" /> URLs e notas que a IA usa como referência factual (não copia literal).</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={type} onChange={(e) => setType(e.target.value as 'url' | 'text')} className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500">
            <option value="url">URL</option><option value="text">Nota/texto</option>
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'url' ? 'https://…' : 'Cole um trecho, dado ou contexto…'}
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500" />
          <button type="button" onClick={onAdd} disabled={adding || !value.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50">{adding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Adicionar</button>
        </div>
        {knowledge.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500">Nenhuma fonte ainda.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {knowledge.map((k) => (
              <li key={k.id} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                {k.source_type === 'url' ? <Link2 size={16} className="mt-0.5 shrink-0 text-cyan-400" /> : <FileText size={16} className="mt-0.5 shrink-0 text-cyan-400" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-100">{k.title || k.value}</div>
                  <div className="truncate text-xs text-zinc-500">{k.source_type === 'url' ? k.value : (k.extracted_text ?? '').slice(0, 120)}</div>
                </div>
                <button type="button" onClick={() => onRemove(k.id)} disabled={busyId === k.id} className="text-zinc-500 hover:text-red-400 disabled:opacity-50">{busyId === k.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
