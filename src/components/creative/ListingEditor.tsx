'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Save, Loader2, AlertCircle, RefreshCw, ExternalLink, CheckCircle2, Sparkles } from 'lucide-react'
import type { CreativeListing } from './types'
import { CreativeApi } from './api'
import MlAttributesPanel from './MlAttributesPanel'
import SeoSourcesPanel from './SeoSourcesPanel'

interface Props {
  listing:  CreativeListing
  onSaved:  (next: CreativeListing) => void
  disabled?: boolean
}

interface MlAttrValue { id: string; value_name?: string; value_id?: string }

interface EditableState {
  title:                    string
  subtitle:                 string
  description:              string
  bullets:                  string[]
  ml_attributes:            MlAttrValue[]
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
    ml_attributes:            [...(l.ml_attributes ?? [])],
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
  const [seoOpen, setSeoOpen] = useState(false)

  // Detecta se este listing tem fontes do e-Otimizer registradas
  const hasSeoSources = Boolean(
    (listing.generation_metadata as Record<string, unknown> | undefined)?.seo_sources,
  )

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
      const next = await CreativeApi.updateListing(listing.id, {
        title:                    state.title,
        subtitle:                 state.subtitle,
        description:              state.description,
        bullets:                  state.bullets.filter(b => b.trim()),
        ml_attributes:            state.ml_attributes,
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
        <div className="flex items-center gap-2">
          {hasSeoSources && (
            <button
              type="button"
              onClick={() => setSeoOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/30 hover:border-cyan-400/60 text-cyan-300 text-xs font-medium transition-all"
              title="Ver os anúncios e keywords reais que serviram de base"
            >
              <Sparkles size={12} /> Ver fontes
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving || disabled}
            className="glow-rainbow flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-semibold transition-all"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar
          </button>
        </div>
      </div>

      <SeoSourcesPanel
        open={seoOpen}
        onClose={() => setSeoOpen(false)}
        generationMetadata={(listing.generation_metadata as Record<string, unknown>) ?? null}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Sub-sprint C: banner de prontidão pra ML */}
      <PublishReadinessBanner listing={listing} mlAttributes={state.ml_attributes} />

      <div data-seo-field="title">
        <Field label="Título" value={state.title} onChange={v => update('title', v)} disabled={disabled} />
      </div>
      <div data-seo-field="subtitle">
        <Field label="Subtítulo" value={state.subtitle} onChange={v => update('subtitle', v)} disabled={disabled} placeholder="Opcional" />
      </div>

      {/* Description */}
      <div data-seo-field="description">
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
      <div data-seo-field="bullets">
        <ListField
          label="Bullets"
          items={state.bullets}
          onChange={v => update('bullets', v)}
          placeholder="✅ Ex: Material premium em ABS resistente"
          disabled={disabled}
        />
      </div>

      {/* Atributos ML — fonte única (ml_attributes), com IA + "não se aplica" */}
      <div data-seo-field="attributes">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Atributos do anúncio</p>
        <MlAttributesPanel
          listingId={listing.id}
          categoryId={listing.category_ml_id ?? null}
          value={state.ml_attributes}
          onChange={v => update('ml_attributes', v)}
          autoFill
        />
      </div>

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

      {/* Sub-sprint A: Categoria ML real (MLB...) com badge linkável + refresh */}
      <MlCategoryBadge listing={listing} onUpdated={onSaved} disabled={disabled} />

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


// ── Sub-sprint A: MlCategoryBadge ─────────────────────────────────────────────
//
// Mostra a categoria ML real (MLB189195) que veio do predict_category do ML.
// Permite refresh quando user edita o título. Link direto pra categoria no ML.
// Estado:
//   - sem category_ml_id → banner amber sugerindo rodar refresh
//   - com category_ml_id → chip cyan com ID + nome + link externo + botão refresh

function MlCategoryBadge({
  listing, onUpdated, disabled,
}: {
  listing:   CreativeListing
  onUpdated: (next: CreativeListing) => void
  disabled?: boolean
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const categoryId = listing.category_ml_id
  const nAttrs     = listing.attributes_ml_suggested?.length ?? 0

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const updated = await CreativeApi.refreshMlCategory(listing.id)
      onUpdated(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Categoria Mercado Livre <span className="text-[9px] text-zinc-600 normal-case font-medium">(usada no anúncio)</span>
      </label>

      {categoryId ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 text-xs font-medium">
            <CheckCircle2 size={11} />
            {categoryId}
            <a
              href={`https://www.mercadolivre.com.br/categorias#menu=categories&filterCategoryId=${categoryId}`}
              target="_blank"
              rel="noopener"
              className="opacity-70 hover:opacity-100"
              title="Ver categoria no ML"
            >
              <ExternalLink size={10} />
            </a>
          </span>
          {nAttrs > 0 && (
            <span className="text-[10px] text-zinc-500">
              {nAttrs} atributo{nAttrs === 1 ? '' : 's'} sugerido{nAttrs === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={disabled || refreshing}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Re-detectar categoria com base no título atual"
          >
            {refreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Atualizar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs">
            <AlertCircle size={11} />
            Sem categoria ML detectada
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={disabled || refreshing}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-cyan-300 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Detectar agora
          </button>
        </div>
      )}

      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  )
}

// ── Sub-sprint C: PublishReadinessBanner ──────────────────────────────────
//
// Indicador visual no topo do editor: mostra se o listing está pronto pra
// publicar no ML.
//
// Lógica leve (não chama buildMlPreview — esse fica pra página de publish):
//   1. Conta required attributes do listing.attributes_ml_suggested
//   2. Verifica quais estão preenchidos no technical_sheet
//   3. Mostra status + atalho pra página de publicação
//
// Estados:
//   - sem categoria ML: amber, "Detectar categoria ML primeiro"
//   - todos obrigatórios OK: verde, link verde "Publicar no ML →"
//   - alguns faltando: amber, "X campos obrigatórios faltam"

function PublishReadinessBanner({
  listing, mlAttributes,
}: {
  listing:      CreativeListing
  mlAttributes: Array<{ id: string; value_id?: string; value_name?: string }>
}) {
  const categoryMlId = listing.category_ml_id
  const attrs = listing.attributes_ml_suggested ?? []

  if (!categoryMlId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs">
        <AlertCircle size={12} className="text-amber-400 shrink-0" />
        <span className="text-amber-200 flex-1">
          Sem categoria ML detectada. Detecte abaixo pra habilitar a publicação.
        </span>
      </div>
    )
  }

  // Conta required preenchidos.
  // attributes_ml_suggested vem do predict (não tem flag required confiável aí);
  // só os RETORNADOS pelo predict_category são "sugeridos como importantes" —
  // tratamos todos como obrigatórios pra fins de status quick. A página de
  // publish faz a validação completa via /ml-preview.
  // Resolvido = preenchido OU marcado "não se aplica" (value_id "-1").
  const filled = (attrId: string) =>
    mlAttributes.some(v => v.id === attrId
      && ((v.value_id && v.value_id.length > 0) || (v.value_name && v.value_name.trim().length > 0)))

  const missing = attrs.filter(a => !filled(a.id))
  const totalReq = attrs.length
  const ok = missing.length === 0 && totalReq > 0
  const publishHref = `/dashboard/creative/${listing.product_id}/listing/${listing.id}/publish/ml`

  return (
    <div
      className={[
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
        ok
          ? 'border-emerald-400/30 bg-emerald-400/5'
          : 'border-amber-400/30 bg-amber-400/5',
      ].join(' ')}
    >
      {ok ? (
        <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle size={12} className="text-amber-400 shrink-0" />
      )}
      <span className={['flex-1', ok ? 'text-emerald-200' : 'text-amber-200'].join(' ')}>
        {ok ? (
          <>Pronto pra publicar — todos os {totalReq} atributos sugeridos preenchidos.</>
        ) : totalReq === 0 ? (
          <>Nenhum atributo sugerido pela categoria ML. Verifique manualmente antes de publicar.</>
        ) : (
          <>
            <strong>{missing.length}</strong> de {totalReq} atributos sugeridos faltam:{' '}
            <span className="text-amber-300/80">{missing.slice(0, 3).map(m => m.name).join(', ')}{missing.length > 3 ? '…' : ''}</span>
          </>
        )}
      </span>
      <a
        href={publishHref}
        className={[
          'inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors',
          ok
            ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
            : 'bg-zinc-900 border border-zinc-800 hover:border-amber-400/40 text-zinc-300',
        ].join(' ')}
      >
        {ok ? 'Publicar no ML' : 'Revisar e publicar'} →
      </a>
    </div>
  )
}
