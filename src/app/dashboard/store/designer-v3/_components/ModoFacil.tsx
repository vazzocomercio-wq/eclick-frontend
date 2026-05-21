'use client'

/**
 * Modo Fácil — Designer v3 (C.3).
 *
 * Formulario guiado em accordions. Edita os pontos mais frequentes sem
 * exigir conhecimento de "sections" ou "blocks":
 *  - Marca: logo, nome, slogan, cores principais
 *  - Tipografia: par de fontes, raio, densidade
 *  - Cabecalho: variant, nav (ate 6 itens)
 *  - Banner principal (1o slide ou primeiro hero/banner da home)
 *  - Vitrine principal (1o productGrid/productCarousel da home)
 *  - Cole es (1o collectionGrid da home)
 *  - Rodape: copyright, newsletter, redes sociais
 *
 * Auto-save com debounce 1.5s (indicador "Salvo / Salvando…").
 * Mobile-first: campos full-width, touch >=44px.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react'
import { ImageUploadField } from '@/components/storefront/ImageUploadField'
import { Slider } from './primitives'
import type {
  StorefrontDesignV3, ThemeV3, FontPair, Radius, Density,
  SiteHeaderSection, SiteFooterSection, Section,
  HeroSection, SliderSection, ImageBannerSection,
  ProductGridSection, ProductCarouselSection, CollectionGridSection,
  AnnouncementBarSection,
} from '@/lib/storefront/v3/types'

// FontPair labels e grupos vem do dicionario central — 30 pares.
import { FONT_PAIRS_V3_DEFINITIONS, FONT_PAIRS_V3 } from '@/lib/storefront/v3/font-pairs'
const RADIUS_LABELS:  Record<Radius,  string> = { none: 'Reto', sm: 'Pouco', md: 'Médio', lg: 'Bastante', full: 'Pílula' }
const DENSITY_LABELS: Record<Density, string> = { compact: 'Compacto', cozy: 'Aconchegante', spacious: 'Espaçoso' }

interface Props {
  design:         StorefrontDesignV3
  onSave:         (next: StorefrontDesignV3) => Promise<void>
  /** Chamado IMEDIATO a cada mudanca (sem debounce) — usado pra postMessage
   *  no iframe do preview. Sem efeito se omitido. */
  onLiveChange?:  (next: StorefrontDesignV3) => void
}

export function ModoFacil({ design, onSave, onLiveChange }: Props) {
  const [local, setLocal] = useState<StorefrontDesignV3>(design)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sincroniza se o pai recarregar design (ex: depois de "Aplicar template").
  useEffect(() => { setLocal(design) }, [design])

  // Debounced auto-save.
  const update = useCallback((mut: (d: StorefrontDesignV3) => StorefrontDesignV3) => {
    setLocal(prev => {
      const next = mut(prev)
      onLiveChange?.(next)
      if (timer.current) clearTimeout(timer.current)
      setStatus('saving')
      timer.current = setTimeout(async () => {
        await onSave(next)
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 1500)
      }, 1500)
      return next
    })
  }, [onSave, onLiveChange])

  // Helpers — localizar primeira section de um type na home.
  const home = local.pages.home
  const announcementIdx = home.sections.findIndex(s => s.type === 'announcementBar')
  const bannerIdx       = home.sections.findIndex(s => s.type === 'hero' || s.type === 'slider' || s.type === 'imageBanner')
  const vitrineIdx      = home.sections.findIndex(s => s.type === 'productGrid' || s.type === 'productCarousel')
  const colecoesIdx     = home.sections.findIndex(s => s.type === 'collectionGrid')

  const replaceHomeSection = (idx: number, next: Section) =>
    update(d => ({
      ...d,
      pages: {
        ...d.pages,
        home: { ...d.pages.home, sections: d.pages.home.sections.map((s, i) => i === idx ? next : s) },
      },
    }))

  const updateTheme = (mut: (t: ThemeV3) => ThemeV3) =>
    update(d => ({ ...d, theme: mut(d.theme) }))

  const updateHeader = (mut: (h: SiteHeaderSection) => SiteHeaderSection) =>
    update(d => ({ ...d, globals: { ...d.globals, header: mut(d.globals.header) } }))

  const updateFooter = (mut: (f: SiteFooterSection) => SiteFooterSection) =>
    update(d => ({ ...d, globals: { ...d.globals, footer: mut(d.globals.footer) } }))

  return (
    <div>
      {/* Status indicator */}
      <div className="flex items-center justify-end mb-3 text-xs" style={{ color: '#a1a1aa', minHeight: 20 }}>
        {status === 'saving' && <><Loader2 size={12} className="animate-spin mr-1" /> Salvando…</>}
        {status === 'saved'  && <><Check    size={12} className="mr-1" style={{ color: '#22c55e' }} /> Salvo</>}
      </div>

      {/* ─── Marca ─── */}
      <Acc title="Marca" defaultOpen>
        <Field label="Texto do logo (se não tiver imagem)">
          <Input
            value={local.globals.header.settings.logoText ?? ''}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, logoText: v } }))}
            placeholder="Minha Loja"
          />
        </Field>
        <Field label="Imagem do logo">
          <ImageUploadField
            value={local.globals.header.settings.logoUrl ?? ''}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, logoUrl: v || undefined } }))}
            placeholder="https://… (ou envie acima)"
            previewMaxWidth={180}
            downscaleMaxWidth={800}
            aiBannerEnabled={false}
          />
        </Field>
        <Field label="Tamanho da logo" hint="Altura máxima em pixels. Padrão 40.">
          <Slider
            value={local.globals.header.settings.logoMaxHeight ?? 40}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, logoMaxHeight: v } }))}
            min={24} max={120} step={2} unit="px"
          />
        </Field>
      </Acc>

      {/* ─── Cores ─── */}
      <Acc title="Cores">
        <ColorField label="Cor principal (botões, preços, links)"
          value={local.theme.colors.primary}
          onChange={v => updateTheme(t => ({ ...t, colors: { ...t.colors, primary: v } }))} />
        <ColorField label="Fundo da página"
          value={local.theme.colors.background}
          onChange={v => updateTheme(t => ({ ...t, colors: { ...t.colors, background: v } }))} />
        <ColorField label="Texto"
          value={local.theme.colors.text}
          onChange={v => updateTheme(t => ({ ...t, colors: { ...t.colors, text: v } }))} />
        <ColorField label="Texto secundário"
          value={local.theme.colors.textMuted}
          onChange={v => updateTheme(t => ({ ...t, colors: { ...t.colors, textMuted: v } }))} />
        <ColorField label="Bordas"
          value={local.theme.colors.border}
          onChange={v => updateTheme(t => ({ ...t, colors: { ...t.colors, border: v } }))} />
      </Acc>

      {/* ─── Tipografia & visual ─── */}
      <Acc title="Tipografia e visual">
        <Field label="Par de fontes" hint={`${FONT_PAIRS_V3.length} estilos disponíveis, agrupados por categoria.`}>
          <FontPairSelect
            value={local.theme.fontPair}
            onChange={v => updateTheme(t => ({ ...t, fontPair: v }))}
          />
        </Field>
        <Field label="Cantos arredondados">
          <Select
            value={local.theme.radius}
            options={Object.entries(RADIUS_LABELS) as Array<[Radius, string]>}
            onChange={v => updateTheme(t => ({ ...t, radius: v }))}
          />
        </Field>
        <Field label="Densidade de espaçamento">
          <Select
            value={local.theme.density}
            options={Object.entries(DENSITY_LABELS) as Array<[Density, string]>}
            onChange={v => updateTheme(t => ({ ...t, density: v }))}
          />
        </Field>
      </Acc>

      {/* ─── Cabeçalho ─── */}
      <Acc title="Cabeçalho">
        <Field label="Variante">
          <Select
            value={local.globals.header.settings.variant}
            options={[['split', 'Logo à esquerda'], ['centered', 'Logo centralizado'], ['minimal', 'Minimalista']] as Array<[SiteHeaderSection['settings']['variant'], string]>}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, variant: v } }))}
          />
        </Field>
        <Field label="Mostrar busca">
          <Toggle
            value={local.globals.header.settings.showSearch}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, showSearch: v } }))} />
        </Field>
        <Field label="Mostrar carrinho">
          <Toggle
            value={local.globals.header.settings.showCart}
            onChange={v => updateHeader(h => ({ ...h, settings: { ...h.settings, showCart: v } }))} />
        </Field>
        <Field label="Menu (até 6 itens)">
          <NavEditor
            nav={local.globals.header.settings.nav}
            onChange={nav => updateHeader(h => ({ ...h, settings: { ...h.settings, nav } }))}
          />
        </Field>
      </Acc>

      {/* ─── Faixa de anúncio ─── */}
      {announcementIdx >= 0 && (
        <Acc title="Faixa de anúncio (topo)">
          <Field label="Mensagem">
            <Input
              value={(home.sections[announcementIdx] as AnnouncementBarSection).settings.message}
              onChange={v => replaceHomeSection(announcementIdx, {
                ...home.sections[announcementIdx],
                settings: { ...(home.sections[announcementIdx] as AnnouncementBarSection).settings, message: v },
              } as AnnouncementBarSection)}
            />
          </Field>
        </Acc>
      )}

      {/* ─── Banner principal ─── */}
      {bannerIdx >= 0 && (
        <Acc title="Banner principal">
          <BannerEditor
            section={home.sections[bannerIdx]}
            onChange={next => replaceHomeSection(bannerIdx, next)}
          />
        </Acc>
      )}

      {/* ─── Vitrine ─── */}
      {vitrineIdx >= 0 && (
        <Acc title="Vitrine de produtos">
          <VitrineEditor
            section={home.sections[vitrineIdx] as ProductGridSection | ProductCarouselSection}
            onChange={next => replaceHomeSection(vitrineIdx, next)}
          />
        </Acc>
      )}

      {/* ─── Coleções ─── */}
      {colecoesIdx >= 0 && (
        <Acc title="Categorias / coleções">
          <ColecoesEditor
            section={home.sections[colecoesIdx] as CollectionGridSection}
            onChange={next => replaceHomeSection(colecoesIdx, next)}
          />
        </Acc>
      )}

      {/* ─── Rodapé ─── */}
      <Acc title="Rodapé">
        <Field label="Texto de copyright">
          <Input
            value={local.globals.footer.settings.copyright ?? ''}
            onChange={v => updateFooter(f => ({ ...f, settings: { ...f.settings, copyright: v } }))}
            placeholder="© 2026 — Todos os direitos reservados"
          />
        </Field>
        <Field label="Mostrar newsletter">
          <Toggle
            value={local.globals.footer.settings.showNewsletter}
            onChange={v => updateFooter(f => ({ ...f, settings: { ...f.settings, showNewsletter: v } }))} />
        </Field>
        <Field label="Mostrar redes sociais">
          <Toggle
            value={local.globals.footer.settings.showSocialIcons}
            onChange={v => updateFooter(f => ({ ...f, settings: { ...f.settings, showSocialIcons: v } }))} />
        </Field>
      </Acc>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-editores
// ─────────────────────────────────────────────────────────────────────────

function BannerEditor({ section, onChange }: { section: Section; onChange: (n: Section) => void }) {
  if (section.type === 'hero') {
    const headingBlock = section.blocks.find(b => b.type === 'heading')
    const subheadingBlock = section.blocks.find(b => b.type === 'subheading')
    const buttonBlock = section.blocks.find(b => b.type === 'button')
    return (
      <>
        {headingBlock && (
          <Field label="Título">
            <Input
              value={(headingBlock.settings as { text: string }).text}
              onChange={v => onChange({ ...section, blocks: section.blocks.map(b =>
                b.id === headingBlock.id ? ({ ...b, settings: { ...b.settings, text: v } } as typeof b) : b
              )})}
            />
          </Field>
        )}
        {subheadingBlock && (
          <Field label="Subtítulo">
            <Input
              value={(subheadingBlock.settings as { text: string }).text}
              onChange={v => onChange({ ...section, blocks: section.blocks.map(b =>
                b.id === subheadingBlock.id ? ({ ...b, settings: { ...b.settings, text: v } } as typeof b) : b
              )})}
            />
          </Field>
        )}
        {buttonBlock && (
          <Field label="Texto do botão">
            <Input
              value={(buttonBlock.settings as { label: string }).label}
              onChange={v => onChange({ ...section, blocks: section.blocks.map(b =>
                b.id === buttonBlock.id ? ({ ...b, settings: { ...b.settings, label: v } } as typeof b) : b
              )})}
            />
          </Field>
        )}
        <Field label="Altura">
          <Select
            value={(section as HeroSection).settings.height}
            options={[['sm','Pequeno'],['md','Médio'],['lg','Grande'],['fullscreen','Tela cheia']] as Array<[HeroSection['settings']['height'], string]>}
            onChange={v => onChange({ ...section, settings: { ...(section as HeroSection).settings, height: v } } as HeroSection)}
          />
        </Field>
      </>
    )
  }
  if (section.type === 'slider') {
    const s = section as SliderSection
    return (
      <>
        <Field label="Slides (editar individualmente no Modo Avançado)">
          <div style={{ color: '#a1a1aa', fontSize: 13 }}>{section.blocks.length} slide(s)</div>
        </Field>
        <Field label="Reprodução automática">
          <Toggle value={s.settings.autoplay}
            onChange={v => onChange({ ...section, settings: { ...s.settings, autoplay: v } } as SliderSection)} />
        </Field>
        <Field label="Tempo entre slides (segundos)">
          <Input type="number"
            value={String(s.settings.interval)}
            onChange={v => onChange({ ...section, settings: { ...s.settings, interval: Math.max(3, parseInt(v) || 5) } } as SliderSection)}
          />
        </Field>
      </>
    )
  }
  if (section.type === 'imageBanner') {
    const s = section as ImageBannerSection
    return (
      <>
        <Field label="URL da imagem">
          <Input value={s.settings.imageUrl}
            onChange={v => onChange({ ...section, settings: { ...s.settings, imageUrl: v } } as ImageBannerSection)} />
        </Field>
        <Field label="Título">
          <Input value={s.settings.headline ?? ''}
            onChange={v => onChange({ ...section, settings: { ...s.settings, headline: v } } as ImageBannerSection)} />
        </Field>
        <Field label="Texto do botão">
          <Input value={s.settings.ctaLabel ?? ''}
            onChange={v => onChange({ ...section, settings: { ...s.settings, ctaLabel: v } } as ImageBannerSection)} />
        </Field>
      </>
    )
  }
  return null
}

function VitrineEditor({ section, onChange }: { section: ProductGridSection | ProductCarouselSection; onChange: (n: Section) => void }) {
  return (
    <>
      <Field label="Título da vitrine">
        <Input value={section.settings.title ?? ''}
          onChange={v => onChange({ ...section, settings: { ...section.settings, title: v || undefined } } as Section)} />
      </Field>
      <Field label="Origem dos produtos">
        <Select
          value={section.settings.source.kind}
          options={[
            ['storefront',  'Todos da vitrine'],
            ['bestsellers', 'Mais vendidos'],
            ['newest',      'Novidades'],
            ['promo',       'Em promoção'],
          ] as Array<[ProductGridSection['settings']['source']['kind'], string]>}
          onChange={v => onChange({ ...section, settings: { ...section.settings, source: { kind: v } as ProductGridSection['settings']['source'] } } as Section)}
        />
      </Field>
      <Field label="Quantidade máxima">
        <Input type="number" value={String(section.settings.limit)}
          onChange={v => onChange({ ...section, settings: { ...section.settings, limit: Math.max(1, parseInt(v) || 12) } } as Section)} />
      </Field>
    </>
  )
}

function ColecoesEditor({ section, onChange }: { section: CollectionGridSection; onChange: (n: Section) => void }) {
  const update = (i: number, mut: (item: CollectionGridSection['settings']['collections'][number]) => CollectionGridSection['settings']['collections'][number]) =>
    onChange({
      ...section,
      settings: {
        ...section.settings,
        collections: section.settings.collections.map((c, j) => j === i ? mut(c) : c),
      },
    } as CollectionGridSection)
  return (
    <>
      <Field label="Título da seção">
        <Input value={section.settings.title ?? ''}
          onChange={v => onChange({ ...section, settings: { ...section.settings, title: v || undefined } } as CollectionGridSection)} />
      </Field>
      {section.settings.collections.map((c, i) => (
        <div key={i} className="border rounded p-2 mb-2" style={{ borderColor: '#27272a' }}>
          <Field label={`Coleção ${i + 1} — nome`}>
            <Input value={c.label ?? ''} onChange={v => update(i, x => ({ ...x, label: v }))} />
          </Field>
          <Field label="URL da imagem">
            <Input value={c.imageUrl ?? ''} onChange={v => update(i, x => ({ ...x, imageUrl: v }))} />
          </Field>
        </div>
      ))}
    </>
  )
}

function NavEditor({ nav, onChange }: { nav: SiteHeaderSection['settings']['nav']; onChange: (next: SiteHeaderSection['settings']['nav']) => void }) {
  const set = (i: number, key: 'label' | 'href', value: string) =>
    onChange(nav.map((n, j) => j === i ? { ...n, [key]: value } : n))
  const remove = (i: number) => onChange(nav.filter((_, j) => j !== i))
  const add = () => nav.length < 6 && onChange([...nav, { label: 'Novo item', href: '#' }])
  return (
    <div>
      {nav.map((n, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input value={n.label} onChange={e => set(i, 'label', e.target.value)}
            placeholder="Rótulo" className="flex-1"
            style={inputStyle} />
          <input value={n.href}  onChange={e => set(i, 'href',  e.target.value)}
            placeholder="/destino" className="flex-1"
            style={inputStyle} />
          <button onClick={() => remove(i)}
            style={{
              padding: '0 12px', minHeight: 44, minWidth: 44,
              background: 'transparent', color: '#f87171',
              border: '1px solid #27272a', borderRadius: 6, cursor: 'pointer',
            }}>×</button>
        </div>
      ))}
      {nav.length < 6 && (
        <button onClick={add}
          style={{
            width: '100%', padding: 10, minHeight: 44,
            background: 'transparent', color: '#00E5FF',
            border: '1px dashed #27272a', borderRadius: 6, cursor: 'pointer',
            fontSize: 13,
          }}>+ Adicionar item</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Componentes base
// ─────────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px', minHeight: 44,
  background: '#0a0a0e', color: '#fafafa',
  border: '1px solid #27272a', borderRadius: 6,
  fontSize: 14,
}

function Acc({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid #27272a' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-medium"
        style={{ color: '#fafafa', minHeight: 44, background: 'transparent', border: 'none', cursor: 'pointer' }}>
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pb-4 space-y-3">{children}</div>}
    </div>
  )
}

// Select agrupado por categoria com 30 fontes. <optgroup> nativo do HTML
// pra simplificar (browsers renderizam decentemente em desktop/mobile).
function FontPairSelect({ value, onChange }: { value: FontPair; onChange: (v: FontPair) => void }) {
  // Agrupa por group
  const byGroup = new Map<string, FontPair[]>()
  for (const k of FONT_PAIRS_V3) {
    const g = FONT_PAIRS_V3_DEFINITIONS[k].group
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g)!.push(k)
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as FontPair)}
      style={{
        width: '100%', padding: '10px 12px', minHeight: 44,
        background: '#0a0a0e', color: '#fafafa',
        border: '1px solid #27272a', borderRadius: 6,
        fontSize: 14,
      }}>
      {Array.from(byGroup.entries()).map(([group, items]) => (
        <optgroup key={group} label={group} style={{ color: '#a1a1aa', background: '#0a0a0e' }}>
          {items.map(k => (
            <option key={k} value={k} style={{ color: '#fafafa', background: '#0a0a0e' }}>
              {FONT_PAIRS_V3_DEFINITIONS[k].label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>{label}</label>
      {children}
      {hint && <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>{hint}</div>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type ?? 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 44, height: 44, padding: 0, border: '1px solid #27272a', borderRadius: 6, background: '#0a0a0e', cursor: 'pointer' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          style={inputStyle} placeholder="#000000" />
      </div>
    </Field>
  )
}

function Select<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)} style={inputStyle}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch" aria-checked={value} tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!value) } }}
      style={{
        boxSizing: 'border-box',
        display: 'inline-block',
        position: 'relative',
        width: '44px', height: '24px',
        background: value ? '#00E5FF' : '#27272a',
        borderRadius: '12px',
        cursor: 'pointer',
        verticalAlign: 'middle',
        transition: 'background 150ms',
        userSelect: 'none',
        flexShrink: 0,
      }}>
      <span aria-hidden style={{
        boxSizing: 'border-box',
        position: 'absolute',
        left: value ? '22px' : '2px',
        top: '2px',
        width: '20px', height: '20px',
        background: '#fafafa', borderRadius: '50%',
        transition: 'left 150ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        display: 'block', pointerEvents: 'none',
      }} />
    </div>
  )
}
