'use client'

/** Copiar anúncios selecionados para outras contas/plataformas.
 *  Usado pelas bulk bars das páginas de anúncios (ML, TikTok, …).
 *  Multi-select de destinos (contas ML, lojas Shopee, TikTok, Loja própria) +
 *  opção de publicar agora (background) ou só enfileirar no Multiplicador.
 *  Chama POST /multiplier/batch. */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { X, Loader2, Copy, CheckCircle2, AlertTriangle, ShoppingBag, Store, Globe, ExternalLink } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Targets = {
  mercadolivre: Array<{ seller_id: number; nickname: string | null }>
  shopee:       Array<{ shop_id: number; nickname: string | null }>
  tiktok_shop:  { connected: boolean }
  storefront:   { connected: boolean }
}

type Dest = { key: string; platform: string; account_id: string | null; label: string; icon: React.ReactNode }

/** Item a copiar: o produto canônico por trás do anúncio + de onde veio. */
export type CopyItem = { product_id: string; listing_id: string; platform: string }

type BatchResult = {
  created: number; skipped: number; failed: number; publishing: number
  results: Array<{ product_id: string | null; target: string; status: string; reason?: string }>
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}

export default function CopyToChannelsModal({ items, unlinkedCount, onClose, onDone }: {
  /** anúncios COM produto vinculado (os que dá pra copiar) */
  items: CopyItem[]
  /** quantos selecionados estão SEM produto (não copiáveis) — só pra avisar */
  unlinkedCount: number
  onClose: () => void
  onDone: (summary: string) => void
}) {
  const [targets, setTargets] = useState<Targets | null>(null)
  const [picked, setPicked]   = useState<Set<string>>(new Set())
  const [publish, setPublish] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const h = await authHeaders()
        const res = await fetch(`${BACKEND}/multiplier/targets`, { headers: h })
        if (!res.ok) throw new Error(`destinos: HTTP ${res.status}`)
        setTargets(await res.json())
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Falha ao carregar destinos.')
      } finally { setLoading(false) }
    })()
  }, [])

  const dests: Dest[] = targets ? [
    ...targets.mercadolivre.map(c => ({
      key: `mercadolivre:${c.seller_id}`, platform: 'mercadolivre', account_id: String(c.seller_id),
      label: c.nickname ? `ML ${c.nickname}` : `ML ${c.seller_id}`, icon: <ShoppingBag size={13} />,
    })),
    ...targets.shopee.map(s => ({
      key: `shopee:${s.shop_id}`, platform: 'shopee', account_id: String(s.shop_id),
      label: s.nickname ?? `Shopee ${s.shop_id}`, icon: <ShoppingBag size={13} />,
    })),
    ...(targets.tiktok_shop.connected ? [{
      key: 'tiktok_shop', platform: 'tiktok_shop', account_id: null as string | null,
      label: 'TikTok Shop', icon: <Store size={13} />,
    }] : []),
    { key: 'storefront', platform: 'storefront', account_id: null, label: 'Loja própria', icon: <Globe size={13} /> },
  ] : []

  const toggle = (key: string) => setPicked(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  const run = async () => {
    const chosen = dests.filter(d => picked.has(d.key))
    if (chosen.length === 0) { setErr('Escolha ao menos uma conta/plataforma de destino.'); return }
    setBusy(true); setErr('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/multiplier/batch`, {
        method: 'POST', headers: h,
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.product_id, platform: i.platform, listing_id: i.listing_id })),
          targets: chosen.map(d => ({ platform: d.platform, account_id: d.account_id })),
          publish,
        }),
      })
      const out = (await res.json()) as BatchResult & { message?: string }
      if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
      const parts = [`${out.created} cópia(s) criada(s)`]
      if (out.publishing) parts.push(`${out.publishing} publicando em segundo plano`)
      if (out.skipped) parts.push(`${out.skipped} já existia(m)`)
      if (out.failed) parts.push(`${out.failed} com erro`)
      onDone(
        parts.join(' · ') +
        (publish ? '. Acompanhe em Catálogo › Multiplicador.' : '. Revise e publique em Catálogo › Multiplicador.'),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao copiar.')
    } finally { setBusy(false) }
  }

  const combos = items.length * picked.size

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <Copy size={15} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Copiar para outras contas/plataformas</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>
        <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>
          {items.length} anúncio(s) selecionado(s){unlinkedCount > 0 ? ` · ${unlinkedCount} sem produto vinculado (não serão copiados — vincule ou crie o produto antes)` : ''}
        </p>

        {err && (
          <div className="mb-3 flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{err}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm" style={{ color: '#a1a1aa' }}>
            <Loader2 size={16} className="animate-spin" /> Carregando destinos…
          </div>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>Destinos</p>
            <div className="space-y-1.5">
              {dests.map(d => {
                const on = picked.has(d.key)
                return (
                  <button key={d.key} onClick={() => toggle(d.key)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
                    style={on
                      ? { background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.4)', color: '#00E5FF' }
                      : { background: '#0a0a0e', border: '1px solid #27272a', color: '#e4e4e7' }}>
                    <span className="flex h-4 w-4 items-center justify-center rounded" style={{ border: on ? '1px solid #00E5FF' : '1px solid #3f3f46', background: on ? '#00E5FF' : 'transparent' }}>
                      {on && <CheckCircle2 size={12} style={{ color: '#000' }} />}
                    </span>
                    {d.icon}
                    {d.label}
                  </button>
                )
              })}
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg p-3" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
              <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
              <div className="text-xs">
                <p className="font-semibold text-white">Publicar agora</p>
                <p style={{ color: '#71717a' }}>
                  {publish
                    ? 'Cria o anúncio REAL em cada destino (em segundo plano). ML nasce pausado pra revisão.'
                    : 'Só cria os rascunhos na fila do Multiplicador pra você revisar e publicar.'}
                </p>
              </div>
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="mr-auto text-[11px]" style={{ color: '#52525b' }}>
                {combos > 0 ? `${combos} cópia(s)` : ''}{combos > 120 ? ' — máx 120 por vez' : ''}
              </span>
              <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>
                Cancelar
              </button>
              <button onClick={() => void run()} disabled={busy || picked.size === 0 || items.length === 0 || combos > 120}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : publish ? <ExternalLink size={12} /> : <Copy size={12} />}
                {busy ? 'Copiando…' : publish ? 'Copiar e publicar' : 'Copiar (fila)'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
