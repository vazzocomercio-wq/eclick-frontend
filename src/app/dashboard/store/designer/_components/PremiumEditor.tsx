'use client'

/**
 * Editor manual do Tema Premium (v2) — cores premium, efeitos globais e
 * gerenciador de secoes (reordenar, remover, adicionar, editar textos).
 * Usado na aba "Ajustar a mao" do Designer quando o design e v2.
 */

import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import type { StorefrontDesign, Section, SectionType, DesignEffects } from '@/lib/storefront/types'
import { effects, darkColor, watermarkColor, onAccentColor } from '@/lib/storefront/theme'

type FieldDef = { key: string; label: string; area?: boolean; list?: boolean }

const SECTION_META: Record<string, { label: string; fields: FieldDef[] }> = {
  announcementBar: { label: 'Faixa de anúncio', fields: [{ key: 'message', label: 'Mensagem' }] },
  siteHeader:      { label: 'Cabeçalho', fields: [] },
  heroPortrait:    { label: 'Hero (carrossel)', fields: [
    { key: 'watermark', label: 'Marca d’água' },
    { key: 'headline', label: 'Título' },
    { key: 'subheadline', label: 'Subtítulo' },
    { key: 'ctaLabel', label: 'Botão' },
  ] },
  marquee:         { label: 'Faixa rolante', fields: [{ key: 'items', label: 'Frases (uma por linha)', list: true }] },
  productShowcase: { label: 'Vitrine de produtos', fields: [
    { key: 'title', label: 'Título' },
    { key: 'watermark', label: 'Marca d’água' },
  ] },
  categoryGrid:    { label: 'Grade de categorias', fields: [
    { key: 'title', label: 'Título' },
    { key: 'watermark', label: 'Marca d’água' },
  ] },
  editorialSplit:  { label: 'Bloco editorial', fields: [
    { key: 'title', label: 'Título' },
    { key: 'body', label: 'Texto', area: true },
  ] },
  tiltBanner:      { label: 'Banner com efeito', fields: [
    { key: 'headline', label: 'Título' },
    { key: 'watermark', label: 'Marca d’água' },
  ] },
  fullBanner:      { label: 'Banner destaque', fields: [
    { key: 'headline', label: 'Título' },
    { key: 'subheadline', label: 'Subtítulo' },
    { key: 'ctaLabel', label: 'Botão' },
  ] },
  imageHotspot:    { label: 'Imagem com pontos', fields: [{ key: 'title', label: 'Título' }] },
  siteFooter:      { label: 'Rodapé', fields: [] },
}

/** Tipos que so fazem sentido uma vez por loja. */
const SINGLETONS: SectionType[] = ['announcementBar', 'siteHeader', 'siteFooter']

const ADDABLE: SectionType[] = [
  'announcementBar', 'siteHeader', 'heroPortrait', 'marquee', 'productShowcase',
  'categoryGrid', 'editorialSplit', 'tiltBanner', 'fullBanner', 'imageHotspot', 'siteFooter',
]

const EFFECT_LABELS: Array<{ key: keyof DesignEffects; label: string }> = [
  { key: 'scrollReveal',  label: 'Revelar seções ao rolar a página' },
  { key: 'watermarks',    label: 'Marca d’água gigante ao fundo' },
  { key: 'parallaxTilt',  label: 'Parallax nos banners' },
  { key: 'hoverRollover', label: 'Trocar foto do produto no hover' },
]

function defaultSection(type: SectionType): Section {
  switch (type) {
    case 'announcementBar': return { type, message: 'Frete grátis nas compras acima de R$ 199', countdownTo: null }
    case 'siteHeader':      return { type, variant: 'split', sticky: true, showSearch: true, showCart: true, nav: [] }
    case 'heroPortrait':    return { type, watermark: 'LOJA', headline: 'Nova coleção', subheadline: 'Conheça os destaques.', ctaLabel: 'Ver produtos', slides: [{ imageUrl: '', label: 'Destaque' }] }
    case 'marquee':         return { type, items: ['Novidades toda semana', 'Entrega para todo o Brasil'] }
    case 'productShowcase': return { type, layout: 'carousel', title: 'Produtos', source: 'storefront', collectionId: null }
    case 'categoryGrid':    return { type, title: 'Categorias', categories: [] }
    case 'editorialSplit':  return { type, title: 'Nossa história', body: 'Conheça mais sobre a nossa loja.', imageUrl: '', imageSide: 'right' }
    case 'tiltBanner':      return { type, imageUrl: '', headline: 'Ambientes que inspiram' }
    case 'fullBanner':      return { type, imageUrl: '', headline: 'Destaque da semana' }
    case 'imageHotspot':    return { type, imageUrl: '', hotspots: [] }
    case 'siteFooter':      return { type, variant: 'columns', newsletter: true }
    default:                return { type: 'productShowcase', layout: 'grid', title: 'Produtos', source: 'storefront', collectionId: null }
  }
}

function fieldValue(section: Section, f: FieldDef): string {
  const raw = (section as unknown as Record<string, unknown>)[f.key]
  if (f.list) return Array.isArray(raw) ? raw.join('\n') : ''
  return typeof raw === 'string' ? raw : ''
}

const CARD = 'rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3'
const INPUT = 'w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60'

export function PremiumEditor({ design, onChange }: {
  design: StorefrontDesign
  onChange: (d: StorefrontDesign) => void
}) {
  const sections = design.sections
  const fx = effects(design.theme)
  const colors = design.theme.colors

  const setSections = (next: Section[]) => onChange({ ...design, sections: next })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= sections.length) return
    const next = [...sections]
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp
    setSections(next)
  }
  const remove = (i: number) => setSections(sections.filter((_, k) => k !== i))
  const patchField = (i: number, f: FieldDef, value: string) => {
    const v: unknown = f.list
      ? value.split('\n').map(s => s.trim()).filter(Boolean)
      : value
    setSections(sections.map((s, k) => (k === i ? ({ ...s, [f.key]: v } as Section) : s)))
  }
  const addSection = (type: SectionType) => {
    if (!type) return
    setSections([...sections, defaultSection(type)])
  }
  const setEffect = (key: keyof DesignEffects, val: boolean) =>
    onChange({ ...design, theme: { ...design.theme, effects: { ...fx, [key]: val } } })
  const setPremiumColor = (key: 'dark' | 'watermark' | 'onAccent', val: string) =>
    onChange({ ...design, theme: { ...design.theme, colors: { ...colors, [key]: val } } })

  const present = new Set(sections.map(s => s.type))
  const addOptions = ADDABLE.filter(t => !(SINGLETONS.includes(t) && present.has(t)))

  const premiumColors: Array<{ key: 'dark' | 'watermark' | 'onAccent'; label: string; value: string }> = [
    { key: 'dark',      label: 'Faixas escuras', value: colors.dark ?? darkColor(design.theme) },
    { key: 'watermark', label: 'Marca d’água', value: colors.watermark ?? watermarkColor(design.theme) },
    { key: 'onAccent',  label: 'Texto no botão', value: colors.onAccent ?? onAccentColor(design.theme) },
  ]

  return (
    <>
      <div className={CARD}>
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">Cores premium</h2>
        <div className="grid grid-cols-3 gap-2">
          {premiumColors.map(c => (
            <div key={c.key} className="space-y-1">
              <p className="text-[10px] text-zinc-500 truncate">{c.label}</p>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(c.value) ? c.value : '#000000'}
                onChange={e => setPremiumColor(c.key, e.target.value)}
                className="w-full h-8 rounded border border-zinc-800 bg-transparent cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">Efeitos</h2>
        {EFFECT_LABELS.map(e => (
          <label key={e.key} className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-sm text-zinc-300">{e.label}</span>
            <input
              type="checkbox"
              checked={fx[e.key]}
              onChange={ev => setEffect(e.key, ev.target.checked)}
              className="w-4 h-4 accent-cyan-400"
            />
          </label>
        ))}
      </div>

      <div className={CARD}>
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">Seções da página</h2>
        <p className="text-[11px] text-zinc-500">Reordene, edite os textos ou remova. Cabeçalho, vitrine e rodapé são garantidos ao salvar.</p>

        {sections.map((s, i) => {
          const meta = SECTION_META[s.type]
          if (!meta) return null
          return (
            <div key={`${s.type}-${i}`} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-200 flex-1 truncate">{meta.label}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label="Mover para cima"
                  className="p-1 rounded text-zinc-400 hover:text-cyan-300 disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                  aria-label="Mover para baixo"
                  className="p-1 rounded text-zinc-400 hover:text-cyan-300 disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={() => remove(i)}
                  aria-label="Remover seção"
                  className="p-1 rounded text-zinc-400 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
              {meta.fields.length > 0 && (
                <div className="space-y-1.5">
                  {meta.fields.map(f => (
                    <div key={f.key} className="space-y-0.5">
                      <p className="text-[10px] text-zinc-500">{f.label}</p>
                      {f.area || f.list ? (
                        <textarea
                          rows={f.list ? 3 : 2}
                          value={fieldValue(s, f)}
                          onChange={e => patchField(i, f, e.target.value)}
                          className={`${INPUT} resize-none`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={fieldValue(s, f)}
                          onChange={e => patchField(i, f, e.target.value)}
                          className={INPUT}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-1.5 pt-1">
          <Plus size={13} className="text-zinc-500 shrink-0" />
          <select
            value=""
            onChange={e => { addSection(e.target.value as SectionType); e.target.value = '' }}
            aria-label="Adicionar seção"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-cyan-400/60 cursor-pointer"
          >
            <option value="">Adicionar seção…</option>
            {addOptions.map(t => (
              <option key={t} value={t}>{SECTION_META[t]?.label ?? t}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}
