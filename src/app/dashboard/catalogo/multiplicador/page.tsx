'use client'

/** Multiplicador de Anúncios — copia produto/anúncio pra outro canal.
 *  Fluxo: escolhe destino → lista candidatos (produto com anúncio em ≥1 canal
 *  e SEM anúncio no destino) → "Multiplicar" cria um draft revisável (título/
 *  descrição/preço/fotos já adaptados) → revisa no modal → Publicar (cria
 *  anúncio REAL via publicador do canal; vínculo + estoque automáticos). */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Copy, RefreshCw, AlertTriangle, CheckCircle2, X, Loader2, Layers, Search,
  Store, ShoppingBag, Globe, ExternalLink,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── tipos (espelham o backend /multiplier) ──────────────────────────────────

type Targets = {
  mercadolivre: Array<{ seller_id: number; nickname: string | null }>
  shopee:       Array<{ shop_id: number; nickname: string | null }>
  tiktok_shop:  { connected: boolean }
  storefront:   { connected: boolean }
}

type Candidate = {
  product_id:  string
  name:        string
  sku:         string | null
  price:       number | null
  stock:       number | null
  photo_count: number
  thumbnail:   string | null
  covered:     string[]
  warnings:    string[]
}

type Variation = {
  product_id: string
  label:      string
  price:      number | null
  sku:        string | null
  name?:      string | null
  stock?:     number | null
}

type DraftPayload = {
  title:       string
  description: string | null
  price:       number | null
  image_urls:  string[]
  sku:         string | null
  brand:       string | null
  weight_kg:   number | null
  package_dimensions_cm: { length: number; width: number; height: number } | null
  stock:       number | null
  category_id?: string | null
  listing_type?: string | null
  condition?:   string | null
  variations?:  Variation[] | null
  variation_tier_name?: string | null
}

type Draft = {
  id: string
  product_id: string
  source_platform: string | null
  source_listing_id: string | null
  target_platform: string
  target_account_id: string | null
  payload: DraftPayload
  status: 'draft' | 'publishing' | 'published' | 'failed' | 'discarded'
  error_message: string | null
  external_id: string | null
  created_at: string
  published_at: string | null
}

type TargetSel = { platform: 'mercadolivre' | 'shopee' | 'tiktok_shop' | 'storefront'; accountId: string | null; label: string }

const PLATFORM_LABEL: Record<string, string> = {
  mercadolivre: 'Mercado Livre', shopee: 'Shopee', tiktok_shop: 'TikTok Shop',
  storefront: 'Loja própria', amazon: 'Amazon', magalu: 'Magalu',
}

/** Rótulo de um canal coberto ('platform:account_id') com o NOME da conta/loja
 *  (apelidos vêm dos destinos carregados) — não só a plataforma. */
function channelLabel(ch: string, targets: Targets | null): string {
  const [plat, acct] = ch.split(':')
  const base = PLATFORM_LABEL[plat] ?? plat
  if (!acct || acct === 'loja') return base
  if (plat === 'mercadolivre') {
    const c = targets?.mercadolivre.find(m => String(m.seller_id) === acct)
    return c?.nickname ? `ML ${c.nickname}` : `ML …${acct.slice(-4)}`
  }
  if (plat === 'shopee') {
    const s = targets?.shopee.find(x => String(x.shop_id) === acct)
    return s?.nickname ?? `Shopee …${acct.slice(-4)}`
  }
  return `${base} …${acct.slice(-4)}`
}

const STATUS_STYLE: Record<Draft['status'], { label: string; color: string; bg: string }> = {
  draft:      { label: 'Rascunho',   color: '#a5f3fc', bg: 'rgba(0,229,255,0.10)' },
  publishing: { label: 'Publicando', color: '#fcd34d', bg: 'rgba(252,211,77,0.10)' },
  published:  { label: 'Publicado',  color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  failed:     { label: 'Falhou',     color: '#f87171', bg: 'rgba(239,68,68,0.10)' },
  discarded:  { label: 'Descartado', color: '#71717a', bg: 'rgba(113,113,122,0.10)' },
}

export default function MultiplicadorPage() {
  const [targets, setTargets]   = useState<Targets | null>(null)
  const [sel, setSel]           = useState<TargetSel | null>(null)
  const [cands, setCands]       = useState<{ total: number; items: Candidate[] } | null>(null)
  const [drafts, setDrafts]     = useState<Draft[]>([])
  const [q, setQ]               = useState('')
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)   // product_id criando draft
  const [error, setError]       = useState('')
  const [notice, setNotice]     = useState('')
  const [review, setReview]     = useState<Draft | null>(null)    // modal de revisão
  const [importOpen, setImportOpen] = useState(false)             // modal importar concorrente

  // ── carregamento ──────────────────────────────────────────────────────────

  const loadTargets = useCallback(async () => {
    const h = await authHeaders()
    const res = await fetch(`${BACKEND}/multiplier/targets`, { headers: h })
    if (!res.ok) throw new Error(`destinos: HTTP ${res.status}`)
    const t = (await res.json()) as Targets
    setTargets(t)
    setSel(prev => prev ?? defaultTarget(t))
  }, [])

  const loadCandidates = useCallback(async (target: TargetSel, search: string) => {
    const h = await authHeaders()
    const params = new URLSearchParams({ target: target.platform, limit: '60' })
    if (target.accountId) params.set('account_id', target.accountId)
    if (search.trim()) params.set('q', search.trim())
    const res = await fetch(`${BACKEND}/multiplier/candidates?${params}`, { headers: h })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `candidatos: HTTP ${res.status}`)
    setCands(await res.json())
  }, [])

  const loadDrafts = useCallback(async () => {
    const h = await authHeaders()
    const res = await fetch(`${BACKEND}/multiplier/drafts?limit=60`, { headers: h })
    if (!res.ok) throw new Error(`fila: HTTP ${res.status}`)
    setDrafts((await res.json()) as Draft[])
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true); setError('')
      try { await Promise.all([loadTargets(), loadDrafts()]) }
      catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar.') }
      finally { setLoading(false) }
    })()
  }, [loadTargets, loadDrafts])

  // Deep-link: /multiplicador?draft=<id> abre direto o modal de revisão
  // (vindo do clique "Revisar" na lista de Produtos). Só na chegada.
  const deepLinkDone = useState(() => ({ done: false }))[0]
  useEffect(() => {
    if (deepLinkDone.done || drafts.length === 0) return
    const id = new URLSearchParams(window.location.search).get('draft')
    if (!id) { deepLinkDone.done = true; return }
    const d = drafts.find(x => x.id === id && (x.status === 'draft' || x.status === 'failed'))
    if (d) { setReview(d); deepLinkDone.done = true }
  }, [drafts, deepLinkDone])

  useEffect(() => {
    if (!sel) return
    setCands(null); setError('')
    loadCandidates(sel, q).catch(e => setError(e instanceof Error ? e.message : 'Falha ao listar candidatos.'))
  }, [sel, loadCandidates]) // q só ao apertar Enter/botão (handleSearch)

  const handleSearch = () => {
    if (!sel) return
    setCands(null)
    loadCandidates(sel, q).catch(e => setError(e instanceof Error ? e.message : 'Falha na busca.'))
  }

  // ── ações ─────────────────────────────────────────────────────────────────

  const createDraft = async (c: Candidate) => {
    if (!sel) return
    setBusy(c.product_id); setError(''); setNotice('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/multiplier/drafts`, {
        method: 'POST', headers: h,
        body: JSON.stringify({
          product_id: c.product_id,
          target_platform: sel.platform,
          target_account_id: sel.accountId,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
      setReview(body as Draft)
      await loadDrafts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar rascunho.')
    } finally { setBusy(null) }
  }

  const afterReviewChange = async (updated: Draft | null, msg?: string) => {
    setReview(updated)
    if (msg) setNotice(msg)
    await loadDrafts()
    if (sel) await loadCandidates(sel, q).catch(() => undefined)
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Layers size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white">Multiplicador de Anúncios</h1>
          <p className="text-xs" style={{ color: '#a1a1aa' }}>
            Copie um produto que já vende em um canal pra outro canal — título, descrição, preço e fotos adaptados, estoque sincronizado.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
            <ExternalLink size={12} /> Importar de concorrente
          </button>
          <button onClick={() => { setError(''); void loadDrafts(); if (sel) void loadCandidates(sel, q) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
          <CheckCircle2 size={14} className="shrink-0" /> {notice}
          <button onClick={() => setNotice('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* seletor de destino */}
      {targets && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>Destino:</span>
          {targets.mercadolivre.map(c => (
            <TargetChip key={`ml-${c.seller_id}`} icon={<ShoppingBag size={12} />}
              label={c.nickname ? `ML ${c.nickname}` : `ML ${c.seller_id}`}
              active={sel?.platform === 'mercadolivre' && sel.accountId === String(c.seller_id)}
              onClick={() => setSel({ platform: 'mercadolivre', accountId: String(c.seller_id), label: c.nickname ? `ML ${c.nickname}` : `ML ${c.seller_id}` })} />
          ))}
          {targets.shopee.map(s => (
            <TargetChip key={`shopee-${s.shop_id}`} icon={<ShoppingBag size={12} />}
              label={s.nickname ?? `Shopee ${s.shop_id}`}
              active={sel?.platform === 'shopee' && sel.accountId === String(s.shop_id)}
              onClick={() => setSel({ platform: 'shopee', accountId: String(s.shop_id), label: s.nickname ?? `Shopee ${s.shop_id}` })} />
          ))}
          {targets.tiktok_shop.connected && (
            <TargetChip icon={<Store size={12} />} label="TikTok Shop"
              active={sel?.platform === 'tiktok_shop'}
              onClick={() => setSel({ platform: 'tiktok_shop', accountId: null, label: 'TikTok Shop' })} />
          )}
          <TargetChip icon={<Globe size={12} />} label="Loja própria"
            active={sel?.platform === 'storefront'}
            onClick={() => setSel({ platform: 'storefront', accountId: null, label: 'Loja própria' })} />
        </div>
      )}

      {/* busca */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <Search size={13} style={{ color: '#52525b' }} />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por nome ou SKU…"
            className="w-full bg-transparent text-sm outline-none" style={{ color: '#fafafa' }} />
        </div>
        <button onClick={handleSearch} className="rounded-lg px-4 py-2 text-xs font-semibold"
          style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
          Buscar
        </button>
      </div>

      {/* candidatos */}
      <section className="rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#27272a' }}>
          <Copy size={14} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-white">
            Candidatos {sel ? `→ ${sel.label}` : ''}
          </h2>
          <span className="text-xs" style={{ color: '#52525b' }}>
            {cands ? `${cands.total} produto(s) com anúncio em outro canal e sem anúncio neste destino` : ''}
          </span>
        </div>

        {loading || !cands ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm" style={{ color: '#a1a1aa' }}>
            <Loader2 size={16} className="animate-spin" /> Carregando…
          </div>
        ) : cands.items.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: '#52525b' }}>
            Nenhum candidato — tudo que tem anúncio em outros canais já está coberto neste destino. 🎉
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#27272a' }}>
            {cands.items.map(c => (
              <div key={c.product_id} className="flex items-center gap-3 px-4 py-3">
                {c.thumbnail
                  ? <img src={c.thumbnail} alt="" className="h-11 w-11 rounded-lg object-cover" style={{ border: '1px solid #27272a' }} />
                  : <div className="flex h-11 w-11 items-center justify-center rounded-lg text-[10px]" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#52525b' }}>sem foto</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: '#71717a' }}>
                    {c.sku && <span>SKU {c.sku}</span>}
                    {c.price != null && <span>R$ {c.price.toFixed(2)}</span>}
                    <span>{c.photo_count} foto(s)</span>
                    {c.covered.map(ch => (
                      <span key={ch} className="rounded px-1.5 py-0.5" style={{ background: 'rgba(0,229,255,0.07)', color: '#a5f3fc' }}>
                        {channelLabel(ch, targets)}
                      </span>
                    ))}
                    {c.warnings.map(w => (
                      <span key={w} className="rounded px-1.5 py-0.5" style={{ background: 'rgba(252,211,77,0.08)', color: '#fcd34d' }}>⚠ {w}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => void createDraft(c)} disabled={busy === c.product_id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
                  style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                  {busy === c.product_id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                  Multiplicar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* fila de drafts */}
      <section className="rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#27272a' }}>
          <Layers size={14} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Fila de multiplicação</h2>
          <span className="text-xs" style={{ color: '#52525b' }}>{drafts.length} item(ns)</span>
        </div>
        {drafts.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: '#52525b' }}>Nada na fila — clique em “Multiplicar” em um candidato.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#27272a' }}>
            {drafts.filter(d => d.status !== 'discarded').map(d => {
              const st = STATUS_STYLE[d.status]
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 rounded px-2 py-1 text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{d.payload?.title ?? '(sem título)'}</p>
                    <p className="text-[11px]" style={{ color: '#71717a' }}>
                      {d.source_platform ? `${PLATFORM_LABEL[d.source_platform] ?? d.source_platform} ${d.source_listing_id ?? ''}` : 'do catálogo'}
                      {' → '}{channelLabel(d.target_account_id ? `${d.target_platform}:${d.target_account_id}` : d.target_platform, targets)}
                      {d.external_id && d.status === 'published' ? ` · criado: ${d.external_id}` : ''}
                    </p>
                    {d.status === 'failed' && d.error_message && (
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px]" style={{ color: '#f87171' }}>{d.error_message}</p>
                    )}
                  </div>
                  {(d.status === 'draft' || d.status === 'failed') && (
                    <button onClick={() => setReview(d)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                      Revisar &amp; publicar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {review && (
        <ReviewModal draft={review} onClose={() => setReview(null)} onChanged={afterReviewChange} />
      )}
      {importOpen && targets && (
        <ImportCompetitorModal
          targets={targets}
          defaultSel={sel}
          onClose={() => setImportOpen(false)}
          onImported={async (draft, msg) => {
            setImportOpen(false)
            setNotice(msg)
            await loadDrafts()
            if (draft) setReview(draft)
          }} />
      )}
    </div>
  )
}

// ── modal: importar anúncio de concorrente ───────────────────────────────────

function ImportCompetitorModal({ targets, defaultSel, onClose, onImported }: {
  targets: Targets
  defaultSel: TargetSel | null
  onClose: () => void
  onImported: (draft: Draft | null, msg: string) => Promise<void>
}) {
  const [url, setUrl]   = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [target, setTarget] = useState<TargetSel | null>(defaultSel)

  const options: TargetSel[] = [
    ...targets.mercadolivre.map(c => ({ platform: 'mercadolivre' as const, accountId: String(c.seller_id), label: c.nickname ? `ML ${c.nickname}` : `ML ${c.seller_id}` })),
    ...targets.shopee.map(s => ({ platform: 'shopee' as const, accountId: String(s.shop_id), label: s.nickname ?? `Shopee ${s.shop_id}` })),
    ...(targets.tiktok_shop.connected ? [{ platform: 'tiktok_shop' as const, accountId: null, label: 'TikTok Shop' }] : []),
    { platform: 'storefront' as const, accountId: null, label: 'Loja própria' },
  ]

  const run = async () => {
    if (!url.trim()) { setErr('Cole a URL do anúncio (Mercado Livre ou Shopee).'); return }
    setBusy(true); setErr('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/multiplier/import-competitor`, {
        method: 'POST', headers: h,
        body: JSON.stringify({
          url: url.trim(),
          target_platform: target?.platform ?? null,
          target_account_id: target?.accountId ?? null,
        }),
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
      const d = (out as { draft: Draft | null; scraped: { title: string; images: number }; reused: boolean }).draft
      await onImported(d,
        `Importado: "${(out as { scraped: { title: string } }).scraped.title.slice(0, 60)}" (${(out as { scraped: { images: number } }).scraped.images} fotos)` +
        `${(out as { reused: boolean }).reused ? ' — produto já existia, reusado' : ' — produto criado como rascunho no catálogo'}.` +
        (d ? ' Revise e publique.' : ''))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao importar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <ExternalLink size={15} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Importar anúncio de concorrente</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>

        {err && (
          <div className="mb-3 whitespace-pre-line rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
        )}

        <Field label="URL do anúncio (Mercado Livre ou Shopee)">
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && void run()}
            placeholder="https://produto.mercadolivre.com.br/MLB-…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
        </Field>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>Publicar para (opcional)</p>
          <div className="flex flex-wrap gap-1.5">
            <TargetChip icon={<Copy size={11} />} label="Só importar" active={target === null} onClick={() => setTarget(null)} />
            {options.map(o => (
              <TargetChip key={`${o.platform}:${o.accountId ?? ''}`} icon={<Store size={11} />} label={o.label}
                active={target?.platform === o.platform && target?.accountId === o.accountId}
                onClick={() => setTarget(o)} />
            ))}
          </div>
        </div>

        <p className="mt-3 rounded-lg p-2 text-[11px]" style={{ background: 'rgba(252,211,77,0.07)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.25)' }}>
          ⚠ Conteúdo de terceiro: fotos e textos podem ter direitos autorais — revise/edite antes de publicar.
        </p>

        <div className="mt-4 flex justify-end">
          <button onClick={() => void run()} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── modal de revisão ─────────────────────────────────────────────────────────

function ReviewModal({ draft, onClose, onChanged }: {
  draft: Draft
  onClose: () => void
  onChanged: (d: Draft | null, msg?: string) => Promise<void>
}) {
  const [title, setTitle]       = useState(draft.payload?.title ?? '')
  const [desc, setDesc]         = useState(draft.payload?.description ?? '')
  const [price, setPrice]       = useState(draft.payload?.price != null ? String(draft.payload.price) : '')
  const [categoryId, setCategoryId] = useState(draft.payload?.category_id ?? '')
  const [listingType, setListingType] = useState(draft.payload?.listing_type ?? 'gold_special')
  const [variations, setVariations]   = useState<Variation[]>(draft.payload?.variations ?? [])
  const [tierName, setTierName]       = useState(draft.payload?.variation_tier_name ?? 'Cor')
  const [varsDirty, setVarsDirty]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [confirm, setConfirm]   = useState(false)
  const [err, setErr]           = useState('')

  const dirty =
    title !== (draft.payload?.title ?? '') ||
    desc !== (draft.payload?.description ?? '') ||
    price !== (draft.payload?.price != null ? String(draft.payload.price) : '') ||
    categoryId !== (draft.payload?.category_id ?? '') ||
    listingType !== (draft.payload?.listing_type ?? 'gold_special') ||
    varsDirty

  const save = async (): Promise<Draft> => {
    const h = await authHeaders()
    const body: Record<string, unknown> = { title, description: desc || null }
    const p = Number(price.replace(',', '.'))
    if (Number.isFinite(p) && p > 0) body.price = Math.round(p * 100) / 100
    if (draft.target_platform === 'tiktok_shop' || draft.target_platform === 'mercadolivre' || draft.target_platform === 'shopee') {
      body.category_id = categoryId.trim() || null
    }
    if (draft.target_platform === 'mercadolivre') body.listing_type = listingType || null
    if (draft.target_platform === 'shopee' && varsDirty) {
      body.variations = variations.length > 0
        ? variations.map(v => ({ product_id: v.product_id, label: v.label }))
        : null
      body.variation_tier_name = tierName.trim() || 'Cor'
    }
    const res = await fetch(`${BACKEND}/multiplier/drafts/${draft.id}`, { method: 'PATCH', headers: h, body: JSON.stringify(body) })
    const out = await res.json()
    if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
    return out as Draft
  }

  const handleSave = async () => {
    setSaving(true); setErr('')
    try { const d = await save(); await onChanged(d, 'Rascunho salvo.') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao salvar.') }
    finally { setSaving(false) }
  }

  const handlePublish = async () => {
    if (!confirm) { setConfirm(true); return }
    setPublishing(true); setErr('')
    try {
      let current = draft
      if (dirty) current = await save()
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/multiplier/drafts/${current.id}/publish`, { method: 'POST', headers: h })
      const out = await res.json()
      if (!res.ok) throw new Error(out?.message ?? `HTTP ${res.status}`)
      const extra = draft.target_platform === 'mercadolivre'
        ? ' O anúncio nasce PAUSADO — revise e ative no painel do ML.'
        : ' O canal pode levar alguns minutos pra aprovar.'
      await onChanged(null, `Anúncio publicado em ${PLATFORM_LABEL[draft.target_platform] ?? draft.target_platform} (${(out as Draft).external_id ?? 'ok'}).${extra}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao publicar.')
      await onChanged(draft)
    } finally { setPublishing(false); setConfirm(false) }
  }

  const handleDiscard = async () => {
    setErr('')
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/multiplier/drafts/${draft.id}/discard`, { method: 'POST', headers: h })
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? `HTTP ${res.status}`)
      await onChanged(null, 'Rascunho descartado.')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao descartar.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <Copy size={15} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-white">
            Revisar multiplicação → {PLATFORM_LABEL[draft.target_platform] ?? draft.target_platform}
            {draft.target_account_id && draft.target_platform === 'shopee' ? ` (loja ${draft.target_account_id})` : ''}
          </h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>

        {err && (
          <div className="mb-3 whitespace-pre-line rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
        )}

        {/* fotos */}
        {draft.payload?.image_urls?.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {draft.payload.image_urls.slice(0, 9).map((u, i) => (
              <img key={i} src={u} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" style={{ border: '1px solid #27272a' }} />
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Field label={`Título (${title.length} chars)`}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </Field>
          <Field label="Descrição">
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={6}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$)">
              <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
            </Field>
            {draft.target_platform === 'tiktok_shop' && (
              <Field label="Categoria TikTok (id)">
                <input value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  placeholder="recomendada automaticamente"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              </Field>
            )}
            {draft.target_platform === 'mercadolivre' && (
              <Field label="Categoria ML (id)">
                <input value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  placeholder="prevista automaticamente"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              </Field>
            )}
            {draft.target_platform === 'shopee' && (
              <Field label="Categoria Shopee (id — opcional)">
                <input value={categoryId} onChange={e => setCategoryId(e.target.value)} inputMode="numeric"
                  placeholder="vazio = recomendada automaticamente"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {draft.target_platform === 'mercadolivre' && (
              <Field label="Tipo de anúncio ML">
                <select value={listingType} onChange={e => setListingType(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                  <option value="gold_special">Clássico (gold_special)</option>
                  <option value="gold_pro">Premium (gold_pro)</option>
                  <option value="free">Grátis (free)</option>
                </select>
              </Field>
            )}
          </div>
          {/* VARIAÇÕES (só Shopee): cada opção = um produto do catálogo */}
          {draft.target_platform === 'shopee' && (
            <div className="rounded-lg p-3" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>
                  Variações (opcional)
                </span>
                {variations.length > 0 && (
                  <input value={tierName} onChange={e => { setTierName(e.target.value); setVarsDirty(true) }}
                    placeholder="Cor" title="Nome da dimensão (ex.: Cor, Tamanho)"
                    className="w-24 rounded px-2 py-1 text-[11px] outline-none"
                    style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
                )}
                <span className="ml-auto text-[10px]" style={{ color: '#52525b' }}>
                  {variations.length > 0 ? `${variations.length} opção(ões) — venda baixa o produto da opção` : 'anúncio simples (sem variação)'}
                </span>
              </div>
              {variations.map(v => (
                <div key={v.product_id} className="mb-1.5 flex items-center gap-2 rounded px-2 py-1.5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-white">{v.name ?? v.product_id}</p>
                    <p className="text-[10px]" style={{ color: '#71717a' }}>SKU {v.sku ?? '—'} · R$ {v.price ?? '—'} · estq {v.stock ?? 0}</p>
                  </div>
                  <input value={v.label}
                    onChange={e => { setVariations(prev => prev.map(x => x.product_id === v.product_id ? { ...x, label: e.target.value } : x)); setVarsDirty(true) }}
                    placeholder="rótulo (ex.: Dourado)"
                    className="w-32 rounded px-2 py-1 text-[11px] outline-none"
                    style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }} />
                  <button onClick={() => { setVariations(prev => prev.filter(x => x.product_id !== v.product_id)); setVarsDirty(true) }}
                    style={{ color: '#71717a' }}><X size={13} /></button>
                </div>
              ))}
              <VariationSearch
                exclude={[...variations.map(v => v.product_id)]}
                onPick={h => {
                  setVariations(prev => [...prev, {
                    product_id: h.id, label: '', price: h.price, sku: h.sku, name: h.name, stock: h.stock,
                  }])
                  setVarsDirty(true)
                }} />
              {variations.length === 1 && (
                <p className="mt-1 text-[10px]" style={{ color: '#fcd34d' }}>
                  ⚠ Adicione pelo menos 2 opções (o produto deste rascunho entra automático como “Principal” se não estiver na lista).
                </p>
              )}
            </div>
          )}

          <p className="text-[11px]" style={{ color: '#52525b' }}>
            Origem: {draft.source_platform ? `${PLATFORM_LABEL[draft.source_platform] ?? draft.source_platform} ${draft.source_listing_id ?? ''}` : 'catálogo'} ·
            SKU {draft.payload?.sku ?? '—'} · estoque inicial {draft.payload?.stock ?? 0} (depois o motor central assume) ·
            {draft.payload?.weight_kg ? ` ${draft.payload.weight_kg} kg` : ' peso —'}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => void handleDiscard()} className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#71717a' }}>
            Descartar
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void handleSave()} disabled={saving || !dirty}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : null} Salvar rascunho
            </button>
            <button onClick={() => void handlePublish()} disabled={publishing}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
              style={confirm
                ? { background: 'rgba(252,211,77,0.15)', border: '1px solid rgba(252,211,77,0.4)', color: '#fcd34d' }
                : { background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
              {publishing ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {publishing ? 'Publicando…' : confirm ? 'Confirmar — cria anúncio REAL' : 'Publicar no canal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Busca de produto pro grupo de variações (usa /composition/search-products). */
function VariationSearch({ exclude, onPick }: {
  exclude: string[]
  onPick: (h: { id: string; name: string | null; sku: string | null; price: number | null; stock: number | null }) => void
}) {
  const [q, setQ]       = useState('')
  const [hits, setHits] = useState<Array<{ id: string; name: string | null; sku: string | null; price: number | null; stock: number | null; is_kit: boolean }>>([])
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const search = async () => {
    if (!q.trim()) { setHits([]); setOpen(false); return }
    setBusy(true)
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/composition/search-products?q=${encodeURIComponent(q.trim())}`, { headers: h })
      if (res.ok) {
        const all = (await res.json()) as Array<{ id: string; name: string | null; sku: string | null; price: number | null; stock: number | null; is_kit: boolean }>
        setHits(all.filter(x => !exclude.includes(x.id)))
        setOpen(true)
      }
    } finally { setBusy(false) }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
        <Search size={12} style={{ color: '#52525b' }} />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && void search()}
          placeholder="Adicionar opção: buscar produto por nome ou SKU…"
          className="w-full bg-transparent text-xs outline-none" style={{ color: '#fafafa' }} />
        <button onClick={() => void search()} className="text-[11px] font-semibold" style={{ color: '#00E5FF' }}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : 'Buscar'}
        </button>
      </div>
      {open && hits.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg" style={{ background: '#111114', border: '1px solid #27272a' }}>
          {hits.map(h => (
            <button key={h.id} onClick={() => { onPick(h); setOpen(false); setQ(''); setHits([]) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white">{h.name}</p>
                <p className="text-[10px]" style={{ color: '#71717a' }}>SKU {h.sku ?? '—'} · estq {h.stock ?? 0}{h.is_kit ? ' · kit' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#52525b' }}>{label}</span>
      {children}
    </label>
  )
}

function TargetChip({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={active
        ? { background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.4)', color: '#00E5FF' }
        : { background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>
      {icon} {label}
    </button>
  )
}

function defaultTarget(t: Targets): TargetSel | null {
  if (t.shopee.length > 0) {
    const s = t.shopee[0]
    return { platform: 'shopee', accountId: String(s.shop_id), label: s.nickname ?? `Shopee ${s.shop_id}` }
  }
  if (t.tiktok_shop.connected) return { platform: 'tiktok_shop', accountId: null, label: 'TikTok Shop' }
  return { platform: 'storefront', accountId: null, label: 'Loja própria' }
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${session?.access_token ?? ''}`,
  }
}
