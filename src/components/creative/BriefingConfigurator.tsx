'use client'

import { useEffect, useRef, useState } from 'react'
import { Palette, Globe, Volume2, Image as ImageIcon, Maximize2, Loader2, X, Sparkles, Upload, AlertTriangle, Package } from 'lucide-react'
import {
  MARKETPLACE_OPTIONS,
  VISUAL_STYLES,
  TONE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_FORMAT_OPTIONS,
  type Marketplace,
  type TaxonomyOption,
  type CreativePromptTemplate,
  type TemplatePosition,
} from './types'
import { CreativeApi, uploadLogoImage, getMyOrgId } from './api'

export interface BriefingFormState {
  target_marketplace:  Marketplace
  visual_style:        string
  environments:        string[]
  custom_environment:  string
  custom_prompt:       string
  background_color:    string
  use_logo:            boolean
  logo_url:            string | null
  logo_storage_path:   string | null
  communication_tone:  string
  image_count:         number
  image_format:        string
  /** F6: Tipo de produto (template de imagens) escolhido. NULL = auto-match no backend. */
  template_id:         string | null
  /** F6: slots do template selecionados — 1 imagem por slot. Vazio = usa N primeiras (legado). */
  selected_positions:  number[]
}

export const DEFAULT_BRIEFING: BriefingFormState = {
  target_marketplace: 'mercado_livre',
  visual_style:       'clean',
  environments:       [],
  custom_environment: '',
  custom_prompt:      '',
  background_color:   '#FFFFFF',
  use_logo:           false,
  logo_url:           null,
  logo_storage_path:  null,
  communication_tone: 'vendedor',
  image_count:        10,
  image_format:       '1200x1200',
  template_id:        null,
  selected_positions: [],
}

interface Props {
  value:    BriefingFormState
  onChange: (next: BriefingFormState) => void
  /** F6: quando passado, tenta auto-detectar template pela category_ml_id do produto. */
  autoDetectByCategoryMlId?: string | null
}

/**
 * F6: heurística pra separar slots utilitários (Capa/Macro/Card/Embalagem/Banner)
 * dos slots de ambiente nos chips.
 */
const UTILITY_SLOT_PATTERNS = [
  /^capa\b/i,
  /^detalhe\b/i,
  /^macro\b/i,
  /^t[ée]cnica\b/i,
  /\bcard\b/i,
  /^embalagem\b/i,
  /^banner\b/i,
  /^medidas\b/i,
  /^caracter[íi]sticas\b/i,
]
function isUtilitySlot(name: string): boolean {
  return UTILITY_SLOT_PATTERNS.some(rx => rx.test(name ?? ''))
}

export default function BriefingConfigurator({ value, onChange, autoDetectByCategoryMlId }: Props) {
  const set = <K extends keyof BriefingFormState>(k: K, v: BriefingFormState[K]) =>
    onChange({ ...value, [k]: v })

  // ── F6: Tipos de produto (prompt templates) ──────────────────────────────
  const [productTypes, setProductTypes]       = useState<CreativePromptTemplate[]>([])
  const [productTypesLoading, setProductTypesLoading] = useState(false)
  const [activeTypePositions, setActiveTypePositions] = useState<TemplatePosition[]>([])
  const [autoDetectedTypeId, setAutoDetectedTypeId]   = useState<string | null>(null)

  // Lista de ambientes da taxonomy (fluxo legado — sem tipo de produto escolhido)
  const [ambientOptions, setAmbientOptions] = useState<TaxonomyOption[]>([])
  const [ambientLoading, setAmbientLoading] = useState(false)

  useEffect(() => {
    setAmbientLoading(true)
    CreativeApi.listTaxonomy('ambient')
      .then(setAmbientOptions)
      .catch(() => setAmbientOptions([]))
      .finally(() => setAmbientLoading(false))
  }, [])

  // F6: carrega tipos de produto da org no mount + auto-detect (categoria > default)
  useEffect(() => {
    setProductTypesLoading(true)
    CreativeApi.listPromptTemplates()
      .then(list => {
        setProductTypes(list)
        if (value.template_id || list.length === 0) return

        // Prioridade 1: match por category_ml_id (quando passado pela page)
        if (autoDetectByCategoryMlId) {
          const byCategory = list.find(t => t.category_ml_ids.includes(autoDetectByCategoryMlId))
          if (byCategory) {
            setAutoDetectedTypeId(byCategory.id)
            onChange({ ...value, template_id: byCategory.id })
            return
          }
        }

        // Prioridade 2: template default da org
        const byDefault = list.find(t => t.is_default)
        if (byDefault) {
          setAutoDetectedTypeId(byDefault.id)
          onChange({ ...value, template_id: byDefault.id })
        }
      })
      .catch(() => setProductTypes([]))
      .finally(() => setProductTypesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetectByCategoryMlId])

  // F6: quando template_id muda, carrega slots do template ativo
  useEffect(() => {
    if (!value.template_id) {
      setActiveTypePositions([])
      return
    }
    let cancelled = false
    CreativeApi.getPromptTemplate(value.template_id)
      .then(tpl => {
        if (cancelled) return
        const sorted = [...(tpl.positions ?? [])].sort((a, b) => a.position - b.position)
        setActiveTypePositions(sorted)
      })
      .catch(() => { if (!cancelled) setActiveTypePositions([]) })
    return () => { cancelled = true }
  }, [value.template_id])

  return (
    <div className="space-y-6">
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

      {/* F6: Tipo de produto (template de imagens) — antes dos ambientes */}
      <Section icon={<Package size={14} />} title="Tipo de produto">
        <p className="text-[11px] text-zinc-500 mb-2">
          Define quais ambientes/cenas serão usados pra gerar imagens. {autoDetectedTypeId === value.template_id && value.template_id ? '✨ Detectado automaticamente pela categoria.' : ''} Gerenciar em <strong>/templates</strong>.
        </p>
        {productTypesLoading ? (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Loader2 size={12} className="animate-spin" /> carregando tipos de produto…
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={value.template_id ?? ''}
              onChange={e => {
                const newId = e.target.value || null
                // Reset selected_positions ao trocar tipo
                onChange({ ...value, template_id: newId, selected_positions: [] })
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            >
              <option value="">— Nenhum (usar ambientes livres) —</option>
              {productTypes.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (default)' : ''} · {t.positions.length} slots
                </option>
              ))}
            </select>
            {value.template_id && (
              <button
                type="button"
                onClick={() => onChange({ ...value, template_id: null, selected_positions: [] })}
                className="text-[11px] text-zinc-500 hover:text-zinc-200 inline-flex items-center gap-1"
                title="Limpar tipo escolhido"
              >
                <X size={10} /> limpar
              </button>
            )}
          </div>
        )}
      </Section>

      {/* Ambientes / Slots — dinâmico baseado em template_id */}
      <Section
        icon={<ImageIcon size={14} />}
        title={value.template_id
          ? `Ambientes do template (selecione 1+)`
          : `Ambientes (selecione 1+)`}
      >
        {value.template_id ? (
          /* MODO TEMPLATE: chips dos slots do tipo de produto escolhido */
          <>
            <p className="text-[11px] text-zinc-500 mb-2">
              {value.selected_positions.length > 0
                ? <>Vai gerar <strong className="text-cyan-300">{value.selected_positions.length}</strong> imagem(ns) — 1 por slot marcado.</>
                : <>Sem nenhum marcado: vai gerar as <strong>{value.image_count}</strong> primeiras do template.</>}
            </p>
            {activeTypePositions.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Loader2 size={12} className="animate-spin" /> carregando slots…
              </div>
            ) : (
              <>
                {/* Slots de ambiente (não-utilitários) */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {activeTypePositions
                    .filter(p => !isUtilitySlot(p.name))
                    .map(p => {
                      const active = value.selected_positions.includes(p.position)
                      return (
                        <SmallChip
                          key={p.position}
                          active={active}
                          onClick={() => {
                            const next = active
                              ? value.selected_positions.filter(n => n !== p.position)
                              : [...value.selected_positions, p.position].sort((a, b) => a - b)
                            set('selected_positions', next)
                          }}
                        >
                          {p.name}
                        </SmallChip>
                      )
                    })}
                </div>

                {/* Slots utilitários (Capa, Detalhe macro, Card, Embalagem) — agrupados */}
                {activeTypePositions.some(p => isUtilitySlot(p.name)) && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">📐 Utilitários (recomendados pra todo anúncio)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeTypePositions
                        .filter(p => isUtilitySlot(p.name))
                        .map(p => {
                          const active = value.selected_positions.includes(p.position)
                          return (
                            <SmallChip
                              key={p.position}
                              active={active}
                              onClick={() => {
                                const next = active
                                  ? value.selected_positions.filter(n => n !== p.position)
                                  : [...value.selected_positions, p.position].sort((a, b) => a - b)
                                set('selected_positions', next)
                              }}
                            >
                              {p.name}
                            </SmallChip>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Atalhos */}
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => set('selected_positions', activeTypePositions.map(p => p.position))}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    marcar todos
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button
                    type="button"
                    onClick={() => set('selected_positions', activeTypePositions.filter(p => isUtilitySlot(p.name)).map(p => p.position))}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    só utilitários
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button
                    type="button"
                    onClick={() => set('selected_positions', [])}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    limpar
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* MODO LEGADO: chips de taxonomy (sem tipo de produto escolhido) */
          <>
            <p className="text-[11px] text-zinc-500 mb-2">
              As {value.image_count} imagens vão alternar entre os ambientes selecionados.
              Sem nenhum: usa fundo neutro. Gerenciar opções na <strong>Galeria de referências</strong>.
            </p>
            {ambientLoading && ambientOptions.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Loader2 size={12} className="animate-spin" /> carregando ambientes…
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {ambientOptions.map(opt => {
                  const active = value.environments.includes(opt.value)
                  return (
                    <SmallChip
                      key={opt.id}
                      active={active}
                      onClick={() => {
                        const next = active
                          ? value.environments.filter(x => x !== opt.value)
                          : [...value.environments, opt.value]
                        set('environments', next)
                      }}
                    >
                      {opt.label}
                    </SmallChip>
                  )
                })}
                <SmallChip
                  active={value.environments.includes('custom')}
                  onClick={() => {
                    const active = value.environments.includes('custom')
                    const next = active
                      ? value.environments.filter(x => x !== 'custom')
                      : [...value.environments, 'custom']
                    set('environments', next)
                  }}
                >
                  Personalizado
                </SmallChip>
              </div>
            )}
            {value.environments.includes('custom') && (
              <input
                type="text"
                value={value.custom_environment}
                onChange={e => set('custom_environment', e.target.value)}
                placeholder="Descreva o ambiente personalizado"
                className="mt-3 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
              />
            )}
          </>
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
            <LogoSlot
              logoUrl={value.logo_url}
              onPicked={(r) => onChange({
                ...value,
                logo_url:          r.signed_url,
                logo_storage_path: r.storage_path,
                use_logo:          true,
              })}
              onRemoved={() => onChange({
                ...value,
                logo_url:          null,
                logo_storage_path: null,
                use_logo:          false,
              })}
            />
          </div>
        </div>
      </Section>

      {/* Prompt customizado */}
      <Section icon={<Sparkles size={14} />} title="Instrução adicional (opcional)">
        <textarea
          value={value.custom_prompt}
          onChange={e => set('custom_prompt', e.target.value)}
          placeholder='Ex: "destaque o controle remoto", "evite ambientes com plantas", "estilo retrô anos 80"'
          rows={3}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 resize-y"
          maxLength={1500}
        />
        <p className="mt-1 text-[10px] text-zinc-600 text-right">
          {value.custom_prompt.length}/1500
        </p>
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

      {/* Imagens — qtde (só sem template) + formato */}
      <Section icon={<Maximize2 size={14} />} title="Imagens">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {value.template_id ? (
            /* Com template: quantidade calculada automaticamente, sem seletor */
            <div>
              <label className="text-[11px] text-zinc-500">Quantidade</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                {value.selected_positions.length > 0
                  ? <><strong className="text-cyan-300">{value.selected_positions.length}</strong> imagens — 1 por slot marcado acima</>
                  : <span className="text-zinc-500">marque slots em <strong>Ambientes</strong> ↑</span>}
              </div>
            </div>
          ) : (
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
          )}
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
  // F6: quando template + slots, image_count = N slots (1 imagem por slot)
  // Backend recalcula mas mandamos o valor correto pra evitar mismatch.
  const effectiveImageCount = form.template_id && form.selected_positions.length > 0
    ? form.selected_positions.length
    : form.image_count

  return {
    target_marketplace:  form.target_marketplace,
    visual_style:        form.visual_style,
    environments:        form.environments,
    custom_environment:  form.environments.includes('custom') ? (form.custom_environment || undefined) : undefined,
    custom_prompt:       form.custom_prompt || undefined,
    background_color:    form.background_color,
    use_logo:            form.use_logo,
    logo_url:            form.logo_url ?? undefined,
    logo_storage_path:   form.logo_storage_path ?? undefined,
    communication_tone:  form.communication_tone,
    image_count:         effectiveImageCount,
    image_format:        form.image_format,
    // F6: tipo de produto + slots escolhidos (substituem environments[] quando preenchidos)
    template_id:         form.template_id ?? undefined,
    selected_positions:  form.selected_positions.length > 0 ? form.selected_positions : undefined,
  }
}

// ── LogoSlot — dropzone compacto pra logo da marca ────────────────────────

function LogoSlot({
  logoUrl, onPicked, onRemoved,
}: {
  logoUrl:    string | null
  onPicked:   (r: { signed_url: string; storage_path: string }) => void
  onRemoved:  () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setError('Formato: JPG, PNG ou WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Máximo 5MB')
      return
    }
    setUploading(true)
    try {
      const orgId = await getMyOrgId()
      if (!orgId) throw new Error('organização não encontrada')
      const r = await uploadLogoImage(orgId, file)
      onPicked(r)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  if (logoUrl) {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/5 px-2 py-1.5">
        <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded bg-zinc-900 border border-zinc-800" />
        <span className="flex-1 text-[11px] text-cyan-200 truncate">Logo carregado</span>
        <button
          type="button"
          onClick={onRemoved}
          className="text-zinc-400 hover:text-red-400"
          title="Remover logo"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className={[
          'mt-1 w-full rounded-lg border border-dashed px-3 py-2 text-xs transition-colors flex items-center justify-center gap-2',
          'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-cyan-400/40 hover:text-zinc-200',
          uploading && 'opacity-60 cursor-wait',
        ].join(' ')}
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? 'Enviando…' : 'Subir logo (PNG transparente)'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
      {error && (
        <div className="mt-1 flex items-start gap-1.5 text-[10px] text-red-400">
          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </>
  )
}
