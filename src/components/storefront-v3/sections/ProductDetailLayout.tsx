/**
 * ProductDetailLayout v3 — esqueleto da pagina de produto.
 *
 * Esta section so e usada na page `product`. O renderer assume que a rota
 * (`/loja/[slug]/produto/[id]`) pre-carregou o produto e o passou via
 * ctx.products[0] (single product context).
 *
 * Sticky add-to-cart (mobile-first) e tratado por um Client Component
 * separado (AddToCartSticky) que B.5 da rota vai montar — aqui o esqueleto
 * deixa um marcador.
 *
 * Galleria: por simplicidade, B.3b renderiza a primeira foto + miniaturas.
 * Galeria interativa com troca client-side fica pra refinement.
 */

import type { ProductDetailLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { PriceDisplay } from '../PriceDisplay'
import { ProductGalleryClient } from './ProductGalleryClient'
import { WishlistButton } from '../WishlistButton'
import { ReviewStars } from '@/components/storefront/ReviewStars'
import { WhatsAppIcon } from '@/components/storefront/WhatsAppIcon'
import { RoomVisualizerLauncher } from '../RoomVisualizerLauncher'
import { AddToCartClient } from './AddToCartClient'
import { ShareButtons } from './ShareButtons'

export function ProductDetailLayoutSectionView({ ctx, section }: { ctx: RenderCtx; section: ProductDetailLayoutSection }) {
  const { galleryPosition, stickyAddToCart, showShareButtons } = section.settings
  const product = (ctx.products ?? [])[0]
  if (!product) {
    return (
      <div className="container mx-auto px-4 text-center" style={{ color: 'var(--c-text-muted)' }}>
        Produto não encontrado.
      </div>
    )
  }
  // Combina photo_urls (array principal) + images jsonb (legado) — dedup.
  const photoUrls = product.photo_urls ?? []
  const imagesJson = (product as unknown as { images?: unknown }).images
  const extraUrls: string[] = Array.isArray(imagesJson)
    ? (imagesJson as unknown[]).map(x => typeof x === 'string' ? x : (typeof x === 'object' && x && 'url' in x ? (x as { url: string }).url : null)).filter((u): u is string => typeof u === 'string')
    : []
  const photos: string[] = Array.from(new Set([...photoUrls, ...extraUrls].filter(u => u && u.startsWith('http'))))
  // Texto da descrição completa (resolvido fora do JSX pra contornar
  // inferência esquisita do TS quando concatenamos opcionais no JSX).
  const longDescText: string = String(
    (product as unknown as { ai_long_description?: unknown }).ai_long_description ??
    (product as unknown as { description?: unknown }).description ?? ''
  )
  // Entries de atributos pra renderização — chave traduzida pra PT-BR,
  // valor formatado. Mostra TODOS (sem slice).
  const attrs = (product as unknown as { attributes?: unknown }).attributes
  const attrEntries: Array<[string, string]> = (attrs && typeof attrs === 'object' && !Array.isArray(attrs))
    ? Object.entries(attrs as Record<string, unknown>)
        .filter(([_, v]) => v != null && v !== '' && v !== 'not_specified')
        .map(([k, v]) => [translateAttrKey(k), formatAttrValue(k, v)] as [string, string])
    : []
  // Category só é mostrada se for nome legível (não MLB ID).
  const humanCategory = product.category && !/^MLB\d+$/i.test(product.category) ? product.category : null
  // Código mostrado no topo: prioridade SKU > model.
  const codeLabel = product.sku
    ? { label: 'SKU', value: product.sku }
    : product.model
      ? { label: 'Ref', value: product.model }
      : null

  const reverseClass =
    galleryPosition === 'right' ? 'md:flex-row-reverse'
    : galleryPosition === 'top'   ? 'flex-col'
    : 'md:flex-row'

  return (
    <div className="container mx-auto px-4">
      <div className={`flex flex-col gap-6 md:gap-12 ${reverseClass}`}>
        {/* Galeria interativa (todas as fotos, thumbs clicaveis) */}
        <div className="md:flex-1">
          <ProductGalleryClient photos={photos} alt={product.name} />
        </div>

        {/* Detalhes */}
        <div className="md:flex-1">
          {(product.brand || humanCategory) && (
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)' }}>
              {product.brand && <span>{product.brand}</span>}
              {product.brand && humanCategory && ' · '}
              {humanCategory && <span>{humanCategory}</span>}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <h1 style={{ flex: 1, fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem', lineHeight: 1.2, margin: 0 }}>
              {product.name}
            </h1>
            <WishlistButton slug={ctx.slug} productId={product.id} size="md" />
          </div>
          {codeLabel && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--c-text-muted)' }}>
              {codeLabel.label}: {codeLabel.value}
            </div>
          )}
          {typeof product.review_count === 'number' && product.review_count > 0 && (
            <a href="#reviews-section" style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none' }}>
              <ReviewStars value={product.review_avg ?? 0} count={product.review_count} size={15} idSeed={`detail-${product.id}`} />
            </a>
          )}
          <div style={{ marginTop: 16 }}>
            <PriceDisplay product={product} settings={ctx.paymentDisplay} cashback={ctx.cashback} variant="detail" inlineBadge />
          </div>
          {typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--c-warning, #eab308)', fontWeight: 600 }}>
              ⚡ Apenas {product.stock} em estoque
            </div>
          )}
          {product.ai_short_description && (
            <p style={{ marginTop: 16, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
              {product.ai_short_description}
            </p>
          )}
          {/* Bullets (lista de destaques) */}
          {Array.isArray(product.bullets) && product.bullets.length > 0 && (
            <ul style={{ marginTop: 16, paddingLeft: 18, color: 'var(--c-text)' }}>
              {(product.bullets as unknown[]).slice(0, 6).map((b, i) => (
                <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{String(b)}</li>
              ))}
            </ul>
          )}

          {/* CTA real — stepper + adicionar ao carrinho (+ barra sticky mobile) */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <AddToCartClient
                slug={ctx.slug}
                product={{
                  id:       product.id,
                  name:     product.name,
                  // Preço unitário efetivo (promo aplicada quando houver)
                  price:    product.effective_price ?? product.price,
                  imageUrl: photos[0],
                }}
                // Default retrocompatível: setting ausente no jsonb = sticky ligado
                sticky={stickyAddToCart ?? true}
              />
            </div>
            {ctx.store.whatsapp_number && (
              <a href={`https://wa.me/${ctx.store.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse no ${product.name}.`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '14px 20px', minHeight: 48,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#25D366', color: '#ffffff',
                  border: 0, borderRadius: 'var(--r)',
                  textDecoration: 'none', fontWeight: 600, textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(37,211,102,0.25)',
                }}>
                <WhatsAppIcon size={18} color="#ffffff" />
                Pedir pelo WhatsApp
              </a>
            )}
          </div>

          {/* Ambientador IA — "Veja no seu ambiente" (AH). Self-oculta se a loja não ativou. */}
          <RoomVisualizerLauncher slug={ctx.slug} productId={product.id} productName={product.name} productCategory={product.category} />

          {showShareButtons && (
            <div className="mt-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
              <ShareButtons productName={product.name} />
            </div>
          )}
        </div>
      </div>

      {/* Descrição completa + atributos abaixo da galeria */}
      {longDescText.trim() ? (
        <div className="mt-12 max-w-3xl">
          <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.5rem', marginBottom: 12 }}>
            Sobre este produto
          </h2>
          <div style={{ color: 'var(--c-text)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{longDescText}</div>
        </div>
      ) : null}

      {/* Atributos (especificações técnicas) */}
      <AttributesBlock attrs={attrEntries} />
    </div>
  )
}

// Mapa de tradução das keys de atributos comuns (Mercado Livre + ML catalog).
// Keys em snake_case → PT-BR amigável. Fallback: substitui underscore por
// espaço e capitaliza primeira letra.
const ATTR_LABELS: Record<string, string> = {
  // Dimensões
  height: 'Altura', width: 'Largura', length: 'Comprimento', depth: 'Profundidade',
  weight: 'Peso', diameter: 'Diâmetro',
  // Cores e material
  color: 'Cor', colors: 'Cores', material: 'Material', materials: 'Materiais',
  finish: 'Acabamento', pattern: 'Estampa', style: 'Estilo',
  // Elétrico
  voltage: 'Voltagem', power: 'Potência', wattage: 'Potência (W)',
  amperage: 'Amperagem', frequency: 'Frequência',
  lamp_type: 'Tipo de lâmpada', socket: 'Soquete', socket_type: 'Tipo do soquete',
  light_temperature: 'Temperatura da luz', luminous_flux: 'Fluxo luminoso (lúmens)',
  number_of_lamps: 'Número de lâmpadas', protection: 'Proteção',
  // Garantia / loja
  warranty_days: 'Garantia (dias)', warranty_type: 'Tipo de garantia',
  warranty: 'Garantia',
  // Linha / coleção / fabricação
  brand: 'Marca', model: 'Modelo', line: 'Linha', collection: 'Coleção',
  manufacturer: 'Fabricante', country_of_origin: 'País de origem',
  // Embalagem
  package_height: 'Altura da embalagem', package_width: 'Largura da embalagem',
  package_length: 'Comprimento da embalagem', package_weight: 'Peso da embalagem',
  packaging: 'Embalagem',
  // Outros
  age_group: 'Faixa etária', gender: 'Gênero', size: 'Tamanho',
  capacity: 'Capacidade', volume: 'Volume',
  is_kit: 'É kit?', units_per_pack: 'Unidades por embalagem',
  installation: 'Instalação', application: 'Aplicação',
  use: 'Uso', functions: 'Funções', features: 'Características',
}

function translateAttrKey(k: string): string {
  if (ATTR_LABELS[k]) return ATTR_LABELS[k]
  // Fallback: snake_case → "Snake Case" em PT-BR (capitaliza primeira)
  const friendly = k.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return friendly.charAt(0).toUpperCase() + friendly.slice(1)
}

// Mapa de tradução de VALUES comuns
const ATTR_VALUES: Record<string, string> = {
  seller: 'Loja', manufacturer: 'Fabricante',
  yes: 'Sim', no: 'Não', true: 'Sim', false: 'Não',
  white: 'Branco', black: 'Preto', red: 'Vermelho', blue: 'Azul',
  green: 'Verde', yellow: 'Amarelo', gold: 'Dourado', silver: 'Prateado',
  brown: 'Marrom', grey: 'Cinza', gray: 'Cinza',
  warm: 'Quente', cold: 'Fria', neutral: 'Neutra',
}

function formatAttrValue(key: string, v: unknown): string {
  if (v == null) return ''
  // Booleano
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  // Garantia tipo
  if (key === 'warranty_type' && typeof v === 'string') {
    return ATTR_VALUES[v.toLowerCase()] ?? v
  }
  // Garantia dias
  if (key === 'warranty_days' && typeof v === 'number') {
    return `${v} dias`
  }
  const s = String(v).trim()
  const low = s.toLowerCase()
  return ATTR_VALUES[low] ?? s
}

function AttributesBlock({ attrs }: { attrs: Array<[string, string]> }) {
  if (attrs.length === 0) return null
  return (
    <div className="mt-10 max-w-3xl">
      <h3 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.25rem', marginBottom: 12 }}>
        Especificações
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {attrs.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid var(--c-border)' }}>
              <td style={{ padding: '10px 12px 10px 0', color: 'var(--c-text-muted)', textTransform: 'capitalize', width: '40%' }}>{k.replace(/_/g, ' ')}</td>
              <td style={{ padding: '10px 0', color: 'var(--c-text)' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

