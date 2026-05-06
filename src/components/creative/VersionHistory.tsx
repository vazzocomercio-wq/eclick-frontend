'use client'

import Link from 'next/link'
import { History, GitBranch, Check } from 'lucide-react'
import type { CreativeListing } from './types'

interface Props {
  listings:        CreativeListing[]
  productId:       string
  currentListingId: string
}

export default function VersionHistory({ listings, productId, currentListingId }: Props) {
  if (listings.length === 0) return null

  return (
    <details className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <summary className="cursor-pointer px-4 py-2.5 flex items-center justify-between hover:bg-zinc-900 transition-colors">
        <div className="flex items-center gap-2">
          <History size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-zinc-200">Histórico de versões</span>
          <span className="text-[10px] text-zinc-500">({listings.length})</span>
        </div>
        <span className="text-[10px] text-zinc-500">expandir</span>
      </summary>
      <div className="border-t border-zinc-800 divide-y divide-zinc-800">
        {listings.map(l => {
          const current = l.id === currentListingId
          const cost = (l.generation_metadata?.cost_usd as number | undefined)
          return (
            <Link
              key={l.id}
              href={`/dashboard/creative/${productId}/listing/${l.id}`}
              className={[
                'flex items-center justify-between px-4 py-2.5 text-xs transition-colors',
                current ? 'bg-cyan-400/5' : 'hover:bg-zinc-900',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={[
                  'flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold shrink-0',
                  current ? 'bg-cyan-400 text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
                ].join(' ')}>
                  v{l.version}
                </span>
                <div className="min-w-0">
                  <p className="text-zinc-200 truncate" title={l.title}>{l.title}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(l.created_at).toLocaleString('pt-BR')}
                    {l.parent_listing_id ? ' · regenerado' : ' · original'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-2">
                {l.status === 'approved' && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Check size={10} /> aprovado
                  </span>
                )}
                {typeof cost === 'number' && (
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ${cost.toFixed(4)}
                  </span>
                )}
                {current && <GitBranch size={12} className="text-cyan-400" />}
              </div>
            </Link>
          )
        })}
      </div>
    </details>
  )
}
