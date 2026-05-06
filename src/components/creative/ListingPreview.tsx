'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { CreativeListing, Marketplace } from './types'

interface Props {
  listing:        CreativeListing
  variant?:       Marketplace      // se passado, renderiza marketplace_variants[variant]
  productImage?:  string | null
}

/**
 * Simula visual aproximado de um anúncio em marketplace.
 * Não tenta clonar layout específico — só dá o "feel" pro user
 * conferir antes de aprovar.
 */
export default function ListingPreview({ listing, variant, productImage }: Props) {
  const v = variant ? listing.marketplace_variants?.[variant] : null
  const title       = v?.title       ?? listing.title
  const description = v?.description ?? listing.description
  const bullets     = v?.bullets     ?? listing.bullets

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Marketplace browser-like top bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-[10px] text-zinc-500 ml-2">
          Preview · {variant ? `variante ${variant}` : 'base'}
        </span>
      </div>

      <div className="p-4 space-y-4 text-zinc-200">
        {/* Image + title block */}
        <div className="flex gap-3">
          {productImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productImage}
              alt={title}
              className="h-20 w-20 object-contain rounded-lg bg-zinc-900 border border-zinc-800 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-snug" title={title}>{title}</h2>
            {listing.subtitle && (
              <p className="text-xs text-zinc-400 mt-1">{listing.subtitle}</p>
            )}
          </div>
        </div>

        {/* Bullets */}
        {bullets.length > 0 && (
          <div className="space-y-1">
            {bullets.map((b, i) => (
              <p key={i} className="text-xs text-zinc-300 leading-relaxed">{b}</p>
            ))}
          </div>
        )}

        {/* Description */}
        {description && (
          <details className="rounded-lg bg-zinc-900/50 border border-zinc-800">
            <summary className="text-xs text-zinc-300 px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-zinc-900">
              <span className="font-medium">Descrição completa</span>
              <ChevronDown size={12} />
            </summary>
            <div className="px-3 pb-3 pt-1 text-xs text-zinc-400 whitespace-pre-line leading-relaxed">
              {description}
            </div>
          </details>
        )}

        {/* Technical sheet */}
        {Object.keys(listing.technical_sheet ?? {}).length > 0 && !variant && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Ficha técnica</h3>
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(listing.technical_sheet).map(([k, val], i) => (
                    <tr key={k} className={i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950'}>
                      <td className="px-3 py-1.5 text-zinc-400 w-1/3">{k}</td>
                      <td className="px-3 py-1.5 text-zinc-200">{String(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAQ */}
        {!variant && listing.faq?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">FAQ</h3>
            <div className="space-y-1.5">
              {listing.faq.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
            </div>
          </div>
        )}

        {/* Keywords (compact) */}
        {!variant && listing.keywords?.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Palavras-chave</h3>
            <div className="flex flex-wrap gap-1">
              {listing.keywords.map((k, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className="w-full text-left rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
    >
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-zinc-200 font-medium">{q}</span>
        <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="px-3 pb-2 text-[11px] text-zinc-400 leading-relaxed">{a}</div>
      )}
    </button>
  )
}
