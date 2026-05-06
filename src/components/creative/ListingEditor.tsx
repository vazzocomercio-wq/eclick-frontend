'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Save, Loader2, AlertCircle } from 'lucide-react'
import type { CreativeListing } from './types'
import { CreativeApi } from './api'

interface Props {
  listing:  CreativeListing
  onSaved:  (next: CreativeListing) => void
  disabled?: boolean
}

interface EditableState {
  title:                    string
  subtitle:                 string
  description:              string
  bullets:                  string[]
  technical_sheet:          Array<{ key: string; value: string }>
  keywords:                 string[]
  search_tags:              string[]
  suggested_category:       string
  faq:                      Array<{ q: string; a: string }>
  commercial_differentials: string[]
}

function fromListing(l: CreativeListing): EditableState {
  return {
    title:                    l.title,
    subtitle:                 l.subtitle ?? '',
    description:              l.description,
    bullets:                  [...l.bullets],
    technical_sheet:          Object.entries(l.technical_sheet ?? {}).map(([key, value]) => ({ key, value: String(value) })),
    keywords:                 [...(l.keywords ?? [])],
    search_tags:              [...(l.search_tags ?? [])],
    suggested_category:       l.suggested_category ?? '',
    faq:                      l.faq?.map(f => ({ q: f.q, a: f.a })) ?? [],
    commercial_differentials: [...(l.commercial_differentials ?? [])],
  }
}

export default function ListingEditor({ listing, onSaved, disabled }: Props) {
  const [state, setState]   = useState<EditableState>(() => fromListing(listing))
  const [dirty, setDirty]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Re-sync quando o user navega entre versões
  useEffect(() => {
    setState(fromListing(listing))
    setDirty(false)
    setError(null)
  }, [listing.id, listing.version])

  function update<K extends keyof EditableState>(k: K, v: EditableState[K]) {
    setState(s => ({ ...s, [k]: v }))
    setDirty(true)
  }

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      const technical = Object.fromEntries(
        state.technical_sheet
          .filter(r => r.key.trim().length > 0)
          .map(r => [r.key.trim(), r.value.trim()]),
      )
      const next = await CreativeApi.updateListing(listing.id, {
        title:                    state.title,
        subtitle:                 state.subtitle,
        description:              state.description,
        bullets:                  state.bullets.filter(b => b.trim()),
        technical_sheet:          technical,
        keywords:                 state.keywords.filter(k => k.trim()),
        search_tags:              state.search_tags.filter(t => t.trim()),
        suggested_category:       state.suggested_category,
        faq:                      state.faq.filter(f => f.q.trim() && f.a.trim()),
        commercial_differentials: state.commercial_differentials.filter(d => d.trim()),
      })
      onSaved(next)
      setDirty(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Save bar */}
      <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 flex items-center justify-between">
        <span className={`text-[11px] ${dirty ? 'text-amber-400' : 'text-zinc-500'}`}>
          {dirty ? '● alterações não salvas' : '✓ tudo salvo'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-semibold transition-all"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Salvar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <Field label="Título" value={state.title} onChange={v => update('title', v)} disabled={disabled} />
      <Field label="Subtítulo" value={state.subtitle} onChange={v => update('subtitle', v)} disabled={disabled} placeholder="Opcional" />

      {/* Description */}
      <div>
        <Label>Descrição</Label>
        <textarea
          value={state.description}
          onChange={e => update('description', e.target.value)}
          rows={6}
          disabled={disabled}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y"
        />
      </div>

      {/* Bullets */}
      <ListField
        label="Bullets"
        items={state.bullets}
        onChange={v => update('bullets', v)}
        placeholder="✅ Ex: Material premium em ABS resistente"
        disabled={disabled}
      />

      {/* Technical sheet */}
      <KeyValueEditor
        label="Ficha técnica"
        items={state.technical_sheet}
        onChange={v => update('technical_sheet', v)}
        disabled={disabled}
      />

      {/* Keywords */}
      <ListField
        label="Palavras-chave"
        items={state.keywords}
        onChange={v => update('keywords', v)}
        placeholder="Ex: organizador gaveta plástico"
        chipMode
        disabled={disabled}
      />

      {/* Search tags */}
      <ListField
        label="Tags de busca"
        items={state.search_tags}
        onChange={v => update('search_tags', v)}
        placeholder="Ex: cozinha, banheiro"
        chipMode
        disabled={disabled}
      />

      <Field
        label="Categoria sugerida"
        value={state.suggested_category}
        onChange={v => update('suggested_category', v)}
        disabled={disabled}
        placeholder="Categoria sugerida pelo marketplace"
      />

      {/* FAQ */}
      <FaqEditor
        items={state.faq}
        onChange={v => update('faq', v)}
        disabled={disabled}
      />

      {/* Commercial differentials */}
      <ListField
        label="Diferenciais comerciais"
        items={state.commercial_differentials}
        onChange={v => update('commercial_differentials', v)}
        placeholder="Ex: Garantia estendida"
        chipMode
        disabled={disabled}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{children}</label>
}

function Field({
  label, value, onChange, disabled, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 disabled:opacity-50"
      />
    </div>
  )
}

function ListField({
  label, items, onChange, placeholder, chipMode, disabled,
}: {
  label:        string
  items:        string[]
  onChange:     (next: string[]) => void
  placeholder?: string
  chipMode?:    boolean
  disabled?:    boolean
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    onChange([...items, v])
    setDraft('')
  }

  if (chipMode) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
              {item}
              {!disabled && (
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-cyan-100">
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
          <button type="button" onClick={add} disabled={disabled} className="px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400 text-cyan-400 transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>
    )
  }

  // List mode (each item full-width)
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={e => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              disabled={disabled}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="px-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-400/40 hover:text-red-400 text-zinc-500"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
          <button type="button" onClick={add} disabled={disabled} className="px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400 text-cyan-400">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function KeyValueEditor({
  label, items, onChange, disabled,
}: {
  label:    string
  items:    Array<{ key: string; value: string }>
  onChange: (next: Array<{ key: string; value: string }>) => void
  disabled?: boolean
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((row, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              type="text"
              value={row.key}
              onChange={e => {
                const next = [...items]
                next[i] = { ...row, key: e.target.value }
                onChange(next)
              }}
              disabled={disabled}
              placeholder="Campo"
              className="col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
            />
            <input
              type="text"
              value={row.value}
              onChange={e => {
                const next = [...items]
                next[i] = { ...row, value: e.target.value }
                onChange(next)
              }}
              disabled={disabled}
              placeholder="Valor"
              className="col-span-6 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="col-span-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-400/40 hover:text-red-400 text-zinc-500"
              >
                <X size={12} className="mx-auto" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange([...items, { key: '', value: '' }])}
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-dashed border-zinc-800 hover:border-cyan-400/40 hover:text-cyan-400 text-zinc-500 text-xs flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Adicionar campo
          </button>
        )}
      </div>
    </div>
  )
}

function FaqEditor({
  items, onChange, disabled,
}: {
  items:    Array<{ q: string; a: string }>
  onChange: (next: Array<{ q: string; a: string }>) => void
  disabled?: boolean
}) {
  return (
    <div>
      <Label>FAQ</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={item.q}
                onChange={e => {
                  const next = [...items]
                  next[i] = { ...item, q: e.target.value }
                  onChange(next)
                }}
                disabled={disabled}
                placeholder="Pergunta"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="px-2 rounded bg-zinc-900 border border-zinc-800 hover:border-red-400/40 hover:text-red-400 text-zinc-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <textarea
              value={item.a}
              onChange={e => {
                const next = [...items]
                next[i] = { ...item, a: e.target.value }
                onChange(next)
              }}
              disabled={disabled}
              placeholder="Resposta"
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y"
            />
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange([...items, { q: '', a: '' }])}
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-dashed border-zinc-800 hover:border-cyan-400/40 hover:text-cyan-400 text-zinc-500 text-xs flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Adicionar FAQ
          </button>
        )}
      </div>
    </div>
  )
}
