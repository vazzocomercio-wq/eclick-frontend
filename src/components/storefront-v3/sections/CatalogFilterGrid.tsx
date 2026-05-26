'use client'

/**
 * CatalogFilterGrid (Cat-2b) — barra de categorias no topo do catálogo +
 * grid filtrado. Só renderiza na página de coleção (/produtos). Client-side:
 * busca as categorias da loja (vazia = oculta) e filtra ctx.products por
 * category_ml_id sem recarregar a página.
 *
 * As categorias vêm do espelho ml_categories (resolvidas no backend); o filtro
 * é por categoria do ML — não toca em nada do produto, só esconde/mostra cards.
 */

import { useEffect, useMemo, useState } from 'react'
import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import { getStoreCategories, type StoreCategoryGroup } from '@/lib/storefront/data'
import type { RenderCtx } from '../RenderCtx'
import { ProductCard } from './ProductCard'

function colClass(n: number, breakpoint: '' | 'sm' | 'md' | 'lg'): string {
  const prefix = breakpoint ? `${breakpoint}:` : ''
  const safe: Record<number, string> = {
    1: `${prefix}grid-cols-1`, 2: `${prefix}grid-cols-2`, 3: `${prefix}grid-cols-3`,
    4: `${prefix}grid-cols-4`, 5: `${prefix}grid-cols-5`, 6: `${prefix}grid-cols-6`,
  }
  return safe[n] ?? `${prefix}grid-cols-2`
}

export function CatalogFilterGrid({ ctx, products, columns, cardStyle }: {
  ctx: RenderCtx
  products: StorefrontProduct[]
  columns: { mobile: number; tablet: number; desktop: number }
  cardStyle: 'compact' | 'detailed' | 'minimal'
}) {
  const [groups, setGroups] = useState<StoreCategoryGroup[]>([])
  // null = "Todas"; senão = id do grupo (top-level do ML) selecionado
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const g = await getStoreCategories(ctx.slug)
        if (!cancelled) setGroups(g)
      } catch { /* silencioso — sem categorias, mostra tudo */ }
    })()
    return () => { cancelled = true }
  }, [ctx.slug])

  // Conjunto de category_ml_id que pertencem ao grupo selecionado (folhas + o próprio top)
  const selectedMlIds = useMemo(() => {
    if (!selected) return null
    const g = groups.find(x => x.id === selected)
    if (!g) return null
    const ids = new Set<string>([g.id, ...g.children.map(c => c.id)])
    return ids
  }, [selected, groups])

  const visible = useMemo(() => {
    if (!selectedMlIds) return products
    return products.filter(p => p.category_ml_id && selectedMlIds.has(p.category_ml_id))
  }, [products, selectedMlIds])

  const gridCls = [
    'grid gap-4',
    colClass(columns.mobile, ''),
    colClass(columns.tablet, 'sm'),
    colClass(columns.desktop, 'md'),
  ].join(' ')

  return (
    <div>
      {/* Barra de categorias — só aparece se houver ao menos 1 grupo (vazia = oculta) */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Chip active={selected === null} onClick={() => setSelected(null)}>
            Todas
          </Chip>
          {groups.map(g => (
            <Chip key={g.id} active={selected === g.id} onClick={() => setSelected(g.id)}>
              {`${g.name} (${g.count})`}
            </Chip>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center" style={{ color: 'var(--c-text-muted)' }}>
          Nenhum produto nesta categoria.
        </p>
      ) : (
        <div className={gridCls}>
          {visible.map(p => <ProductCard key={p.id} ctx={ctx} product={p} variant={cardStyle} />)}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 text-xs font-medium transition-colors"
      style={{
        borderRadius: 999,
        minHeight: 36,
        border: `1px solid ${active ? 'var(--c-primary)' : 'var(--c-border)'}`,
        background: active ? 'var(--c-primary)' : 'transparent',
        color: active ? 'var(--c-on-accent)' : 'var(--c-text-muted)',
      }}
    >
      {children}
    </button>
  )
}
