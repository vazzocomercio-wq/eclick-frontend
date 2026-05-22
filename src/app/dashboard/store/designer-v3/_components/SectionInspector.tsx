'use client'

/**
 * SectionInspector — painel de edicao de uma section especifica.
 *
 * Estrutura:
 *  - Cabecalho: type label + botao Voltar
 *  - Bloco "Visibilidade" (mobile/desktop)
 *  - Bloco "Espacamento" (padding top/bottom)
 *  - Bloco "Fundo" (color/image/gradient)
 *  - Bloco "Configurações" (settings especificos do type)
 *  - Bloco "Blocos" (se a section aceita blocks)
 *
 * Switch por section.type pra renderizar o sub-editor especifico de
 * settings. Sections com schema simples (Marquee, Faq, Newsletter, etc.)
 * tem editor inline; complexas (Hero, Slider, ProductGrid) tem helpers
 * proprios.
 */

import { ArrowLeft } from 'lucide-react'
import type {
  Section, SectionType, BackgroundStyle,
  HeroSection, SliderSection, ImageBannerSection, ImageHotspotSection,
  ImageWithTextSection, MarqueeSection, ProductGridSection, ProductCarouselSection,
  FeaturedProductSection, CollectionGridSection, ProductSource,
  RichTextSection, TestimonialsSection, LogoListSection, FaqSection,
  NewsletterSection, VideoBlockSection, CustomHtmlSection,
  AnnouncementBarSection, BreadcrumbSection, WhatsappCatalogSection,
  CartLayoutSection, CheckoutLayoutSection, ProductDetailLayoutSection,
  SiteHeaderSection, SiteFooterSection,
} from '@/lib/storefront/v3/types'
import { Acc, Field, Input, Textarea, NumberInput, Select, Toggle, ColorField, Slider } from './primitives'
import { ImageUploadField } from '@/components/storefront/ImageUploadField'
import { BlockListEditor } from './BlockListEditor'
import { CollectionsEditor } from './CollectionsEditor'
import { LeadFormEditor } from './LeadFormEditor'
import type { SectionTypography, FontPair, LeadFormSection } from '@/lib/storefront/v3/types'
import { FONT_PAIRS_V3, FONT_PAIRS_V3_DEFINITIONS } from '@/lib/storefront/v3/font-pairs'

const SECTION_LABELS: Record<SectionType, string> = {
  siteHeader: 'Cabeçalho', siteFooter: 'Rodapé', announcementBar: 'Faixa de anúncio', breadcrumb: 'Trilha',
  hero: 'Hero', slider: 'Carrossel', imageBanner: 'Banner', imageHotspot: 'Hotspots', imageWithText: 'Imagem + texto', marquee: 'Texto rolante',
  productGrid: 'Grade de produtos', productCarousel: 'Carrossel de produtos', featuredProduct: 'Produto em destaque',
  collectionGrid: 'Grade de coleções', productDetailLayout: 'Layout do produto',
  richText: 'Texto rico', testimonials: 'Depoimentos', logoList: 'Logos', faq: 'FAQ', newsletter: 'Newsletter',
  videoBlock: 'Vídeo', customHtml: 'HTML custom',
  cartLayout: 'Carrinho', checkoutLayout: 'Checkout', whatsappCatalog: 'Catálogo WhatsApp',
  leadForm: 'Formulário (lead)',
}

interface Props {
  section:  Section
  onChange: (next: Section) => void
  onBack:   () => void
}

export function SectionInspector({ section, onChange, onBack }: Props) {
  const setSettings = (patch: Partial<Section['settings']>) =>
    onChange({ ...section, settings: { ...section.settings, ...patch } } as Section)

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm mb-3"
        style={{ color: '#00E5FF', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: 36 }}>
        <ArrowLeft size={14} /> Voltar à lista
      </button>
      <div className="mb-3 pb-3" style={{ borderBottom: '1px solid #27272a' }}>
        <h3 className="text-sm font-medium" style={{ color: '#fafafa' }}>{SECTION_LABELS[section.type]}</h3>
        <p className="text-[11px]" style={{ color: '#52525b' }}>{section.type} · {section.id}</p>
      </div>

      {/* Visibilidade */}
      <Acc title="Visibilidade" defaultOpen>
        <Field label="Mostrar no desktop">
          <Toggle value={section.visibility.desktop}
            onChange={v => onChange({ ...section, visibility: { ...section.visibility, desktop: v } })} />
        </Field>
        <Field label="Mostrar no mobile">
          <Toggle value={section.visibility.mobile}
            onChange={v => onChange({ ...section, visibility: { ...section.visibility, mobile: v } })} />
        </Field>
      </Acc>

      {/* Configurações específicas */}
      <Acc title="Configurações" defaultOpen>
        <SettingsEditor section={section} onChange={onChange} setSettings={setSettings} />
      </Acc>

      {/* Blocks (se a section aceita) */}
      {acceptsBlocks(section.type) && (
        <Acc title={`Blocos (${section.blocks.length})`} defaultOpen>
          <BlockListEditor
            blocks={section.blocks}
            sectionType={section.type}
            onChange={next => onChange({ ...section, blocks: next })}
          />
        </Acc>
      )}

      {/* Espaçamento */}
      <Acc title="Espaçamento">
        <Field label="Padding topo (px)">
          <NumberInput value={section.spacing.paddingTop}
            onChange={v => onChange({ ...section, spacing: { ...section.spacing, paddingTop: v } })}
            min={0} max={400} />
        </Field>
        <Field label="Padding inferior (px)">
          <NumberInput value={section.spacing.paddingBottom}
            onChange={v => onChange({ ...section, spacing: { ...section.spacing, paddingBottom: v } })}
            min={0} max={400} />
        </Field>
        <Field label="Margin topo (px)">
          <NumberInput value={section.spacing.marginTop}
            onChange={v => onChange({ ...section, spacing: { ...section.spacing, marginTop: v } })}
            min={0} max={400} />
        </Field>
        <Field label="Margin inferior (px)">
          <NumberInput value={section.spacing.marginBottom}
            onChange={v => onChange({ ...section, spacing: { ...section.spacing, marginBottom: v } })}
            min={0} max={400} />
        </Field>
      </Acc>

      {/* Fundo */}
      <Acc title="Fundo">
        <BackgroundEditor bg={section.background}
          onChange={bg => onChange({ ...section, background: bg })} />
      </Acc>

      {/* Tipografia (override por seção) */}
      <Acc title="Tipografia">
        <TypographyEditor typo={section.typography}
          onChange={typo => onChange({ ...section, typography: typo })} />
      </Acc>

      {/* Ajustes pra mobile (override por dispositivo) */}
      <Acc title="📱 Ajustes pra mobile">
        <MobileOverrideEditor section={section} onChange={onChange} />
      </Acc>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MobileOverrideEditor — edita section.mobileOverrides pra ajustar
// background (cor/imagem/gradiente) e spacing diferentes em <768px.
// ─────────────────────────────────────────────────────────────────────────

function MobileOverrideEditor({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const ov = section.mobileOverrides ?? {}

  const updateOverride = (patch: Partial<NonNullable<Section['mobileOverrides']>>) => {
    onChange({
      ...section,
      mobileOverrides: { ...ov, ...patch },
    } as Section)
  }

  const updateMobileBg = (patch: Partial<BackgroundStyle>) => {
    updateOverride({ background: { ...(ov.background ?? {}), ...patch } as Partial<BackgroundStyle> })
  }

  const mobileBg = ov.background as Partial<BackgroundStyle> | undefined
  const useMobileBg = mobileBg?.kind != null && mobileBg.kind !== 'none'

  return (
    <>
      <div className="p-3 rounded text-xs mb-2" style={{ background: 'rgba(0,229,255,0.05)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}>
        Estes ajustes só aparecem em telas <strong>menores que 768px</strong> (mobile). Útil pra trocar a imagem ou altura no celular.
      </div>

      <Field label="Usar imagem diferente no mobile?">
        <Toggle value={useMobileBg}
          onChange={v => updateOverride({ background: v ? { kind: 'image', imageUrl: '' } : { kind: 'none' } })} />
      </Field>

      {useMobileBg && (
        <>
          <Field label="Imagem de fundo (mobile)">
            <ImageUploadField value={mobileBg?.imageUrl ?? ''}
              onChange={v => updateMobileBg({ kind: 'image', imageUrl: v })}
              previewMaxWidth={200} downscaleMaxWidth={1200} />
          </Field>
          <Field label="Foco da imagem (mobile)">
            <Select value={mobileBg?.imageFocus ?? 'center'}
              options={[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']]}
              onChange={v => updateMobileBg({ imageFocus: v as 'center' | 'top' | 'bottom' | 'left' | 'right' })} />
          </Field>
        </>
      )}

      <Field label="Espaçamento topo no mobile (px — opcional)">
        <NumberInput value={ov.spacing?.paddingTop ?? section.spacing.paddingTop}
          onChange={v => updateOverride({ spacing: { ...(ov.spacing ?? {}), paddingTop: v } })}
          min={0} max={400} />
      </Field>
      <Field label="Espaçamento inferior no mobile (px — opcional)">
        <NumberInput value={ov.spacing?.paddingBottom ?? section.spacing.paddingBottom}
          onChange={v => updateOverride({ spacing: { ...(ov.spacing ?? {}), paddingBottom: v } })}
          min={0} max={400} />
      </Field>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Background editor
// ─────────────────────────────────────────────────────────────────────────

function BackgroundEditor({ bg, onChange }: { bg: BackgroundStyle; onChange: (b: BackgroundStyle) => void }) {
  const setBg = (patch: Partial<BackgroundStyle>) => onChange({ ...bg, ...patch })
  return (
    <>
      <Field label="Tipo">
        <Select value={bg.kind}
          options={[['none','Nenhum'],['color','Cor sólida'],['image','Imagem'],['gradient','Gradiente']]}
          onChange={v => onChange({ kind: v as BackgroundStyle['kind'] })} />
      </Field>
      {bg.kind === 'color'    && <ColorField label="Cor" value={bg.color ?? '#ffffff'} onChange={v => setBg({ color: v })} />}
      {bg.kind === 'image'    && (
        <>
          <Field label="Imagem de fundo">
            <ImageUploadField value={bg.imageUrl ?? ''} onChange={v => setBg({ imageUrl: v })}
              previewMaxWidth={240} downscaleMaxWidth={1920} />
          </Field>
          <Field label="Foco da imagem">
            <Select value={bg.imageFocus ?? 'center'}
              options={[['center','Centro'],['top','Topo'],['bottom','Base'],['left','Esquerda'],['right','Direita']]}
              onChange={v => setBg({ imageFocus: v as 'center' | 'top' | 'bottom' | 'left' | 'right' })} />
          </Field>
          <ColorField label="Overlay (cor)" value={bg.overlayColor ?? '#000000'} onChange={v => setBg({ overlayColor: v })} />
          <Field label="Overlay (opacidade 0-1)">
            <NumberInput value={bg.overlayOpacity ?? 0} onChange={v => setBg({ overlayOpacity: v })} min={0} max={1} step={0.1} />
          </Field>
        </>
      )}
      {bg.kind === 'gradient' && (
        <>
          <ColorField label="De" value={bg.gradient?.from ?? '#000000'}
            onChange={v => setBg({ gradient: { from: v, to: bg.gradient?.to ?? '#ffffff', angle: bg.gradient?.angle } })} />
          <ColorField label="Para" value={bg.gradient?.to ?? '#ffffff'}
            onChange={v => setBg({ gradient: { from: bg.gradient?.from ?? '#000000', to: v, angle: bg.gradient?.angle } })} />
          <Field label="Ângulo (0-360)">
            <NumberInput value={bg.gradient?.angle ?? 180}
              onChange={v => setBg({ gradient: { from: bg.gradient?.from ?? '#000000', to: bg.gradient?.to ?? '#ffffff', angle: v } })}
              min={0} max={360} />
          </Field>
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Tipografia por seção — override de cor + fonte (herdam o tema quando vazio)
// ─────────────────────────────────────────────────────────────────────────

function TypographyEditor({ typo, onChange }: {
  typo?: SectionTypography
  onChange: (t: SectionTypography | undefined) => void
}) {
  const t = typo ?? {}
  // Mescla patch; se tudo ficar vazio, vira undefined (herda 100% do tema)
  const update = (patch: Partial<SectionTypography>) => {
    const next = { ...t, ...patch }
    // limpa chaves vazias
    const cleaned: SectionTypography = {}
    if (next.textColor)  cleaned.textColor  = next.textColor
    if (next.mutedColor) cleaned.mutedColor = next.mutedColor
    if (next.fontPair)   cleaned.fontPair   = next.fontPair
    onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined)
  }

  return (
    <>
      <p className="text-[11px] mb-1" style={{ color: '#52525b' }}>
        Vazio = herda do tema global. Use pra dar uma cor/fonte só nesta seção.
      </p>

      {/* Cor do texto */}
      <Field label="Cor do texto (títulos + corpo)">
        <div className="flex items-center gap-2">
          <Toggle value={!!t.textColor}
            onChange={v => update({ textColor: v ? (t.textColor || '#111111') : undefined })} />
          {t.textColor
            ? <div className="flex-1"><ColorField label="" value={t.textColor} onChange={v => update({ textColor: v })} /></div>
            : <span className="text-xs" style={{ color: '#71717a' }}>herda do tema</span>}
        </div>
      </Field>

      {/* Cor do texto secundário */}
      <Field label="Cor do texto secundário">
        <div className="flex items-center gap-2">
          <Toggle value={!!t.mutedColor}
            onChange={v => update({ mutedColor: v ? (t.mutedColor || '#666666') : undefined })} />
          {t.mutedColor
            ? <div className="flex-1"><ColorField label="" value={t.mutedColor} onChange={v => update({ mutedColor: v })} /></div>
            : <span className="text-xs" style={{ color: '#71717a' }}>herda do tema</span>}
        </div>
      </Field>

      {/* Fonte desta seção */}
      <Field label="Fonte desta seção">
        <SectionFontSelect value={t.fontPair} onChange={fp => update({ fontPair: fp })} />
      </Field>
    </>
  )
}

/** Select de fonte com opção "(herdar do tema)" + agrupamento por categoria. */
function SectionFontSelect({ value, onChange }: { value?: FontPair; onChange: (v: FontPair | undefined) => void }) {
  const byGroup = new Map<string, FontPair[]>()
  for (const k of FONT_PAIRS_V3) {
    const g = FONT_PAIRS_V3_DEFINITIONS[k].group
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(k)
  }
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? (e.target.value as FontPair) : undefined)}
      style={{
        width: '100%', padding: '10px 12px', minHeight: 44,
        background: '#0a0a0e', color: '#fafafa',
        border: '1px solid #27272a', borderRadius: 6, fontSize: 14,
      }}>
      <option value="">(herdar do tema)</option>
      {Array.from(byGroup.entries()).map(([group, keys]) => (
        <optgroup key={group} label={group} style={{ color: '#a1a1aa', background: '#0a0a0e' }}>
          {keys.map(k => (
            <option key={k} value={k}>{FONT_PAIRS_V3_DEFINITIONS[k].label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Settings editor — switch grande por section.type
// ─────────────────────────────────────────────────────────────────────────

function acceptsBlocks(type: SectionType): boolean {
  // Sections que tipicamente usam blocks: hero, slider, footer, header, banner
  return ['hero', 'slider', 'imageBanner', 'imageWithText', 'siteHeader', 'siteFooter', 'announcementBar', 'newsletter'].includes(type)
}

function SettingsEditor({ section, onChange, setSettings }: {
  section: Section
  onChange: (s: Section) => void
  setSettings: (patch: Partial<Section['settings']>) => void
}) {
  void onChange
  switch (section.type) {
    case 'siteHeader': {
      const s = section as SiteHeaderSection
      return (
        <>
          <Field label="Variante">
            <Select value={s.settings.variant}
              options={[['split','Logo à esquerda'],['centered','Logo centralizado'],['minimal','Minimalista']]}
              onChange={v => setSettings({ variant: v as 'centered' | 'split' | 'minimal' })} />
          </Field>
          <Field label="Sticky (fixo no topo)"><Toggle value={s.settings.sticky} onChange={v => setSettings({ sticky: v })} /></Field>
          <Field label="Mostrar busca"><Toggle value={s.settings.showSearch} onChange={v => setSettings({ showSearch: v })} /></Field>
          <Field label="Mostrar carrinho"><Toggle value={s.settings.showCart} onChange={v => setSettings({ showCart: v })} /></Field>
          <Field label="Mostrar conta"><Toggle value={s.settings.showAccount} onChange={v => setSettings({ showAccount: v })} /></Field>
          <Field label="Texto do logo (se não tiver imagem)">
            <Input value={s.settings.logoText ?? ''} onChange={v => setSettings({ logoText: v || undefined })} />
          </Field>
          <Field label="Imagem do logo">
            <ImageUploadField
              value={s.settings.logoUrl ?? ''}
              onChange={v => setSettings({ logoUrl: v || undefined })}
              placeholder="https://… (ou envie acima)"
              previewMaxWidth={180}
              downscaleMaxWidth={800}
              aiBannerEnabled={false}
            />
          </Field>
          <Field label="Tamanho da logo" hint="Altura em pixels (24-120).">
            <Slider value={s.settings.logoMaxHeight ?? 40}
              onChange={v => setSettings({ logoMaxHeight: v })}
              min={24} max={120} step={2} unit="px" />
          </Field>
        </>
      )
    }
    case 'siteFooter': {
      const s = section as SiteFooterSection
      return (
        <>
          <Field label="Variante">
            <Select value={s.settings.variant}
              options={[['minimal','Minimalista'],['columns','Com colunas']]}
              onChange={v => setSettings({ variant: v as 'minimal' | 'columns' })} />
          </Field>
          <Field label="Mostrar newsletter"><Toggle value={s.settings.showNewsletter} onChange={v => setSettings({ showNewsletter: v })} /></Field>
          <Field label="Mostrar redes sociais"><Toggle value={s.settings.showSocialIcons} onChange={v => setSettings({ showSocialIcons: v })} /></Field>
          <Field label="Mostrar meios de pagamento"><Toggle value={s.settings.showPaymentMethods} onChange={v => setSettings({ showPaymentMethods: v })} /></Field>
          <Field label="Copyright"><Input value={s.settings.copyright ?? ''} onChange={v => setSettings({ copyright: v || undefined })} /></Field>
        </>
      )
    }
    case 'announcementBar': {
      const s = section as AnnouncementBarSection
      return (
        <>
          <Field label="Mensagem"><Input value={s.settings.message} onChange={v => setSettings({ message: v })} /></Field>
          <Field label="Texto do CTA (opcional)"><Input value={s.settings.ctaLabel ?? ''} onChange={v => setSettings({ ctaLabel: v || undefined })} /></Field>
          <Field label="Link do CTA"><Input value={s.settings.ctaHref ?? ''} onChange={v => setSettings({ ctaHref: v || undefined })} /></Field>
          <Field label="Countdown até (ISO date, opcional)" hint="Ex.: 2026-12-31T23:59:59">
            <Input value={s.settings.countdownTo ?? ''} onChange={v => setSettings({ countdownTo: v || null })} />
          </Field>
          <Field label="Pode dispensar"><Toggle value={s.settings.dismissible} onChange={v => setSettings({ dismissible: v })} /></Field>
        </>
      )
    }
    case 'breadcrumb': {
      const s = section as BreadcrumbSection
      return (
        <>
          <Field label="Mostrar 'Início'"><Toggle value={s.settings.showHome} onChange={v => setSettings({ showHome: v })} /></Field>
          <Field label="Separador">
            <Select value={s.settings.separator}
              options={[['/','/'],['>','>'],['·','·']]}
              onChange={v => setSettings({ separator: v as '/' | '>' | '·' })} />
          </Field>
        </>
      )
    }
    case 'hero': {
      const s = section as HeroSection
      return (
        <>
          <Field label="Layout">
            <Select value={s.settings.layout}
              options={[['split','Dividido'],['centered','Centralizado'],['overlay','Sobreposto à imagem']]}
              onChange={v => setSettings({ layout: v as 'split' | 'centered' | 'overlay' })} />
          </Field>
          <Field label="Altura">
            <Select value={s.settings.height}
              options={[['auto','Automática'],['sm','Pequena'],['md','Média'],['lg','Grande'],['fullscreen','Tela cheia'],['custom','Personalizada (slider)']]}
              onChange={v => setSettings({ height: v as HeroSection['settings']['height'] })} />
          </Field>
          {s.settings.height === 'custom' && (
            <Field label="Altura personalizada (px)" hint="Arraste pra ajustar (80-1200px).">
              <Slider value={s.settings.customHeight ?? 380}
                onChange={v => setSettings({ customHeight: v })}
                min={80} max={1200} step={10} unit="px" />
            </Field>
          )}
          <Field label="Alinhamento do texto">
            <Select value={s.settings.textAlign}
              options={[['left','Esquerda'],['center','Centro'],['right','Direita']]}
              onChange={v => setSettings({ textAlign: v as 'left' | 'center' | 'right' })} />
          </Field>
        </>
      )
    }
    case 'slider': {
      const s = section as SliderSection
      return (
        <>
          <Field label="Reprodução automática"><Toggle value={s.settings.autoplay} onChange={v => setSettings({ autoplay: v })} /></Field>
          <Field label="Intervalo (segundos)">
            <NumberInput value={s.settings.interval} onChange={v => setSettings({ interval: v })} min={3} max={30} />
          </Field>
          <Field label="Mostrar bolinhas (dots)"><Toggle value={s.settings.showDots} onChange={v => setSettings({ showDots: v })} /></Field>
          <Field label="Mostrar setas"><Toggle value={s.settings.showArrows} onChange={v => setSettings({ showArrows: v })} /></Field>
          <Field label="Efeito">
            <Select value={s.settings.effect}
              options={[['fade','Fade'],['slide','Slide'],['coverflow','Coverflow']]}
              onChange={v => setSettings({ effect: v as 'fade' | 'slide' | 'coverflow' })} />
          </Field>
          <Field label="Altura">
            <Select value={s.settings.height}
              options={[['auto','Automática'],['sm','Pequena'],['md','Média'],['lg','Grande'],['fullscreen','Tela cheia'],['custom','Personalizada (slider)']]}
              onChange={v => setSettings({ height: v as SliderSection['settings']['height'] })} />
          </Field>
          {s.settings.height === 'custom' && (
            <Field label="Altura personalizada (px)" hint="Arraste pra ajustar (80-1200px).">
              <Slider value={s.settings.customHeight ?? 420}
                onChange={v => setSettings({ customHeight: v })}
                min={80} max={1200} step={10} unit="px" />
            </Field>
          )}
        </>
      )
    }
    case 'imageBanner': {
      const s = section as ImageBannerSection
      return (
        <>
          <Field label="Imagem do banner">
            <ImageUploadField value={s.settings.imageUrl} onChange={v => setSettings({ imageUrl: v })}
              previewMaxWidth={240} downscaleMaxWidth={1920} />
          </Field>
          <Field label="Título"><Input value={s.settings.headline ?? ''} onChange={v => setSettings({ headline: v || undefined })} /></Field>
          <Field label="Subtítulo"><Input value={s.settings.subheadline ?? ''} onChange={v => setSettings({ subheadline: v || undefined })} /></Field>
          <Field label="Texto do botão"><Input value={s.settings.ctaLabel ?? ''} onChange={v => setSettings({ ctaLabel: v || undefined })} /></Field>
          <Field label="Link do botão"><Input value={s.settings.ctaHref ?? ''} onChange={v => setSettings({ ctaHref: v || undefined })} /></Field>
          <Field label="Posição do texto">
            <Select value={s.settings.textPosition}
              options={[
                ['top-left','Topo esquerda'],['top-center','Topo centro'],['top-right','Topo direita'],
                ['center','Centro'],
                ['bottom-left','Base esquerda'],['bottom-center','Base centro'],['bottom-right','Base direita'],
              ]}
              onChange={v => setSettings({ textPosition: v as ImageBannerSection['settings']['textPosition'] })} />
          </Field>
          <Field label="Altura">
            <Select value={s.settings.height}
              options={[['sm','Pequena'],['md','Média'],['lg','Grande'],['fullscreen','Tela cheia'],['custom','Personalizada (slider)']]}
              onChange={v => setSettings({ height: v as ImageBannerSection['settings']['height'] })} />
          </Field>
          {s.settings.height === 'custom' && (
            <Field label="Altura personalizada (px)" hint="Arraste pra ajustar (80-1200px).">
              <Slider value={s.settings.customHeight ?? 400}
                onChange={v => setSettings({ customHeight: v })}
                min={80} max={1200} step={10} unit="px" />
            </Field>
          )}
          <ColorField label="Overlay (cor sobre a imagem)" value={s.settings.overlayColor ?? '#000000'}
            onChange={v => setSettings({ overlayColor: v })} />
          <Field label="Transparência do overlay (0-1)" hint="0 = sem overlay (imagem pura). 0.4 escurece um pouco pra dar contraste ao texto.">
            <NumberInput value={s.settings.overlayOpacity ?? 0}
              onChange={v => setSettings({ overlayOpacity: v })} min={0} max={1} step={0.1} />
          </Field>
        </>
      )
    }
    case 'imageHotspot': {
      const s = section as ImageHotspotSection
      return (
        <>
          <Field label="Título (opcional)"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Imagem (com pontos clicáveis)">
            <ImageUploadField value={s.settings.imageUrl} onChange={v => setSettings({ imageUrl: v })}
              previewMaxWidth={240} downscaleMaxWidth={1920} />
          </Field>
          <Field label="Hotspots" hint="Edite hotspots individualmente via JSON ou no modo dev (B.5b — pendente).">
            <Textarea value={JSON.stringify(s.settings.hotspots, null, 2)}
              onChange={v => { try { setSettings({ hotspots: JSON.parse(v) }) } catch { /* invalid JSON */ } }}
              rows={8} />
          </Field>
        </>
      )
    }
    case 'imageWithText': {
      const s = section as ImageWithTextSection
      return (
        <>
          <Field label="Imagem">
            <ImageUploadField value={s.settings.imageUrl} onChange={v => setSettings({ imageUrl: v })}
              previewMaxWidth={240} downscaleMaxWidth={1600} />
          </Field>
          <Field label="Lado da imagem">
            <Select value={s.settings.imageSide}
              options={[['left','Esquerda'],['right','Direita']]}
              onChange={v => setSettings({ imageSide: v as 'left' | 'right' })} />
          </Field>
          <Field label="Título"><Input value={s.settings.title} onChange={v => setSettings({ title: v })} /></Field>
          <Field label="Texto"><Textarea value={s.settings.body} onChange={v => setSettings({ body: v })} /></Field>
          <Field label="Texto do CTA"><Input value={s.settings.ctaLabel ?? ''} onChange={v => setSettings({ ctaLabel: v || undefined })} /></Field>
          <Field label="Link do CTA"><Input value={s.settings.ctaHref ?? ''} onChange={v => setSettings({ ctaHref: v || undefined })} /></Field>
        </>
      )
    }
    case 'marquee': {
      const s = section as MarqueeSection
      return (
        <>
          <Field label="Itens (1 por linha)">
            <Textarea value={s.settings.items.join('\n')} onChange={v => setSettings({ items: v.split('\n').map(x => x.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Velocidade">
            <Select value={s.settings.speed}
              options={[['slow','Lenta'],['normal','Normal'],['fast','Rápida']]}
              onChange={v => setSettings({ speed: v as 'slow' | 'normal' | 'fast' })} />
          </Field>
          <Field label="Direção">
            <Select value={s.settings.direction}
              options={[['left','Esquerda'],['right','Direita']]}
              onChange={v => setSettings({ direction: v as 'left' | 'right' })} />
          </Field>
        </>
      )
    }
    case 'productGrid':
    case 'productCarousel': {
      const s = section as ProductGridSection | ProductCarouselSection
      const isGrid = section.type === 'productGrid'
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Origem">
            <Select value={s.settings.source.kind}
              options={[
                ['storefront','Vitrine completa'],
                ['bestsellers','Mais vendidos'],
                ['newest','Novidades'],
                ['promo','Em promoção'],
              ]}
              onChange={v => setSettings({ source: { kind: v as 'storefront' | 'bestsellers' | 'newest' | 'promo' } as ProductSource })} />
          </Field>
          <Field label="Limite">
            <NumberInput value={s.settings.limit} onChange={v => setSettings({ limit: v })} min={1} max={60} />
          </Field>
          <Field label="Estilo do card">
            <Select value={s.settings.cardStyle}
              options={[['minimal','Minimalista'],['compact','Compacto'],['detailed','Detalhado']]}
              onChange={v => setSettings({ cardStyle: v as 'compact' | 'detailed' | 'minimal' })} />
          </Field>
          {isGrid && (
            <>
              <Field label="Mostrar filtros (somente grade)"><Toggle value={(s as ProductGridSection).settings.showFilters} onChange={v => setSettings({ showFilters: v })} /></Field>
              <Field label="Mostrar ordenação"><Toggle value={(s as ProductGridSection).settings.showSort} onChange={v => setSettings({ showSort: v })} /></Field>
            </>
          )}
          {!isGrid && (
            <Field label="Autoplay"><Toggle value={(s as ProductCarouselSection).settings.autoplay} onChange={v => setSettings({ autoplay: v })} /></Field>
          )}
        </>
      )
    }
    case 'featuredProduct': {
      const s = section as FeaturedProductSection
      return (
        <>
          <Field label="ID do produto"><Input value={s.settings.productId} onChange={v => setSettings({ productId: v })} /></Field>
          <Field label="Posição da galeria">
            <Select value={s.settings.galleryPosition}
              options={[['left','Esquerda'],['right','Direita'],['top','Topo']]}
              onChange={v => setSettings({ galleryPosition: v as 'left' | 'right' | 'top' })} />
          </Field>
          <Field label="Mostrar descrição"><Toggle value={s.settings.showDescription} onChange={v => setSettings({ showDescription: v })} /></Field>
          <Field label="Mostrar atributos"><Toggle value={s.settings.showAttributes} onChange={v => setSettings({ showAttributes: v })} /></Field>
          <Field label="Texto do CTA"><Input value={s.settings.ctaLabel ?? ''} onChange={v => setSettings({ ctaLabel: v || undefined })} /></Field>
        </>
      )
    }
    case 'collectionGrid': {
      const s = section as CollectionGridSection
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Categorias / coleções"
            hint="Cada card vira um atalho na vitrine. Imagem por upload, URL ou geração com IA usando o nome da categoria.">
            <CollectionsEditor
              value={s.settings.collections}
              onChange={next => setSettings({ collections: next })} />
          </Field>
        </>
      )
    }
    case 'leadForm': {
      const s = section as LeadFormSection
      return (
        <LeadFormEditor
          settings={s.settings}
          onChange={patch => setSettings(patch)} />
      )
    }
    case 'productDetailLayout': {
      const s = section as ProductDetailLayoutSection
      return (
        <>
          <Field label="Posição da galeria">
            <Select value={s.settings.galleryPosition}
              options={[['left','Esquerda'],['right','Direita'],['top','Topo']]}
              onChange={v => setSettings({ galleryPosition: v as 'left' | 'right' | 'top' })} />
          </Field>
          <Field label="Estilo da galeria">
            <Select value={s.settings.galleryStyle}
              options={[['carousel','Carrossel'],['stack','Empilhada'],['grid','Grade']]}
              onChange={v => setSettings({ galleryStyle: v as 'carousel' | 'stack' | 'grid' })} />
          </Field>
          <Field label="CTA sticky no mobile"><Toggle value={s.settings.stickyAddToCart} onChange={v => setSettings({ stickyAddToCart: v })} /></Field>
          <Field label="Botões de compartilhar"><Toggle value={s.settings.showShareButtons} onChange={v => setSettings({ showShareButtons: v })} /></Field>
          <Field label="Mostrar produtos relacionados"><Toggle value={s.settings.showRelatedProducts} onChange={v => setSettings({ showRelatedProducts: v })} /></Field>
          <Field label="Quantidade de relacionados">
            <NumberInput value={s.settings.relatedProductsCount} onChange={v => setSettings({ relatedProductsCount: v })} min={0} max={20} />
          </Field>
          <Field label="Mostrar avaliações"><Toggle value={s.settings.showReviews} onChange={v => setSettings({ showReviews: v })} /></Field>
        </>
      )
    }
    case 'richText': {
      const s = section as RichTextSection
      return (
        <>
          <Field label="Conteúdo (markdown leve)"><Textarea value={s.settings.content} onChange={v => setSettings({ content: v })} rows={8} /></Field>
          <Field label="Largura máxima">
            <Select value={s.settings.maxWidth}
              options={[['sm','Pequena'],['md','Média'],['lg','Grande'],['full','Total']]}
              onChange={v => setSettings({ maxWidth: v as 'sm' | 'md' | 'lg' | 'full' })} />
          </Field>
          <Field label="Alinhamento">
            <Select value={s.settings.align}
              options={[['left','Esquerda'],['center','Centro'],['right','Direita']]}
              onChange={v => setSettings({ align: v as 'left' | 'center' | 'right' })} />
          </Field>
        </>
      )
    }
    case 'testimonials': {
      const s = section as TestimonialsSection
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Layout">
            <Select value={s.settings.layout}
              options={[['grid','Grade'],['carousel','Carrossel']]}
              onChange={v => setSettings({ layout: v as 'grid' | 'carousel' })} />
          </Field>
          <Field label="Depoimentos (JSON)" hint='[{"id":"1","name":"Ana","text":"...","rating":5}]'>
            <Textarea value={JSON.stringify(s.settings.items, null, 2)}
              onChange={v => { try { setSettings({ items: JSON.parse(v) }) } catch { /* invalid */ } }}
              rows={10} />
          </Field>
        </>
      )
    }
    case 'logoList': {
      const s = section as LogoListSection
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Escala de cinza"><Toggle value={s.settings.grayscale} onChange={v => setSettings({ grayscale: v })} /></Field>
          <Field label="Logos (JSON)" hint='[{"id":"1","imageUrl":"https://...","alt":"Marca","href":""}]'>
            <Textarea value={JSON.stringify(s.settings.logos, null, 2)}
              onChange={v => { try { setSettings({ logos: JSON.parse(v) }) } catch { /* invalid */ } }}
              rows={8} />
          </Field>
        </>
      )
    }
    case 'faq': {
      const s = section as FaqSection
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Perguntas (JSON)" hint='[{"id":"1","question":"...","answer":"..."}]'>
            <Textarea value={JSON.stringify(s.settings.items, null, 2)}
              onChange={v => { try { setSettings({ items: JSON.parse(v) }) } catch { /* invalid */ } }}
              rows={10} />
          </Field>
        </>
      )
    }
    case 'newsletter': {
      const s = section as NewsletterSection
      return (
        <>
          <Field label="Título"><Input value={s.settings.title ?? ''} onChange={v => setSettings({ title: v || undefined })} /></Field>
          <Field label="Descrição"><Textarea value={s.settings.description ?? ''} onChange={v => setSettings({ description: v || undefined })} rows={2} /></Field>
          <Field label="Texto do botão"><Input value={s.settings.ctaLabel} onChange={v => setSettings({ ctaLabel: v })} /></Field>
          <Field label="Placeholder do email"><Input value={s.settings.placeholder} onChange={v => setSettings({ placeholder: v })} /></Field>
          <Field label="Mensagem de sucesso"><Input value={s.settings.successMessage} onChange={v => setSettings({ successMessage: v })} /></Field>
        </>
      )
    }
    case 'videoBlock': {
      const s = section as VideoBlockSection
      return (
        <>
          <Field label="URL do vídeo"><Input value={s.settings.url} onChange={v => setSettings({ url: v })} placeholder="https://youtube.com/..." /></Field>
          <Field label="Autoplay"><Toggle value={s.settings.autoplay} onChange={v => setSettings({ autoplay: v })} /></Field>
          <Field label="Loop"><Toggle value={s.settings.loop} onChange={v => setSettings({ loop: v })} /></Field>
          <Field label="Sem áudio"><Toggle value={s.settings.muted} onChange={v => setSettings({ muted: v })} /></Field>
          <Field label="Poster (URL da capa)"><Input value={s.settings.poster ?? ''} onChange={v => setSettings({ poster: v || undefined })} /></Field>
          <Field label="Proporção">
            <Select value={s.settings.aspectRatio}
              options={[['16:9','16:9 (wide)'],['4:3','4:3'],['1:1','Quadrado'],['9:16','9:16 (vertical)']]}
              onChange={v => setSettings({ aspectRatio: v as '16:9' | '4:3' | '1:1' | '9:16' })} />
          </Field>
        </>
      )
    }
    case 'customHtml': {
      const s = section as CustomHtmlSection
      return (
        <>
          <Field label="HTML" hint="Sanitizado via DOMPurify antes de renderizar.">
            <Textarea value={s.settings.html} onChange={v => setSettings({ html: v })} rows={10} />
          </Field>
          <Field label="CSS (escopo da seção)" hint="Prefixado automaticamente pra não vazar.">
            <Textarea value={s.settings.css ?? ''} onChange={v => setSettings({ css: v || undefined })} rows={6} />
          </Field>
        </>
      )
    }
    case 'cartLayout': {
      const s = section as CartLayoutSection
      return (
        <>
          <Field label="Mostrar campo de cupom"><Toggle value={s.settings.showCoupon} onChange={v => setSettings({ showCoupon: v })} /></Field>
          <Field label="Mostrar cálculo de frete"><Toggle value={s.settings.showShipping} onChange={v => setSettings({ showShipping: v })} /></Field>
          <Field label="Mostrar campo de observações"><Toggle value={s.settings.showNotes} onChange={v => setSettings({ showNotes: v })} /></Field>
        </>
      )
    }
    case 'checkoutLayout': {
      const s = section as CheckoutLayoutSection
      return (
        <>
          <Field label="Etapas">
            <Select value={s.settings.steps}
              options={[['multi','Múltiplas (desktop)'],['single','Única (mobile)']]}
              onChange={v => setSettings({ steps: v as 'multi' | 'single' })} />
          </Field>
          <Field label="Exigir conta"><Toggle value={s.settings.requireAccount} onChange={v => setSettings({ requireAccount: v })} /></Field>
          <Field label="Pedir CPF"><Toggle value={s.settings.askForCpf} onChange={v => setSettings({ askForCpf: v })} /></Field>
          <Field label="Pedir CNPJ"><Toggle value={s.settings.askForCnpj} onChange={v => setSettings({ askForCnpj: v })} /></Field>
        </>
      )
    }
    case 'whatsappCatalog': {
      const s = section as WhatsappCatalogSection
      return (
        <>
          <Field label="Ativado"><Toggle value={s.settings.enabled} onChange={v => setSettings({ enabled: v })} /></Field>
          <Field label="Posição">
            <Select value={s.settings.position}
              options={[['header','No cabeçalho'],['footer','No rodapé'],['floating','Botão flutuante']]}
              onChange={v => setSettings({ position: v as 'header' | 'footer' | 'floating' })} />
          </Field>
          <Field label="Rótulo do botão"><Input value={s.settings.label} onChange={v => setSettings({ label: v })} /></Field>
        </>
      )
    }
  }
}
