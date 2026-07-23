'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Puzzle, Plus, RefreshCw, Star, MessageSquareQuote, Pickaxe, Archive,
  ExternalLink, X, Loader2, ChevronRight, AlertTriangle, CheckCircle2, Lightbulb,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ───────────────────────────────────────────────────────────────────

type PainKind   = 'dor' | 'hipotese'
type PainStatus = 'nova' | 'validando' | 'descartada' | 'virou_conceito'

interface Host {
  id:                 string
  anchor_item_id:     string
  title:              string | null
  brand:              string | null
  thumbnail:          string | null
  url:                string | null
  price_cents:        number | null
  category_name:      string | null
  reviews_total:      number
  reviews_fetched:    number
  rating_average:     number | null
  rating_levels:      Record<string, number> | null
  status:             string
  notes:              string | null
  reviews_fetched_at: string | null
  mined_at:           string | null
  pains_count:        number
  dores_count:        number
}

interface PainQuote { review_id: string; rate: number; excerpt: string }

interface Pain {
  id:          string
  kind:        PainKind
  label:       string
  description: string | null
  quote_count: number
  quotes:      PainQuote[]
  confidence:  number | null
  status:      PainStatus
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const txt = await res.text()
    try { throw new Error((JSON.parse(txt) as { message?: string }).message || `HTTP ${res.status}`) }
    catch (e) { throw e instanceof Error && e.message !== txt ? e : new Error(txt || `HTTP ${res.status}`) }
  }
  return res.json() as Promise<T>
}

// ── UI helpers ──────────────────────────────────────────────────────────────

const brl = (cents: number | null) =>
  cents == null || cents === 0 ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const KIND_META: Record<PainKind, { label: string; color: string; bg: string; border: string }> = {
  dor:      { label: 'DOR CONFIRMADA', color: '#f87171', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)' },
  hipotese: { label: 'HIPÓTESE',       color: '#fcd34d', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.30)' },
}

const PAIN_STATUS_META: Record<PainStatus, { label: string; color: string }> = {
  nova:           { label: 'Nova',            color: '#a5f3fc' },
  validando:      { label: 'Validando',       color: '#fcd34d' },
  descartada:     { label: 'Descartada',      color: '#52525b' },
  virou_conceito: { label: 'Virou conceito',  color: '#4ade80' },
}

function Stars({ avg }: { avg: number | null }) {
  if (avg == null) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#fcd34d' }}>
      <Star size={12} fill="#fcd34d" /> {avg.toFixed(1)}
    </span>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Oportunidades3dPage() {
  const [hosts, setHosts]       = useState<Host[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [notice, setNotice]     = useState<string | null>(null)

  // adicionar hospedeiro
  const [showAdd, setShowAdd]   = useState(false)
  const [addUrl, setAddUrl]     = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [adding, setAdding]     = useState(false)

  // painel de dores
  const [selected, setSelected] = useState<Host | null>(null)
  const [pains, setPains]       = useState<Pain[]>([])
  const [painsLoading, setPainsLoading] = useState(false)
  const [busy, setBusy]         = useState<string | null>(null)  // host_id em operação

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setHosts(await api<Host[]>('/opportunities/hosts?status=ativo')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const loadPains = useCallback(async (host: Host) => {
    setPainsLoading(true)
    try { setPains(await api<Pain[]>(`/opportunities/hosts/${host.id}/pains`)) }
    catch { setPains([]) }
    finally { setPainsLoading(false) }
  }, [])

  useEffect(() => { if (selected) void loadPains(selected) }, [selected, loadPains])

  async function addHost() {
    if (!addUrl.trim()) return
    setAdding(true); setError(null)
    try {
      await api('/opportunities/hosts', { method: 'POST', body: JSON.stringify({ url: addUrl.trim(), title: addTitle.trim() || undefined }) })
      setAddUrl(''); setAddTitle(''); setShowAdd(false)
      setNotice('Hospedeiro adotado. Agora clique em "Puxar avaliações".')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao adicionar') }
    finally { setAdding(false) }
  }

  async function fetchReviews(host: Host) {
    setBusy(host.id); setError(null); setNotice(null)
    try {
      const r = await api<{ total: number; fetched: number; pages: number; errors: string[] }>(
        `/opportunities/hosts/${host.id}/fetch-reviews`, { method: 'POST' })
      setNotice(`${r.fetched} avaliações puxadas (${r.pages} páginas · total no anúncio: ${r.total}).${r.errors.length ? ` ${r.errors.length} erro(s).` : ''}`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao puxar avaliações') }
    finally { setBusy(null) }
  }

  async function mine(host: Host) {
    setBusy(host.id); setError(null); setNotice(null)
    try {
      const r = await api<{ reviews_considered: number; pains: number; dores: number; hipoteses: number }>(
        `/opportunities/hosts/${host.id}/mine`, { method: 'POST' })
      setNotice(`IA leu ${r.reviews_considered} avaliações → ${r.dores} dor(es) confirmada(s) + ${r.hipoteses} hipótese(s).`)
      await load()
      const updated = { ...host }
      setSelected(updated)
      await loadPains(updated)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro na mineração') }
    finally { setBusy(null) }
  }

  async function archive(host: Host) {
    setBusy(host.id)
    try {
      await api(`/opportunities/hosts/${host.id}`, { method: 'DELETE' })
      if (selected?.id === host.id) setSelected(null)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao arquivar') }
    finally { setBusy(null) }
  }

  async function setPainStatus(pain: Pain, status: PainStatus) {
    try {
      await api(`/opportunities/pains/${pain.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setPains(ps => ps.map(p => p.id === pain.id ? { ...p, status } : p))
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao atualizar dor') }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)' }}>
            <Puzzle size={20} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#fafafa' }}>Radar de Encaixe</h1>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>
              Acessórios 3D úteis pra produtos de grande venda — dor real extraída das avaliações, com citação literal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="rounded-lg p-2 hover:bg-white/5" style={{ border: '1px solid #1e1e24', color: '#a1a1aa' }} title="Recarregar">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
            <Plus size={15} /> Adotar produto
          </button>
        </div>
      </div>
      <p className="text-xs mb-4" style={{ color: '#52525b' }}>
        Fluxo: adotar anúncio ML → puxar avaliações → minerar dores com IA → (em breve) conceito com placar → Product OS
      </p>

      {/* banners */}
      {error && (
        <div className="rounded-lg p-3 text-sm mb-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {notice && (
        <div className="rounded-lg p-3 text-sm mb-3 flex items-start gap-2" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* form adicionar */}
      {showAdd && (
        <div className="rounded-xl p-4 mb-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="text-sm font-medium mb-2" style={{ color: '#fafafa' }}>Adotar produto hospedeiro</div>
          <p className="text-xs mb-3" style={{ color: '#a1a1aa' }}>
            Cole a URL de um <b>anúncio</b> do Mercado Livre (produto.mercadolivre.com.br/MLB-…) com bastante avaliação.
            As opiniões moram no anúncio — URL de catálogo (/p/MLB…) não serve.
          </p>
          <div className="flex flex-col gap-2">
            <input value={addUrl} onChange={e => setAddUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addHost() }}
              placeholder="https://produto.mercadolivre.com.br/MLB-1234567890-…"
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #1e1e24', color: '#fafafa' }} />
            <div className="flex gap-2">
              <input value={addTitle} onChange={e => setAddTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addHost() }}
                placeholder="Nome do produto (opcional — uso se o ML bloquear a leitura automática)"
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: '#0a0a0e', border: '1px solid #1e1e24', color: '#fafafa' }} />
              <button onClick={() => void addHost()} disabled={adding || !addUrl.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#09090b' }}>
                {adding ? <Loader2 size={15} className="animate-spin" /> : 'Adotar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* lista de hospedeiros */}
        <div className="lg:col-span-2 space-y-3">
          {loading && hosts.length === 0 && (
            <div className="rounded-xl p-8 text-center text-sm" style={{ background: '#111114', border: '1px solid #1e1e24', color: '#52525b' }}>
              <Loader2 size={18} className="animate-spin mx-auto mb-2" /> Carregando…
            </div>
          )}
          {!loading && hosts.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <Puzzle size={24} className="mx-auto mb-2" style={{ color: '#52525b' }} />
              <div className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum hospedeiro ainda.</div>
              <div className="text-xs mt-1" style={{ color: '#52525b' }}>Adote um produto de grande venda pra começar a caçada.</div>
            </div>
          )}
          {hosts.map(h => {
            const isSel = selected?.id === h.id
            const isBusy = busy === h.id
            return (
              <div key={h.id} onClick={() => setSelected(h)}
                className="rounded-xl p-3 cursor-pointer transition-colors"
                style={{ background: isSel ? 'rgba(0,229,255,0.06)' : '#111114', border: `1px solid ${isSel ? 'rgba(0,229,255,0.35)' : '#1e1e24'}` }}>
                <div className="flex gap-3">
                  {h.thumbnail
                    ? <img src={h.thumbnail.replace(/^http:/, 'https:')} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" style={{ background: '#0a0a0e' }} />
                    : <div className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center" style={{ background: '#0a0a0e' }}><Puzzle size={18} style={{ color: '#52525b' }} /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: '#fafafa' }}>{h.title ?? h.anchor_item_id}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: '#a1a1aa' }}>
                      <Stars avg={h.rating_average} />
                      <span>{h.reviews_total.toLocaleString('pt-BR')} aval.</span>
                      <span>{brl(h.price_cents)}</span>
                      {h.url && <a href={h.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="hover:text-cyan-400"><ExternalLink size={12} /></a>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {h.dores_count > 0 && (
                        <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: KIND_META.dor.bg, color: KIND_META.dor.color, border: `1px solid ${KIND_META.dor.border}` }}>
                          {h.dores_count} DOR{h.dores_count > 1 ? 'ES' : ''}
                        </span>
                      )}
                      {h.pains_count - h.dores_count > 0 && (
                        <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: KIND_META.hipotese.bg, color: KIND_META.hipotese.color, border: `1px solid ${KIND_META.hipotese.border}` }}>
                          {h.pains_count - h.dores_count} HIPÓTESE{h.pains_count - h.dores_count > 1 ? 'S' : ''}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: '#52525b' }}>
                        {h.reviews_fetched > 0 ? `${h.reviews_fetched} no cache` : 'sem avaliações no cache'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="shrink-0 self-center" style={{ color: isSel ? '#00E5FF' : '#52525b' }} />
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={e => { e.stopPropagation(); void fetchReviews(h) }} disabled={isBusy}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-white/5"
                    style={{ border: '1px solid #1e1e24', color: '#a5f3fc' }}>
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <MessageSquareQuote size={12} />} Puxar avaliações
                  </button>
                  <button onClick={e => { e.stopPropagation(); void mine(h) }} disabled={isBusy || h.reviews_fetched === 0}
                    title={h.reviews_fetched === 0 ? 'Puxe as avaliações primeiro' : 'Minerar dores com IA'}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-white/5"
                    style={{ border: '1px solid rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Pickaxe size={12} />} Minerar dores
                  </button>
                  <button onClick={e => { e.stopPropagation(); void archive(h) }} disabled={isBusy}
                    className="ml-auto rounded-lg p-1.5 hover:bg-white/5 disabled:opacity-50" title="Arquivar"
                    style={{ border: '1px solid #1e1e24', color: '#52525b' }}>
                    <Archive size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* painel de dores */}
        <div className="lg:col-span-3">
          {!selected && (
            <div className="rounded-xl p-10 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <Lightbulb size={24} className="mx-auto mb-2" style={{ color: '#52525b' }} />
              <div className="text-sm" style={{ color: '#a1a1aa' }}>Selecione um hospedeiro pra ver as dores mineradas.</div>
              <div className="text-xs mt-2 max-w-md mx-auto" style={{ color: '#52525b' }}>
                Dor = queixa com ≥3 citações literais de consumidores reais. Hipótese = apareceu, mas ainda sem volume — não vira conceito sem validação.
              </div>
            </div>
          )}
          {selected && (
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium truncate" style={{ color: '#fafafa' }}>
                  Dores — {selected.title ?? selected.anchor_item_id}
                </div>
                <button onClick={() => setSelected(null)} style={{ color: '#52525b' }}><X size={15} /></button>
              </div>
              {painsLoading && <div className="py-8 text-center"><Loader2 size={18} className="animate-spin mx-auto" style={{ color: '#52525b' }} /></div>}
              {!painsLoading && pains.length === 0 && (
                <div className="py-8 text-center text-sm" style={{ color: '#52525b' }}>
                  Nenhuma dor minerada ainda. Puxe as avaliações e clique em &quot;Minerar dores&quot;.
                </div>
              )}
              <div className="space-y-3">
                {pains.map(p => {
                  const km = KIND_META[p.kind]
                  const sm = PAIN_STATUS_META[p.status]
                  return (
                    <div key={p.id} className="rounded-lg p-3" style={{ background: '#0d0d10', border: `1px solid ${p.kind === 'dor' ? km.border : '#1e1e24'}`, opacity: p.status === 'descartada' ? 0.5 : 1 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: km.bg, color: km.color, border: `1px solid ${km.border}` }}>{km.label}</span>
                        <span className="text-[10px] rounded px-1.5 py-0.5" style={{ border: '1px solid #1e1e24', color: sm.color }}>{sm.label}</span>
                        <span className="text-[10px]" style={{ color: '#52525b' }}>{p.quote_count} citação(ões){p.confidence != null ? ` · confiança ${(p.confidence * 100).toFixed(0)}%` : ''}</span>
                      </div>
                      <div className="text-sm font-medium mt-1.5" style={{ color: '#fafafa' }}>{p.label}</div>
                      {p.description && <div className="text-xs mt-1" style={{ color: '#a1a1aa' }}>{p.description}</div>}
                      {p.quotes.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {p.quotes.slice(0, 6).map((q, i) => (
                            <div key={i} className="text-xs rounded px-2 py-1.5 flex gap-2" style={{ background: '#0a0a0e', border: '1px solid #1e1e24' }}>
                              <span className="shrink-0" style={{ color: '#fcd34d' }}>{q.rate}★</span>
                              <span style={{ color: '#a1a1aa' }}>&ldquo;{q.excerpt}&rdquo;</span>
                            </div>
                          ))}
                          {p.quotes.length > 6 && <div className="text-[10px]" style={{ color: '#52525b' }}>+{p.quotes.length - 6} citações</div>}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2.5">
                        {p.status !== 'validando' && p.status !== 'virou_conceito' && (
                          <button onClick={() => void setPainStatus(p, 'validando')} className="text-[11px] rounded px-2 py-1 hover:bg-white/5" style={{ border: '1px solid #1e1e24', color: '#fcd34d' }}>Validar</button>
                        )}
                        {p.status !== 'descartada' && (
                          <button onClick={() => void setPainStatus(p, 'descartada')} className="text-[11px] rounded px-2 py-1 hover:bg-white/5" style={{ border: '1px solid #1e1e24', color: '#52525b' }}>Descartar</button>
                        )}
                        {p.status === 'descartada' && (
                          <button onClick={() => void setPainStatus(p, 'nova')} className="text-[11px] rounded px-2 py-1 hover:bg-white/5" style={{ border: '1px solid #1e1e24', color: '#a5f3fc' }}>Restaurar</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
