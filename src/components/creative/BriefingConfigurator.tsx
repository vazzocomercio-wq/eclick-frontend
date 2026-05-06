'use client'

import { useEffect, useState } from 'react'
import { Palette, Globe, Volume2, Image as ImageIcon, Maximize2, BookmarkPlus, Bookmark, Loader2, X, Star, Trash2 } from 'lucide-react'
import {
  MARKETPLACE_OPTIONS,
  VISUAL_STYLES,
  ENVIRONMENT_OPTIONS,
  TONE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  type Marketplace,
  type BriefingTemplate,
} from './types'
import { CreativeApi } from './api'

export interface BriefingFormState {
  target_marketplace:  Marketplace
  visual_style:        string
  environment:         string
  custom_environment:  string
  background_color:    string
  use_logo:            boolean
  communication_tone:  string
  image_count:         number
  image_format:        string
}

export const DEFAULT_BRIEFING: BriefingFormState = {
  target_marketplace: 'mercado_livre',
  visual_style:       'clean',
  environment:        'neutro',
  custom_environment: '',
  background_color:   '#FFFFFF',
  use_logo:           false,
  communication_tone: 'vendedor',
  image_count:        10,
  image_format:       '1200x1200',
}

interface Props {
  value:    BriefingFormState
  onChange: (next: BriefingFormState) => void
  /** Permite carregar/salvar templates por org. Default true. */
  enableTemplates?: boolean
}

export default function BriefingConfigurator({ value, onChange, enableTemplates = true }: Props) {
  const set = <K extends keyof BriefingFormState>(k: K, v: BriefingFormState[K]) =>
    onChange({ ...value, [k]: v })

  // ── Templates state ──────────────────────────────────────────────────────
  const [templates, setTemplates]     = useState<BriefingTemplate[]>([])
  const [tplLoading, setTplLoading]   = useState(false)
  const [saveOpen, setSaveOpen]       = useState(false)
  const [saveName, setSaveName]       = useState('')
  const [saveDefault, setSaveDefault] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  useEffect(() => {
    if (!enableTemplates) return
    void loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableTemplates])

  // Auto-aplica template default no primeiro load (apenas se value ainda
  // estiver com defaults — heurística simples: se name não foi setado)
  useEffect(() => {
    if (templates.length === 0) return
    const def = templates.find(t => t.is_default)
    if (def && value.target_marketplace === 'mercado_livre' && value.communication_tone === 'vendedor') {
      // Não sobrescreve se user já está editando — só carrega no boot
      // Heurística: aplica só se ainda parece default
      applyTemplate(def)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates.length])

  async function loadTemplates() {
    setTplLoading(true)
    try {
      const list = await CreativeApi.listBriefingTemplates()
      setTemplates(list)
    } catch { /* silencioso — sem templates é ok */ }
    finally { setTplLoading(false) }
  }

  function applyTemplate(t: BriefingTemplate) {
    onChange({
      target_marketplace: t.target_marketplace,
      visual_style:       t.visual_style,
      environment:        t.environment ?? 'neutro',
      custom_environment: t.custom_environment ?? '',
      background_color:   t.background_color,
      use_logo:           t.use_logo,
      communication_tone: t.communication_tone,
      image_count:        t.image_count,
      image_format:       t.image_format,
    })
  }

  async function saveAsTemplate() {
    if (!saveName.trim()) { setSaveError('Nome obrigatório.'); return }
    setSaving(true); setSaveError(null)
    try {
      const newTpl = await CreativeApi.createBriefingTemplate({
        name:               saveName.trim(),
        target_marketplace: value.target_marketplace,
        visual_style:       value.visual_style,
        environment:        value.environment === 'custom' ? 'custom' : value.environment,
        custom_environment: value.environment === 'custom' ? value.custom_environment : undefined,
        background_color:   value.background_color,
        use_logo:           value.use_logo,
        communication_tone: value.communication_tone,
        image_count:        value.image_count,
        image_format:       value.image_format,
        is_default:         saveDefault,
      })
      setTemplates(prev => {
        // Se marcou default, remove default dos outros
        const next = saveDefault ? prev.map(t => ({ ...t, is_default: false })) : prev
        return [newTpl, ...next]
      })
      setSaveOpen(false); setSaveName(''); setSaveDefault(false)
    } catch (e: unknown) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(t: BriefingTemplate) {
    if (!confirm(`Excluir template "${t.name}"?`)) return
    try {
      await CreativeApi.deleteBriefingTemplate(t.id)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Templates loader */}
      {enableTemplates && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Bookmark size={12} className="text-cyan-400 shrink-0" />
            <span className="text-[11px] text-zinc-400 shrink-0">Template:</span>
            {tplLoading ? (
              <Loader2 size={11} className="animate-spin text-zinc-500" />
            ) : templates.length === 0 ? (
              <span className="text-[11px] text-zinc-500">nenhum salvo</span>
            ) : (
              <select
                onChange={e => {
                  const t = templates.find(x => x.id === e.target.value)
                  if (t) applyTemplate(t)
                }}
                defaultValue=""
                className="bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-300 px-2 py-0.5 outline-none focus:border-cyan-400"
              >
                <option value="">— selecione —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.is_default ? '★ ' : ''}{t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {templates.length > 0 && (
              <details className="relative">
                <summary className="list-none cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
                  gerenciar
                </summary>
                <div className="absolute z-10 right-0 mt-1 min-w-[240px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg p-1.5 max-h-72 overflow-y-auto">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-900">
                      {t.is_default && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="flex-1 text-left text-[11px] text-zinc-300 truncate"
                      >
                        {t.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(t)}
                        className="text-zinc-500 hover:text-red-400 shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-cyan-400 hover:bg-cyan-400/10"
            >
              <BookmarkPlus size={11} /> salvar atual
            </button>
          </div>
        </div>
      )}

      {/* Marketplace */}
      <Section icon={<Globe size={14} />} title="Marketplace alvo" >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MARKETPLACE_OPTIONS.map(o => (
            <ChipButton
              key={o.value}
              active={value.target_marketplace === o.value}
              onClick={() => set('target_marketplace', o.value)}
            >
              <span>{o.emoji}</span>
              <span>{o.label}</span>
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Estilo visual */}
      <Section icon={<Palette size={14} />} title="Estilo visual">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VISUAL_STYLES.map(s => (
            <ChipButton
              key={s.value}
              active={value.visual_style === s.value}
              onClick={() => set('visual_style', s.value)}
              title={s.description}
            >
              {s.label}
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Ambiente */}
      <Section icon={<ImageIcon size={14} />} title="Ambiente">
        <div className="flex flex-wrap gap-1.5">
          {ENVIRONMENT_OPTIONS.map(e => (
            <SmallChip
              key={e.value}
              active={value.environment === e.value}
              onClick={() => set('environment', e.value)}
            >
              {e.label}
            </SmallChip>
          ))}
        </div>
        {value.environment === 'custom' && (
          <input
            type="text"
            value={value.custom_environment}
            onChange={e => set('custom_environment', e.target.value)}
            placeholder="Descreva o ambiente personalizado"
            className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
          />
        )}
      </Section>

      {/* Cor de fundo + logo */}
      <Section icon={<Palette size={14} />} title="Identidade visual">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-500">Cor de fundo</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={value.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="h-9 w-12 rounded border border-zinc-800 bg-zinc-950 cursor-pointer"
              />
              <input
                type="text"
                value={value.background_color}
                onChange={e => set('background_color', e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono outline-none focus:border-cyan-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500">Logo da marca</label>
            <button
              type="button"
              onClick={() => set('use_logo', !value.use_logo)}
              className={[
                'mt-1 w-full rounded-lg border px-3 py-2 text-xs transition-colors',
                value.use_logo
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700',
              ].join(' ')}
            >
              {value.use_logo ? '✓ Incluir logo nas imagens' : 'Sem logo'}
            </button>
          </div>
        </div>
      </Section>

      {/* Tom */}
      <Section icon={<Volume2 size={14} />} title="Tom de comunicação">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TONE_OPTIONS.map(t => (
            <ChipButton
              key={t.value}
              active={value.communication_tone === t.value}
              onClick={() => set('communication_tone', t.value)}
              title={t.description}
            >
              {t.label}
            </ChipButton>
          ))}
        </div>
      </Section>

      {/* Save template modal */}
      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BookmarkPlus size={14} className="text-cyan-400" />
                <h3 className="text-sm font-semibold">Salvar como template</h3>
              </div>
              <button onClick={() => setSaveOpen(false)} disabled={saving}
                className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Salva o briefing atual com um nome pra reusar em produtos futuros.
              </p>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Ex: Loja minimalista — ML"
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveDefault}
                  onChange={e => setSaveDefault(e.target.checked)}
                  className="accent-cyan-400"
                />
                Marcar como template padrão (auto-aplicado em novos produtos)
              </label>
              {saveError && (
                <p className="text-[11px] text-red-400">{saveError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
              <button onClick={() => setSaveOpen(false)} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs">
                Cancelar
              </button>
              <button onClick={saveAsTemplate} disabled={saving || !saveName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <BookmarkPlus size={12} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Imagens — qtde + formato */}
      <Section icon={<Maximize2 size={14} />} title="Imagens">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-500">Quantidade</label>
            <div className="flex gap-1.5 mt-1">
              {IMAGE_COUNT_OPTIONS.map(n => (
                <SmallChip
                  key={n}
                  active={value.image_count === n}
                  onClick={() => set('image_count', n)}
                >
                  {n} imagens
                </SmallChip>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500">Formato</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {IMAGE_FORMAT_OPTIONS.map(f => (
                <SmallChip
                  key={f}
                  active={value.image_format === f}
                  onClick={() => set('image_format', f)}
                >
                  {f}
                </SmallChip>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-zinc-400">
        <span className="text-cyan-400">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ChipButton({
  active, onClick, title, children,
}: {
  active:   boolean
  onClick:  () => void
  title?:   string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold shadow-[0_0_12px_rgba(0,229,255,0.3)]'
          : 'bg-zinc-950 text-zinc-300 border border-zinc-800 hover:border-cyan-400/40 hover:bg-zinc-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function SmallChip({
  active, onClick, children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2.5 py-1 rounded-full text-[11px] transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-cyan-400/40 hover:text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ── Helper pra montar o body que vai pra POST /briefings ──────────────────

export function briefingFormToApiBody(form: BriefingFormState) {
  return {
    target_marketplace:  form.target_marketplace,
    visual_style:        form.visual_style,
    environment:         form.environment === 'custom' ? 'custom' : form.environment,
    custom_environment:  form.environment === 'custom' ? (form.custom_environment || undefined) : undefined,
    background_color:    form.background_color,
    use_logo:            form.use_logo,
    communication_tone:  form.communication_tone,
    image_count:         form.image_count,
    image_format:        form.image_format,
  }
}
