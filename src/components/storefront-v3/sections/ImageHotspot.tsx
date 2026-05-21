/**
 * ImageHotspot v3 — imagem com pontos clicaveis que abrem o produto.
 *
 * Client Component (tooltip do hotspot abre/fecha com clique no mobile,
 * hover no desktop).
 */

'use client'

import { useState } from 'react'
import type { ImageHotspotSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

export function ImageHotspotSectionView({ ctx, section }: { ctx: RenderCtx; section: ImageHotspotSection }) {
  const { title, imageUrl, hotspots } = section.settings
  const [open, setOpen] = useState<string | null>(null)

  if (!imageUrl) return null

  return (
    <div className="container mx-auto px-4">
      {title && <h2 className="mb-6" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem' }}>{title}</h2>}
      <div className="relative" style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={title ?? ''} loading="lazy" style={{ width: '100%', display: 'block' }} />
        {hotspots.map(h => {
          const isOpen = open === h.id
          return (
            <div key={h.id} style={{
              position: 'absolute',
              left: `${h.xPct}%`, top: `${h.yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <button
                aria-label={h.label ?? 'Ver produto'}
                onClick={() => setOpen(isOpen ? null : h.id)}
                style={{
                  width: 32, height: 32, minWidth: 44, minHeight: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.95)', color: '#111',
                  border: '2px solid #fff', borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  fontSize: 18, fontWeight: 700,
                }}>+</button>
              {isOpen && (h.label || h.productId) && (
                <div
                  role="tooltip"
                  style={{
                    position: 'absolute',
                    bottom: '100%', left: '50%', transform: 'translate(-50%, -8px)',
                    background: 'var(--c-bg)', color: 'var(--c-text)',
                    border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
                    padding: '8px 12px', whiteSpace: 'nowrap', fontSize: 14,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}>
                  {h.label && <div style={{ fontWeight: 500 }}>{h.label}</div>}
                  {h.productId && (
                    <a href={`/loja/${ctx.slug}/produto/${h.productId}`}
                      style={{ color: 'var(--c-primary)', textDecoration: 'underline', display: 'block', marginTop: 4 }}>
                      Ver produto
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
