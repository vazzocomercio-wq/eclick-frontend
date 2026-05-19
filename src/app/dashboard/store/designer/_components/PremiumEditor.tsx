'use client'

/**
 * Editor manual do Tema Premium (v2) — cores premium, efeitos globais e
 * gerenciador de secoes (reordenar, remover, adicionar, editar textos +
 * sub-editores estruturados: nav, footer, categorias, slides, hotspots,
 * countdown, fonte da vitrine).
 *
 * Sub-editores ficam inline no fim do arquivo. O loop principal de secoes
 * monta o card padrao (header + campos textuais simples) e abaixo renderiza
 * o sub-editor especifico do tipo, quando aplicavel.
 */

import { ChevronUp, ChevronDown, Trash2, Plus, X, GripVertical, ImagePlus, Wand2, Loader2, Link as LinkIcon } from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import { useTranslations } from 'next-intl'
import type {
  StorefrontDesign, Section, SectionType, DesignEffects,
  AnnouncementBarSection, SiteHeaderSection, HeroPortraitSection,
  CategoryGridSection, ProductShowcaseSection, ImageHotspotSection,
  SiteFooterSection,
} from '@/lib/storefront/types'
import { effects, darkColor, watermarkColor, onAccentColor } from '@/lib/storefront/theme'

type Translate = ReturnType<typeof useTranslations>
type FieldDef = { key: string; labelKey: string; area?: boolean; list?: boolean }

/** Helpers vindos do designer/page.tsx pra alimentar o ImagePicker. */
interface AssetCtx {
  onUploadImage?:          (b64: string, mime: string) => Promise<string>
  onGenerateSectionImage?: (sectionIndex: number, slot: string | undefined, prompt: string | undefined) => Promise<string>
  downscale?:              (file: File) => Promise<string>
}
const AssetContext = createContext<AssetCtx>({})
const useAssets = () => useContext(AssetContext)

/** Metadados estruturais das seções — `labelKey`/`fields[].labelKey` apontam pro fragmento. */
const SECTION_META: Record<string, { labelKey: string; fields: FieldDef[] }> = {
  announcementBar: { labelKey: 'sectionAnnouncementBar', fields: [{ key: 'message', labelKey: 'fieldMessage' }] },
  siteHeader:      { labelKey: 'sectionSiteHeader', fields: [] },
  heroPortrait:    { labelKey: 'sectionHeroPortrait', fields: [
    { key: 'watermark', labelKey: 'fieldWatermark' },
    { key: 'headline', labelKey: 'fieldHeadline' },
    { key: 'subheadline', labelKey: 'fieldSubheadline' },
    { key: 'ctaLabel', labelKey: 'fieldCtaLabel' },
  ] },
  marquee:         { labelKey: 'sectionMarquee', fields: [{ key: 'items', labelKey: 'fieldPhrases', list: true }] },
  productShowcase: { labelKey: 'sectionProductShowcase', fields: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'watermark', labelKey: 'fieldWatermark' },
  ] },
  categoryGrid:    { labelKey: 'sectionCategoryGrid', fields: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'watermark', labelKey: 'fieldWatermark' },
  ] },
  editorialSplit:  { labelKey: 'sectionEditorialSplit', fields: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'body', labelKey: 'fieldBody', area: true },
    { key: 'imageUrl', labelKey: 'imageUrlLabel' },
    { key: 'ctaLabel', labelKey: 'fieldCtaLabel' },
    { key: 'ctaHref', labelKey: 'linkHref' },
  ] },
  tiltBanner:      { labelKey: 'sectionTiltBanner', fields: [
    { key: 'headline', labelKey: 'fieldHeadline' },
    { key: 'watermark', labelKey: 'fieldWatermark' },
    { key: 'imageUrl', labelKey: 'imageUrlLabel' },
  ] },
  fullBanner:      { labelKey: 'sectionFullBanner', fields: [
    { key: 'headline', labelKey: 'fieldHeadline' },
    { key: 'subheadline', labelKey: 'fieldSubheadline' },
    { key: 'ctaLabel', labelKey: 'fieldCtaLabel' },
    { key: 'imageUrl', labelKey: 'imageUrlLabel' },
  ] },
  imageHotspot:    { labelKey: 'sectionImageHotspot', fields: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'imageUrl', labelKey: 'imageUrlLabel' },
  ] },
  siteFooter:      { labelKey: 'sectionSiteFooter', fields: [] },
}

/** Tipos que só fazem sentido uma vez por loja. */
const SINGLETONS: SectionType[] = ['announcementBar', 'siteHeader', 'siteFooter']

const ADDABLE: SectionType[] = [
  'announcementBar', 'siteHeader', 'heroPortrait', 'marquee', 'productShowcase',
  'categoryGrid', 'editorialSplit', 'tiltBanner', 'fullBanner', 'imageHotspot', 'siteFooter',
]

const EFFECT_LABELS: Array<{ key: keyof DesignEffects; labelKey: string }> = [
  { key: 'scrollReveal',  labelKey: 'effectScrollReveal' },
  { key: 'watermarks',    labelKey: 'effectWatermarks' },
  { key: 'parallaxTilt',  labelKey: 'effectParallaxTilt' },
  { key: 'hoverRollover', labelKey: 'effectHoverRollover' },
]

/** Conteúdo inicial das seções recém-adicionadas — textos traduzidos via `t`. */
function defaultSection(type: SectionType, t: Translate): Section {
  switch (type) {
    case 'announcementBar': return { type, message: t('seedAnnouncement'), countdownTo: null }
    case 'siteHeader':      return { type, variant: 'split', sticky: true, showSearch: true, showCart: true, nav: [] }
    case 'heroPortrait':    return { type, watermark: t('seedHeroWatermark'), headline: t('seedHeroHeadline'), subheadline: t('seedHeroSubheadline'), ctaLabel: t('seedHeroCta'), slides: [{ imageUrl: '', label: t('seedHeroSlide') }] }
    case 'marquee':         return { type, items: [t('seedMarquee1'), t('seedMarquee2')] }
    case 'productShowcase': return { type, layout: 'carousel', title: t('seedProducts'), source: 'storefront', collectionId: null }
    case 'categoryGrid':    return { type, title: t('seedCategories'), categories: [] }
    case 'editorialSplit':  return { type, title: t('seedEditorialTitle'), body: t('seedEditorialBody'), imageUrl: '', imageSide: 'right' }
    case 'tiltBanner':      return { type, imageUrl: '', headline: t('seedTiltHeadline') }
    case 'fullBanner':      return { type, imageUrl: '', headline: t('seedFullHeadline') }
    case 'imageHotspot':    return { type, imageUrl: '', hotspots: [] }
    case 'siteFooter':      return { type, variant: 'columns', newsletter: true }
    default:                return { type: 'productShowcase', layout: 'grid', title: t('seedProducts'), source: 'storefront', collectionId: null }
  }
}

function fieldValue(section: Section, f: FieldDef): string {
  const raw = (section as unknown as Record<string, unknown>)[f.key]
  if (f.list) return Array.isArray(raw) ? raw.join('\n') : ''
  return typeof raw === 'string' ? raw : ''
}

const CARD = 'rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3'
const INPUT = 'w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400/60'
const SUBCARD = 'rounded border border-zinc-800/70 bg-zinc-950/60 p-2.5 space-y-2'
const SMALL_BTN = 'p-1 rounded text-zinc-400 hover:text-cyan-300 disabled:opacity-30'

export function PremiumEditor({
  design, onChange, onUploadImage, onGenerateSectionImage, downscale,
}: {
  design:                   StorefrontDesign
  onChange:                 (d: StorefrontDesign) => void
  onUploadImage?:           (b64: string, mime: string) => Promise<string>
  onGenerateSectionImage?:  (sectionIndex: number, slot: string | undefined, prompt: string | undefined) => Promise<string>
  downscale?:               (file: File) => Promise<string>
}) {
  const t = useTranslations('store.designer.premium')
  const assetCtx: AssetCtx = { onUploadImage, onGenerateSectionImage, downscale }
  const sections = design.sections
  const fx = effects(design.theme)
  const colors = design.theme.colors

  const setSections = (next: Section[]) => onChange({ ...design, sections: next })
  const patchSection = <T extends Section>(i: number, patch: Partial<T>) =>
    setSections(sections.map((s, k) => (k === i ? ({ ...s, ...patch } as Section) : s)))
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
    setSections([...sections, defaultSection(type, t)])
  }
  const setEffect = (key: keyof DesignEffects, val: boolean) =>
    onChange({ ...design, theme: { ...design.theme, effects: { ...fx, [key]: val } } })
  const setPremiumColor = (key: 'dark' | 'watermark' | 'onAccent', val: string) =>
    onChange({ ...design, theme: { ...design.theme, colors: { ...colors, [key]: val } } })

  const present = new Set(sections.map(s => s.type))
  const addOptions = ADDABLE.filter(st => !(SINGLETONS.includes(st) && present.has(st)))

  const premiumColors: Array<{ key: 'dark' | 'watermark' | 'onAccent'; label: string; value: string }> = [
    { key: 'dark',      label: t('premiumColorDark'),     value: colors.dark ?? darkColor(design.theme) },
    { key: 'watermark', label: t('premiumColorWatermark'), value: colors.watermark ?? watermarkColor(design.theme) },
    { key: 'onAccent',  label: t('premiumColorOnAccent'),  value: colors.onAccent ?? onAccentColor(design.theme) },
  ]

  return (
    <AssetContext.Provider value={assetCtx}>
      <div className={CARD}>
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">{t('premiumColors')}</h2>
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
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">{t('effects')}</h2>
        {EFFECT_LABELS.map(e => (
          <label key={e.key} className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-sm text-zinc-300">{t(e.labelKey)}</span>
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
        <h2 className="text-xs uppercase tracking-wider text-zinc-300">{t('pageSections')}</h2>
        <p className="text-[11px] text-zinc-500">{t('pageSectionsHint')}</p>

        {sections.map((s, i) => {
          const meta = SECTION_META[s.type]
          if (!meta) return null
          return (
            <div key={`${s.type}-${i}`} className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-200 flex-1 truncate">{t(meta.labelKey)}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  aria-label={t('moveUp')} className={SMALL_BTN}>
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                  aria-label={t('moveDown')} className={SMALL_BTN}>
                  <ChevronDown size={14} />
                </button>
                <button type="button" onClick={() => remove(i)}
                  aria-label={t('removeSection')}
                  className="p-1 rounded text-zinc-400 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Campos textuais simples (definidos em SECTION_META) */}
              {meta.fields.length > 0 && (
                <div className="space-y-1.5">
                  {meta.fields.map(f => (
                    <div key={f.key} className="space-y-0.5">
                      <p className="text-[10px] text-zinc-500">{t(f.labelKey)}</p>
                      {f.key === 'imageUrl' ? (
                        <ImagePicker t={t} value={fieldValue(s, f)}
                          sectionIndex={i}
                          onUrl={v => patchField(i, f, v)} />
                      ) : f.area || f.list ? (
                        <textarea rows={f.list ? 3 : 2}
                          value={fieldValue(s, f)}
                          onChange={e => patchField(i, f, e.target.value)}
                          className={`${INPUT} resize-none`} />
                      ) : (
                        <input type="text"
                          value={fieldValue(s, f)}
                          onChange={e => patchField(i, f, e.target.value)}
                          className={INPUT} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sub-editores estruturados por tipo */}
              {s.type === 'announcementBar' && (
                <CountdownEditor t={t}
                  value={s.countdownTo ?? null}
                  onChange={v => patchSection<AnnouncementBarSection>(i, { countdownTo: v })} />
              )}

              {s.type === 'siteHeader' && (
                <HeaderEditor t={t} section={s}
                  onPatch={p => patchSection<SiteHeaderSection>(i, p)} />
              )}

              {s.type === 'heroPortrait' && (
                <SlidesEditor t={t} sectionIndex={i} slides={s.slides}
                  onChange={slides => patchSection<HeroPortraitSection>(i, { slides })} />
              )}

              {s.type === 'productShowcase' && (
                <ShowcaseSourceEditor t={t} section={s}
                  onPatch={p => patchSection<ProductShowcaseSection>(i, p)} />
              )}

              {s.type === 'categoryGrid' && (
                <CategoriesEditor t={t} sectionIndex={i} categories={s.categories}
                  onChange={categories => patchSection<CategoryGridSection>(i, { categories })} />
              )}

              {s.type === 'imageHotspot' && (
                <HotspotsEditor t={t} imageUrl={s.imageUrl} hotspots={s.hotspots}
                  onChange={hotspots => patchSection<ImageHotspotSection>(i, { hotspots })} />
              )}

              {s.type === 'siteFooter' && (
                <FooterEditor t={t} section={s}
                  onPatch={p => patchSection<SiteFooterSection>(i, p)} />
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-1.5 pt-1">
          <Plus size={13} className="text-zinc-500 shrink-0" />
          <select value=""
            onChange={e => { addSection(e.target.value as SectionType); e.target.value = '' }}
            aria-label={t('addSection')}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-cyan-400/60 cursor-pointer">
            <option value="">{t('addSectionPlaceholder')}</option>
            {addOptions.map(st => (
              <option key={st} value={st}>{SECTION_META[st] ? t(SECTION_META[st].labelKey) : st}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Configuração da página de produto ── */}
      <ProductPageConfig
        product={design.product}
        onChange={p => onChange({ ...design, product: p })}
      />
    </AssetContext.Provider>
  )
}

function ProductPageConfig({ product, onChange }: {
  product:  StorefrontDesign['product']
  onChange: (p: StorefrontDesign['product']) => void
}) {
  return (
    <div className={CARD}>
      <h2 className="text-xs uppercase tracking-wider text-zinc-300">Página de produto</h2>

      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">Botão principal</p>
        <div className="flex gap-1">
          {(['whatsapp', 'cart'] as const).map(v => (
            <button key={v} type="button" onClick={() => onChange({ ...product, ctaMode: v })}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] border transition-colors ${
                product.ctaMode === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'whatsapp' ? 'Comprar pelo WhatsApp' : 'Adicionar ao carrinho'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600">
          {product.ctaMode === 'cart'
            ? 'Carrinho aparece no cabeçalho. Checkout abre WhatsApp com a lista do pedido.'
            : 'CTA único: clique vai direto pro WhatsApp com a mensagem do produto.'}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">Galeria</p>
        <div className="flex gap-1">
          {(['side', 'top'] as const).map(v => (
            <button key={v} type="button" onClick={() => onChange({ ...product, gallery: v })}
              className={`flex-1 px-2 py-1.5 rounded text-[11px] border transition-colors ${
                product.gallery === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'side' ? 'Ao lado (desktop)' : 'No topo'}
            </button>
          ))}
        </div>
      </div>

      <Pill label="Mostrar ficha técnica (atributos)"
        checked={product.showAttributes}
        onChange={v => onChange({ ...product, showAttributes: v })} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  Sub-editores estruturados — cada um recebe o pedaço editavel e
 *  notifica o pai via onChange/onPatch. Visualmente seguem o padrao
 *  do CARD/SUBCARD. Todos sao puros (sem fetch).
 *  ──────────────────────────────────────────────────────────────── */

function CountdownEditor({ t, value, onChange }: {
  t: Translate; value: string | null; onChange: (v: string | null) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-zinc-500">{t('countdown')}</p>
      <input type="text" value={value ?? ''} placeholder="2026-12-25T18:00:00-03:00"
        onChange={e => onChange(e.target.value.trim() || null)}
        className={`${INPUT} font-mono`} />
      <p className="text-[10px] text-zinc-600">{t('countdownHint')}</p>
    </div>
  )
}

function HeaderEditor({ t, section, onPatch }: {
  t: Translate; section: SiteHeaderSection; onPatch: (p: Partial<SiteHeaderSection>) => void
}) {
  const addItem = () => onPatch({ nav: [...section.nav, { label: '', href: '#' }] })
  const updateItem = (i: number, key: 'label' | 'href', v: string) =>
    onPatch({ nav: section.nav.map((it, k) => k === i ? { ...it, [key]: v } : it) })
  const removeIt = (i: number) => onPatch({ nav: section.nav.filter((_, k) => k !== i) })

  return (
    <div className="space-y-2">
      {/* Toggles do header */}
      <div className="grid grid-cols-2 gap-2">
        <Pill label={t('headerSticky')} checked={section.sticky}
          onChange={v => onPatch({ sticky: v })} />
        <Pill label={t('headerShowSearch')} checked={section.showSearch}
          onChange={v => onPatch({ showSearch: v })} />
        <Pill label={t('headerShowCart')} checked={section.showCart}
          onChange={v => onPatch({ showCart: v })} />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">{t('headerVariant')}</p>
        <div className="flex gap-1">
          {(['split', 'centered'] as const).map(v => (
            <button key={v} type="button" onClick={() => onPatch({ variant: v })}
              className={`flex-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                section.variant === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'split' ? t('variantSplit') : t('variantCentered')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] text-zinc-500">{t('navItems')}</p>
        {section.nav.length === 0 && <p className="text-[10px] text-zinc-600 italic">{t('emptyList')}</p>}
        {section.nav.map((it, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <GripVertical size={12} className="text-zinc-700 shrink-0" />
            <input value={it.label} onChange={e => updateItem(i, 'label', e.target.value)}
              placeholder={t('linkLabel')} className={`${INPUT} flex-1`} />
            <input value={it.href} onChange={e => updateItem(i, 'href', e.target.value)}
              placeholder="#" className={`${INPUT} flex-1 font-mono`} />
            <button type="button" onClick={() => removeIt(i)} aria-label={t('removeItem')}
              className="p-1 text-zinc-500 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
          <Plus size={11} /> {t('addItem')}
        </button>
      </div>
    </div>
  )
}

function SlidesEditor({ t, sectionIndex, slides, onChange }: {
  t: Translate
  sectionIndex: number
  slides: HeroPortraitSection['slides']
  onChange: (s: HeroPortraitSection['slides']) => void
}) {
  const add = () => onChange([...slides, { imageUrl: '', label: '' }])
  const update = (i: number, key: 'imageUrl' | 'label' | 'href', v: string) =>
    onChange(slides.map((sl, k) => k === i ? { ...sl, [key]: v } : sl))
  const remove = (i: number) => onChange(slides.filter((_, k) => k !== i))

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-zinc-500">{t('slidesTitle')}</p>
      {slides.length === 0 && <p className="text-[10px] text-zinc-600 italic">{t('emptyList')}</p>}
      {slides.map((sl, i) => (
        <div key={i} className={SUBCARD}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 flex-1">#{i + 1}</span>
            <button type="button" onClick={() => remove(i)} aria-label={t('removeItem')}
              className="p-1 text-zinc-500 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
          <input value={sl.label ?? ''} onChange={e => update(i, 'label', e.target.value)}
            placeholder={t('slideLabel')} className={INPUT} />
          <ImagePicker t={t} value={sl.imageUrl}
            sectionIndex={sectionIndex} slot={`slide:${i}`}
            onUrl={v => update(i, 'imageUrl', v)} />
          <input value={sl.href ?? ''} onChange={e => update(i, 'href', e.target.value)}
            placeholder={t('slideHref')} className={`${INPUT} font-mono`} />
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
        <Plus size={11} /> {t('addItem')}
      </button>
    </div>
  )
}

function CategoriesEditor({ t, sectionIndex, categories, onChange }: {
  t: Translate
  sectionIndex: number
  categories: CategoryGridSection['categories']
  onChange: (c: CategoryGridSection['categories']) => void
}) {
  const add = () => onChange([...categories, { label: '', imageUrl: '' }])
  const update = (i: number, key: 'label' | 'imageUrl' | 'href', v: string) =>
    onChange(categories.map((c, k) => k === i ? { ...c, [key]: v } : c))
  const remove = (i: number) => onChange(categories.filter((_, k) => k !== i))

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-zinc-500">{t('categoriesTitle')}</p>
      {categories.length === 0 && <p className="text-[10px] text-zinc-600 italic">{t('emptyList')}</p>}
      {categories.map((c, i) => (
        <div key={i} className={SUBCARD}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 flex-1">#{i + 1}</span>
            <button type="button" onClick={() => remove(i)} aria-label={t('removeItem')}
              className="p-1 text-zinc-500 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
          <input value={c.label} onChange={e => update(i, 'label', e.target.value)}
            placeholder={t('categoryLabel')} className={INPUT} />
          <ImagePicker t={t} value={c.imageUrl}
            sectionIndex={sectionIndex} slot={`category:${i}`}
            onUrl={v => update(i, 'imageUrl', v)} />
          <input value={c.href ?? ''} onChange={e => update(i, 'href', e.target.value)}
            placeholder={t('linkHref')} className={`${INPUT} font-mono`} />
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
        <Plus size={11} /> {t('addItem')}
      </button>
    </div>
  )
}

function HotspotsEditor({ t, imageUrl, hotspots, onChange }: {
  t: Translate
  imageUrl: string
  hotspots: ImageHotspotSection['hotspots']
  onChange: (h: ImageHotspotSection['hotspots']) => void
}) {
  const add = (xPct = 50, yPct = 50) =>
    onChange([...hotspots, { xPct, yPct, label: '' }])
  const update = (i: number, key: 'xPct' | 'yPct' | 'label' | 'productId', v: string | number) =>
    onChange(hotspots.map((h, k) => k === i ? { ...h, [key]: v } : h))
  const remove = (i: number) => onChange(hotspots.filter((_, k) => k !== i))

  // Clique na imagem => adiciona hotspot na posicao percentual
  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!imageUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    add(xPct, yPct)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-zinc-500">{t('hotspotsTitle')}</p>
      {!imageUrl && (
        <p className="text-[10px] text-amber-300/80 italic">{t('hotspotImageNeeded')}</p>
      )}
      {imageUrl && (
        <div className="space-y-1">
          <p className="text-[10px] text-zinc-600">{t('hotspotPosition')}</p>
          <div onClick={onImageClick}
            className="relative w-full overflow-hidden rounded border border-zinc-800 cursor-crosshair"
            style={{ aspectRatio: '16 / 9' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            {hotspots.map((h, i) => (
              <span key={i} title={h.label}
                className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/90 border-2 border-white shadow-lg pointer-events-none flex items-center justify-center text-[9px] font-bold text-black"
                style={{ left: `${h.xPct}%`, top: `${h.yPct}%` }}>
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      )}
      {hotspots.length === 0 && <p className="text-[10px] text-zinc-600 italic">{t('emptyList')}</p>}
      {hotspots.map((h, i) => (
        <div key={i} className={SUBCARD}>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-cyan-400/90 text-black text-[9px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
            <span className="text-[10px] text-zinc-500 flex-1">x={h.xPct}% y={h.yPct}%</span>
            <button type="button" onClick={() => remove(i)} aria-label={t('removeItem')}
              className="p-1 text-zinc-500 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
          <input value={h.label ?? ''} onChange={e => update(i, 'label', e.target.value)}
            placeholder={t('hotspotLabel')} className={INPUT} />
          <input value={h.productId ?? ''} onChange={e => update(i, 'productId', e.target.value)}
            placeholder={t('hotspotProductId')} className={`${INPUT} font-mono`} />
          <div className="grid grid-cols-2 gap-1.5">
            <input type="number" min={0} max={100} value={h.xPct}
              onChange={e => update(i, 'xPct', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className={INPUT} />
            <input type="number" min={0} max={100} value={h.yPct}
              onChange={e => update(i, 'yPct', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className={INPUT} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ShowcaseSourceEditor({ t, section, onPatch }: {
  t: Translate; section: ProductShowcaseSection; onPatch: (p: Partial<ProductShowcaseSection>) => void
}) {
  const ids = (section.productIds ?? []).join('\n')
  const setIds = (raw: string) => {
    const arr = raw.split('\n').map(s => s.trim()).filter(Boolean)
    onPatch({ productIds: arr.length ? arr : undefined })
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">{t('showcaseLayout')}</p>
        <div className="flex gap-1">
          {(['carousel', 'grid'] as const).map(v => (
            <button key={v} type="button" onClick={() => onPatch({ layout: v })}
              className={`flex-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                section.layout === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'carousel' ? t('layoutCarousel') : t('layoutGrid')}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">{t('showcaseSource')}</p>
        <div className="flex flex-wrap gap-1">
          {(['storefront', 'collection', 'manual'] as const).map(v => (
            <button key={v} type="button" onClick={() => onPatch({ source: v })}
              className={`flex-1 min-w-[80px] px-2 py-1 rounded text-[11px] border transition-colors ${
                section.source === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'storefront' ? t('sourceStorefront')
                : v === 'collection' ? t('sourceCollection')
                : t('sourceManual')}
            </button>
          ))}
        </div>
      </div>
      {section.source === 'collection' && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-zinc-500">{t('collectionIdLabel')}</p>
          <input value={section.collectionId ?? ''}
            onChange={e => onPatch({ collectionId: e.target.value.trim() || null })}
            placeholder="uuid…" className={`${INPUT} font-mono`} />
        </div>
      )}
      {section.source === 'manual' && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-zinc-500">{t('productIdsLabel')}</p>
          <textarea rows={3} value={ids} onChange={e => setIds(e.target.value)}
            placeholder="uuid…" className={`${INPUT} resize-none font-mono`} />
        </div>
      )}
    </div>
  )
}

function FooterEditor({ t, section, onPatch }: {
  t: Translate; section: SiteFooterSection; onPatch: (p: Partial<SiteFooterSection>) => void
}) {
  const cols = section.columns ?? []
  const setCols = (next: NonNullable<SiteFooterSection['columns']>) =>
    onPatch({ columns: next.length ? next : undefined })

  const addCol = () => setCols([...cols, { title: '', links: [] }])
  const removeCol = (i: number) => setCols(cols.filter((_, k) => k !== i))
  const updateColTitle = (i: number, title: string) =>
    setCols(cols.map((c, k) => k === i ? { ...c, title } : c))
  const addLink = (i: number) =>
    setCols(cols.map((c, k) => k === i ? { ...c, links: [...c.links, { label: '', href: '#' }] } : c))
  const updateLink = (i: number, li: number, key: 'label' | 'href', v: string) =>
    setCols(cols.map((c, k) => k === i ? {
      ...c, links: c.links.map((l, lk) => lk === li ? { ...l, [key]: v } : l),
    } : c))
  const removeLink = (i: number, li: number) =>
    setCols(cols.map((c, k) => k === i ? { ...c, links: c.links.filter((_, lk) => lk !== li) } : c))

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500">{t('footerVariant')}</p>
        <div className="flex gap-1">
          {(['columns', 'minimal'] as const).map(v => (
            <button key={v} type="button" onClick={() => onPatch({ variant: v })}
              className={`flex-1 px-2 py-1 rounded text-[11px] border transition-colors ${
                section.variant === v ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300'
                  : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}>
              {v === 'columns' ? t('variantColumns') : t('variantMinimal')}
            </button>
          ))}
        </div>
      </div>

      <Pill label={t('newsletterToggle')} checked={!!section.newsletter}
        onChange={v => onPatch({ newsletter: v })} />

      {section.variant === 'columns' && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-zinc-500">{t('footerColumnsTitle')}</p>
          {cols.length === 0 && <p className="text-[10px] text-zinc-600 italic">{t('emptyList')}</p>}
          {cols.map((c, ci) => (
            <div key={ci} className={SUBCARD}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 flex-1">{t('footerColumnTitle')}</span>
                <button type="button" onClick={() => removeCol(ci)} aria-label={t('removeItem')}
                  className="p-1 text-zinc-500 hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
              <input value={c.title} onChange={e => updateColTitle(ci, e.target.value)}
                className={INPUT} />
              <div className="space-y-1 pl-2 border-l border-zinc-800/50">
                <p className="text-[10px] text-zinc-600">{t('footerLinks')}</p>
                {c.links.length === 0 && <p className="text-[10px] text-zinc-700 italic">{t('emptyList')}</p>}
                {c.links.map((l, li) => (
                  <div key={li} className="flex gap-1.5 items-center">
                    <input value={l.label} onChange={e => updateLink(ci, li, 'label', e.target.value)}
                      placeholder={t('linkLabel')} className={`${INPUT} flex-1`} />
                    <input value={l.href} onChange={e => updateLink(ci, li, 'href', e.target.value)}
                      placeholder="#" className={`${INPUT} flex-1 font-mono`} />
                    <button type="button" onClick={() => removeLink(ci, li)} aria-label={t('removeItem')}
                      className="p-1 text-zinc-500 hover:text-red-400">
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addLink(ci)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
                  <Plus size={10} /> {t('addItem')}
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addCol}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
            <Plus size={11} /> {t('addItem')}
          </button>
        </div>
      )}
    </div>
  )
}

function Pill({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer rounded border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5">
      <span className="text-[11px] text-zinc-300">{label}</span>
      <input type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 accent-cyan-400" />
    </label>
  )
}

/* ────────────────────────────────────────────────────────────────────
 *  ImagePicker — input de imagem com 3 modos:
 *   - URL direta (input text)
 *   - Upload manual (file -> downscale -> base64 -> POST /upload-asset)
 *   - Gerar com IA (prompt curto -> POST /section-image com sectionIndex+slot)
 *
 *  Quando o lojista NAO fornece as callbacks (uso fora do designer), o
 *  picker degrada pra so URL direta. Tudo controlado: a URL final flui
 *  via onUrl pro pai.
 *  ──────────────────────────────────────────────────────────────── */

function ImagePicker({ t, value, sectionIndex, slot, onUrl }: {
  t:            Translate
  value:        string
  sectionIndex: number
  slot?:        string
  onUrl:        (url: string) => void
}) {
  const ctx = useAssets()
  const [mode, setMode] = useState<'url' | 'upload' | 'ai'>(value ? 'url' : 'url')
  const [aiPrompt, setAiPrompt] = useState('')
  const [busy, setBusy] = useState<'upload' | 'ai' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function handleUpload(file: File) {
    if (!ctx.onUploadImage) { setErr('Upload indisponível.'); return }
    setBusy('upload'); setErr(null)
    try {
      const b64Data = ctx.downscale ? await ctx.downscale(file) : await fileToBase64(file)
      const comma = b64Data.indexOf(',')
      const pureB64 = comma >= 0 ? b64Data.slice(comma + 1) : b64Data
      const url = await ctx.onUploadImage(pureB64, file.type || 'image/jpeg')
      onUrl(url)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(null) }
  }

  async function handleGenerate() {
    if (!ctx.onGenerateSectionImage) { setErr('Geração indisponível.'); return }
    setBusy('ai'); setErr(null)
    try {
      const url = await ctx.onGenerateSectionImage(sectionIndex, slot, aiPrompt.trim() || undefined)
      onUrl(url)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(null) }
  }

  const canUpload = !!ctx.onUploadImage
  const canAi     = !!ctx.onGenerateSectionImage

  return (
    <div className="space-y-1.5">
      {/* Preview */}
      {value && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-20 object-cover rounded border border-zinc-800" />
          <button type="button" onClick={() => onUrl('')} aria-label={t('removeItem')}
            className="absolute top-1 right-1 p-1 rounded bg-black/70 text-zinc-200 hover:text-white">
            <X size={11} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        <PickerTab active={mode === 'url'}     onClick={() => setMode('url')}     icon={<LinkIcon size={10} />}     label="URL" />
        {canUpload && <PickerTab active={mode === 'upload'} onClick={() => setMode('upload')} icon={<ImagePlus size={10} />} label={t('imageUpload')} />}
        {canAi     && <PickerTab active={mode === 'ai'}     onClick={() => setMode('ai')}     icon={<Wand2 size={10} />}     label={t('imageGenerateAi')} />}
      </div>

      {mode === 'url' && (
        <input value={value} onChange={e => onUrl(e.target.value)}
          placeholder={t('imageUrlPlaceholder')} className={`${INPUT} font-mono`} />
      )}

      {mode === 'upload' && canUpload && (
        <label className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-dashed text-[11px] cursor-pointer transition-colors ${
          busy === 'upload' ? 'border-cyan-400/40 text-cyan-300' : 'border-zinc-700 hover:border-cyan-400/50 text-zinc-400 hover:text-cyan-300'
        }`}>
          {busy === 'upload' ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
          {busy === 'upload' ? t('imageUploading') : t('imageUpload')}
          <input type="file" accept="image/*" className="hidden" disabled={busy !== null}
            onChange={e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void handleUpload(f)
            }} />
        </label>
      )}

      {mode === 'ai' && canAi && (
        <div className="space-y-1.5">
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            placeholder={t('imageGenerationHint')} className={INPUT}
            disabled={busy !== null} />
          <button type="button" onClick={handleGenerate} disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-zinc-700 hover:border-cyan-400/50 hover:text-cyan-300 text-zinc-300 text-[11px] disabled:opacity-40">
            {busy === 'ai' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {busy === 'ai' ? t('imageGenerating') : t('imageGenerateAi')}
          </button>
        </div>
      )}

      {err && (
        <p className="text-[10px] text-red-300">⚠ {err}</p>
      )}
    </div>
  )
}

function PickerTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
        active ? 'border-cyan-400/70 bg-cyan-400/5 text-cyan-300' : 'border-zinc-800 hover:border-zinc-700 text-zinc-400'
      }`}>
      {icon}{label}
    </button>
  )
}

/** Fallback quando downscale nao foi passado (usar tal qual). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}
