'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Check, Equal, Diff, GitBranch, ArrowRightLeft,
} from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeListing, CreativeProduct } from '@/components/creative/types'

/**
 * Compare 2 listings lado a lado. Útil pra decidir qual versão publicar
 * depois de regenerar com instruction diferente.
 *
 * Query params: ?a=<listingId>&b=<listingId>
 */
export default function ListingComparePage() {
  const params       = useParams<{ productId: string }>()
  const searchParams = useSearchParams()
  const productId    = params.productId
  const idA          = searchParams.get('a')
  const idB          = searchParams.get('b')

  const [product,  setProduct]  = useState<CreativeProduct | null>(null)
  const [listings, setListings] = useState<CreativeListing[]>([])
  const [a, setA]               = useState<CreativeListing | null>(null)
  const [b, setB]               = useState<CreativeListing | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => { void load() }, [productId, idA, idB])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [p, ls] = await Promise.all([
        CreativeApi.getProduct(productId),
        CreativeApi.listProductListings(productId),
      ])
      setProduct(p)
      setListings(ls)

      // Resolve A/B (default 2 versões mais recentes se query missing)
      const aId = idA ?? ls[1]?.id ?? null
      const bId = idB ?? ls[0]?.id ?? null
      if (aId) {
        const aListing = ls.find(l => l.id === aId) ?? await CreativeApi.getListing(aId)
        setA(aListing)
      }
      if (bId) {
        const bListing = ls.find(l => l.id === bId) ?? await CreativeApi.getListing(bId)
        setB(bListing)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function swap() {
    setA(b); setB(a)
    if (a && b) {
      const url = new URL(window.location.href)
      url.searchParams.set('a', b.id)
      url.searchParams.set('b', a.id)
      window.history.replaceState({}, '', url.toString())
    }
  }

  function pickA(listing: CreativeListing) {
    setA(listing)
    const url = new URL(window.location.href)
    url.searchParams.set('a', listing.id)
    window.history.replaceState({}, '', url.toString())
  }
  function pickB(listing: CreativeListing) {
    setB(listing)
    const url = new URL(window.location.href)
    url.searchParams.set('b', listing.id)
    window.history.replaceState({}, '', url.toString())
  }

  // ── Diff sections ─────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    if (!a || !b) return []
    return [
      diffString('Título',                     a.title,                     b.title),
      diffString('Subtítulo',                  a.subtitle ?? '',            b.subtitle ?? ''),
      diffString('Descrição',                  a.description,               b.description),
      diffArray ('Bullets',                    a.bullets,                   b.bullets),
      diffObject('Ficha técnica',              a.technical_sheet,           b.technical_sheet),
      diffArray ('Palavras-chave',             a.keywords,                  b.keywords),
      diffArray ('Tags de busca',              a.search_tags,               b.search_tags),
      diffString('Categoria sugerida',         a.suggested_category ?? '',  b.suggested_category ?? ''),
      diffFaq   ('FAQ',                        a.faq,                       b.faq),
      diffArray ('Diferenciais comerciais',    a.commercial_differentials,  b.commercial_differentials),
    ]
  }, [a, b])

  const diffCount = sections.filter(s => !s.same).length

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
  }
  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href={`/dashboard/creative/${productId}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error ?? 'Produto não encontrado'}</div>
      </div>
    )
  }
  if (listings.length < 2) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href={`/dashboard/creative/${productId}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center max-w-2xl">
          <GitBranch size={28} className="text-zinc-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-zinc-300">Apenas 1 versão disponível</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Pra comparar, gere outra versão do anúncio (botão "Regenerar" na página do listing).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/dashboard/creative/${productId}`} className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Diff size={14} className="text-cyan-400" />
                <h1 className="text-base font-semibold truncate" title={product.name}>Comparar versões — {product.name}</h1>
              </div>
              {a && b && (
                <p className="text-[11px] text-zinc-500">
                  v{a.version} <span className="text-zinc-600">vs</span> v{b.version} · <span className={diffCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>{diffCount} de {sections.length} campos diferentes</span>
                </p>
              )}
            </div>
          </div>

          {a && b && (
            <button
              type="button"
              onClick={swap}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs"
              title="Inverter A e B"
            >
              <ArrowRightLeft size={12} /> Inverter
            </button>
          )}
        </header>

        {/* Version selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <VersionSelector
            label="Versão A"
            current={a}
            options={listings}
            disabledId={b?.id ?? null}
            onPick={pickA}
          />
          <VersionSelector
            label="Versão B"
            current={b}
            options={listings}
            disabledId={a?.id ?? null}
            onPick={pickB}
          />
        </div>

        {/* Diff sections */}
        {a && b ? (
          <div className="space-y-3">
            {sections.map(s => (
              <DiffSection key={s.title} section={s} listingA={a} listingB={b} />
            ))}

            {/* Action footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 sticky bottom-3">
              <Link
                href={`/dashboard/creative/${productId}/listing/${a.id}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold shadow-[0_0_12px_rgba(0,229,255,0.25)]"
              >
                <Check size={14} /> Escolher v{a.version} (A)
              </Link>
              <Link
                href={`/dashboard/creative/${productId}/listing/${b.id}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold shadow-[0_0_12px_rgba(0,229,255,0.25)]"
              >
                <Check size={14} /> Escolher v{b.version} (B)
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">Selecione 2 versões pra comparar.</div>
        )}
      </div>
    </div>
  )
}

// ── Diff types ────────────────────────────────────────────────────────────

interface SectionResult {
  title:    string
  same:     boolean
  /** Renderer pra cada lado */
  render:   (side: 'a' | 'b', listing: CreativeListing) => React.ReactNode
}

function diffString(title: string, a: string, b: string): SectionResult {
  return {
    title,
    same: a.trim() === b.trim(),
    render: (side) => (
      <div className="text-xs text-zinc-200 whitespace-pre-line leading-relaxed">
        {side === 'a' ? a : b || <span className="text-zinc-600 italic">— vazio —</span>}
      </div>
    ),
  }
}

function diffArray(title: string, a: string[], b: string[]): SectionResult {
  const same = a.length === b.length && a.every((v, i) => v === b[i])
  const aSet = new Set(a)
  const bSet = new Set(b)
  return {
    title,
    same,
    render: (side, listing) => {
      const items = title.startsWith('Bullets') ? listing.bullets
        : title.startsWith('Palavras')         ? listing.keywords
        : title.startsWith('Tags')              ? listing.search_tags
        : listing.commercial_differentials
      const otherSet = side === 'a' ? bSet : aSet
      return (
        <ul className="space-y-1">
          {items.map((item, i) => {
            const inOther = otherSet.has(item)
            return (
              <li key={i} className={[
                'text-xs px-2 py-1 rounded',
                inOther ? 'text-zinc-300' : 'text-amber-200 bg-amber-400/10 border border-amber-400/20',
              ].join(' ')}>
                {!inOther && <span className="mr-1 text-amber-400">●</span>}
                {item}
              </li>
            )
          })}
          {items.length === 0 && (
            <li className="text-[10px] text-zinc-600 italic">— vazio —</li>
          )}
        </ul>
      )
    },
  }
}

function diffObject(title: string, a: Record<string, string>, b: Record<string, string>): SectionResult {
  const aKeys = Object.keys(a ?? {})
  const bKeys = Object.keys(b ?? {})
  const allKeys = new Set([...aKeys, ...bKeys])
  let same = aKeys.length === bKeys.length
  if (same) {
    for (const k of allKeys) {
      if (String(a[k] ?? '') !== String(b[k] ?? '')) { same = false; break }
    }
  }
  return {
    title,
    same,
    render: (side, listing) => {
      const obj = listing.technical_sheet
      const otherObj = side === 'a' ? b : a
      const keys = Object.keys(obj ?? {})
      if (keys.length === 0) return <p className="text-[10px] text-zinc-600 italic">— vazio —</p>
      return (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {keys.map((k, i) => {
                const otherVal = String(otherObj[k] ?? '')
                const myVal    = String(obj[k] ?? '')
                const diff     = otherVal !== myVal
                return (
                  <tr key={k} className={diff ? 'bg-amber-400/10' : (i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-950')}>
                    <td className="px-2 py-1 text-zinc-400 w-1/3">{k}</td>
                    <td className={['px-2 py-1', diff ? 'text-amber-200' : 'text-zinc-200'].join(' ')}>{myVal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
    },
  }
}

function diffFaq(title: string, a: Array<{ q: string; a: string }>, b: Array<{ q: string; a: string }>): SectionResult {
  const same = a.length === b.length && a.every((item, i) => item.q === b[i]?.q && item.a === b[i]?.a)
  return {
    title,
    same,
    render: (side, listing) => {
      const faq = listing.faq ?? []
      if (faq.length === 0) return <p className="text-[10px] text-zinc-600 italic">— vazio —</p>
      return (
        <div className="space-y-1.5">
          {faq.map((f, i) => (
            <div key={i} className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
              <p className="text-[11px] text-zinc-200 font-medium">{f.q}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{f.a}</p>
            </div>
          ))}
        </div>
      )
    },
  }
}

// ── Sub-components ────────────────────────────────────────────────────────

function VersionSelector({
  label, current, options, disabledId, onPick,
}: {
  label:      string
  current:    CreativeListing | null
  options:    CreativeListing[]
  disabledId: string | null
  onPick:     (l: CreativeListing) => void
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{label}</p>
      <select
        value={current?.id ?? ''}
        onChange={e => {
          const l = options.find(x => x.id === e.target.value)
          if (l) onPick(l)
        }}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400"
      >
        {!current && <option value="">— selecione —</option>}
        {options.map(l => (
          <option key={l.id} value={l.id} disabled={l.id === disabledId}>
            v{l.version} · {new Date(l.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {l.status}{l.parent_listing_id ? ' (regen)' : ''}
          </option>
        ))}
      </select>
      {current && (
        <p className="mt-1.5 text-[10px] text-zinc-500 truncate" title={current.title}>
          {current.title}
        </p>
      )}
    </div>
  )
}

function DiffSection({
  section, listingA, listingB,
}: {
  section:  SectionResult
  listingA: CreativeListing
  listingB: CreativeListing
}) {
  return (
    <div className={[
      'rounded-xl border overflow-hidden',
      section.same ? 'border-zinc-800' : 'border-amber-400/30',
    ].join(' ')}>
      <header className={[
        'flex items-center justify-between px-3 py-1.5 text-[11px] border-b',
        section.same ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400' : 'bg-amber-400/5 border-amber-400/30 text-amber-300',
      ].join(' ')}>
        <span className="font-semibold uppercase tracking-wider">{section.title}</span>
        <span className="flex items-center gap-1 text-[10px]">
          {section.same ? <><Equal size={10} /> idêntico</> : <><Diff size={10} /> diferente</>}
        </span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
        <div className="p-3">{section.render('a', listingA)}</div>
        <div className="p-3">{section.render('b', listingB)}</div>
      </div>
    </div>
  )
}
