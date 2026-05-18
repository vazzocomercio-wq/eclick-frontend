'use client'

/**
 * Grade de catalogo — filtro por categoria + ordenacao, 100% client-side
 * sobre os produtos publicos da loja. Usada na pagina de colecao.
 */

import { useMemo, useState } from 'react'
import { PremiumProductCard } from './premium/PremiumProductCard'
import type { StorefrontProduct } from '@/lib/storefront/data'
import type { RenderCtx } from './renderCtx'

type Sort = 'rel' | 'asc' | 'desc'

function Chip({ active, onClick, ctx, children }: {
  active: boolean
  onClick: () => void
  ctx: RenderCtx
  children: string
}) {
  const { colors } = ctx.theme
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 text-xs font-medium transition-colors"
      style={{
        borderRadius: 999,
        border: `1px solid ${active ? colors.primary : colors.border}`,
        background: active ? colors.primary : 'transparent',
        color: active ? colors.background : colors.textMuted,
      }}
    >
      {children}
    </button>
  )
}

export function CatalogGrid({ products, slug, ctx, initialCategory }: {
  products: StorefrontProduct[]
  slug: string
  ctx: RenderCtx
  initialCategory?: string
}) {
  const { colors } = ctx.theme

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { if (p.category) set.add(p.category) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [products])

  const [cat, setCat] = useState<string | null>(
    initialCategory && categories.includes(initialCategory) ? initialCategory : null,
  )
  const [sort, setSort] = useState<Sort>('rel')

  const visible = useMemo(() => {
    const list = cat ? products.filter(p => p.category === cat) : products.slice()
    if (sort === 'asc') list.sort((a, b) => a.price - b.price)
    else if (sort === 'desc') list.sort((a, b) => b.price - a.price)
    return list
  }, [products, cat, sort])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {categories.length > 0 && (
          <>
            <Chip active={cat === null} onClick={() => setCat(null)} ctx={ctx}>Tudo</Chip>
            {categories.map(c => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)} ctx={ctx}>{c}</Chip>
            ))}
          </>
        )}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as Sort)}
          aria-label="Ordenar"
          className="ml-auto text-xs px-3 py-1.5 outline-none cursor-pointer"
          style={{
            borderRadius: ctx.radius,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
          }}
        >
          <option value="rel">Relevância</option>
          <option value="asc">Menor preço</option>
          <option value="desc">Maior preço</option>
        </select>
      </div>

      <p className="text-xs mb-5" style={{ color: colors.textMuted }}>
        {visible.length} {visible.length === 1 ? 'produto' : 'produtos'}
      </p>

      {visible.length === 0 ? (
        <div
          className="py-16 text-center text-sm"
          style={{ color: colors.textMuted, border: `1px dashed ${colors.border}`, borderRadius: ctx.radius }}
        >
          Nenhum produto nesta categoria.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" style={{ gap: ctx.gap }}>
          {visible.map(p => (
            <PremiumProductCard key={p.id} product={p} slug={slug} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  )
}
