'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { QrCode, Plus, Download, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Link = {
  id: string; channel: string; short_token: string
  order_id: string | null; product_sku: string | null; product_name: string | null
  marketplace: string | null
  qr_code_url: string | null
  scanned_count: number; last_scanned_at: string | null
  converted_at: string | null
  created_at: string
}

const CHANNEL_OPTIONS = [
  { key: 'all',      label: 'Todos' },
  { key: 'rastreio', label: 'Rastreio' },
  { key: 'garantia', label: 'Garantia' },
  { key: 'posvenda', label: 'Pós-venda' },
] as const

const CHANNEL_BADGE: Record<string, { label: string; color: string }> = {
  rastreio: { label: 'Rastreio', color: '#00E5FF' },
  garantia: { label: 'Garantia', color: '#facc15' },
  posvenda: { label: 'Pós-venda', color: '#a78bfa' },
}

function ago(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function LeadBridgeLinksPage() {
  const supabase = useMemo(() => createClient(), [])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'rastreio' | 'garantia' | 'posvenda'>('all')
  const [genOpen, setGenOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  // Single-link form
  const [genChannel, setGenChannel] = useState<'rastreio' | 'garantia' | 'posvenda'>('rastreio')
  const [genOrder, setGenOrder]     = useState('')
  const [genSku,   setGenSku]       = useState('')
  const [genName,  setGenName]      = useState('')
  const [genSaving, setGenSaving]   = useState(false)

  // Bulk form
  const [bulkChannel, setBulkChannel] = useState<'rastreio' | 'garantia' | 'posvenda'>('rastreio')
  const [bulkFrom,    setBulkFrom]    = useState(new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
  const [bulkTo,      setBulkTo]      = useState(new Date().toISOString().slice(0, 10))
  const [bulkSaving,  setBulkSaving]  = useState(false)
  const [bulkResult,  setBulkResult]  = useState<{ generated: number } | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const qs = filter === 'all' ? '' : `?channel=${filter}`
      const res = await fetch(`${BACKEND}/lead-bridge/links${qs}`, { headers })
      if (res.ok) {
        const v = await res.json()
        setLinks(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders, filter])

  useEffect(() => { load() }, [load])

  async function generateOne() {
    setGenSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/lead-bridge/links/generate`, {
        method: 'POST', headers,
        body: JSON.stringify({
          channel: genChannel,
          order_id: genOrder || undefined,
          product_sku: genSku || undefined,
          product_name: genName || undefined,
        }),
      })
      if (res.ok) {
        setGenOpen(false)
        setGenOrder(''); setGenSku(''); setGenName('')
        await load()
      }
    } finally { setGenSaving(false) }
  }

  async function generateBulk() {
    setBulkSaving(true)
    setBulkResult(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/lead-bridge/links/bulk-generate`, {
        method: 'POST', headers,
        body: JSON.stringify({ channel: bulkChannel, from: bulkFrom, to: bulkTo }),
      })
      if (res.ok) {
        const v = await res.json()
        setBulkResult({ generated: v?.generated ?? 0 })
        await load()
      }
    } finally { setBulkSaving(false) }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/lb/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function exportCsv() {
    const head = 'token,channel,order_id,product_sku,product_name,marketplace,scanned_count,converted,created_at\n'
    const rows = links.map(l => [
      l.short_token, l.channel, l.order_id ?? '', l.product_sku ?? '',
      `"${(l.product_name ?? '').replace(/"/g, '""')}"`,
      l.marketplace ?? '', l.scanned_count, l.converted_at ? 'sim' : 'não', l.created_at,
    ].join(',')).join('\n')
    const blob = new Blob([head + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `lead-bridge-links-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Lead Bridge</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2"><QrCode size={18} /> Links</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setGenOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={12} /> Novo link
          </button>
          <button onClick={() => setBulkOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Plus size={12} /> Gerar em lote
          </button>
          <button onClick={exportCsv} disabled={links.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
            <Download size={12} /> CSV
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {CHANNEL_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setFilter(o.key)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: filter === o.key ? '#00E5FF' : 'transparent', color: filter === o.key ? '#000' : '#a1a1aa' }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600" style={{ borderBottom: '1px solid #1a1a1f' }}>
                <th className="px-3 py-2 font-semibold">QR</th>
                <th className="px-3 py-2 font-semibold">Token</th>
                <th className="px-3 py-2 font-semibold">Canal</th>
                <th className="px-3 py-2 font-semibold">Pedido / Produto</th>
                <th className="px-3 py-2 font-semibold text-right">Scans</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold text-right">Criado</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-600">Carregando…</td></tr>
              ) : links.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-600 italic">Nenhum link gerado ainda.</td></tr>
              ) : links.map(l => {
                const meta = CHANNEL_BADGE[l.channel] ?? { label: l.channel, color: '#a1a1aa' }
                const url  = `${BACKEND.replace(/\/$/, '')}/lb/${l.short_token}`
                return (
                  <tr key={l.id} className="hover:bg-[#161618] transition-colors">
                    <td className="px-3 py-2.5">
                      {l.qr_code_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.qr_code_url} alt="" className="w-12 h-12 rounded bg-white p-0.5" />
                      ) : <div className="w-12 h-12 rounded bg-zinc-800" />}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] font-mono text-zinc-300">{l.short_token}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ color: meta.color, background: meta.color + '15' }}>{meta.label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-zinc-300 truncate max-w-[220px]">{l.product_name ?? '—'}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">{l.order_id ?? l.product_sku ?? ''}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-300 tabular-nums">{l.scanned_count}</td>
                    <td className="px-3 py-2.5">
                      {l.converted_at ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">✓ Convertido</span>
                      ) : l.scanned_count > 0 ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Escaneado</span>
                      ) : (
                        <span className="text-[10px] text-zinc-600">Aguardando</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-zinc-500">{ago(l.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyLink(l.short_token)} title="Copiar link"
                          className="p-1.5 rounded hover:bg-[#27272a] text-zinc-500 transition-colors">
                          {copiedToken === l.short_token ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                        <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir landing"
                          className="p-1.5 rounded hover:bg-[#27272a] text-zinc-500 transition-colors">
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single link modal */}
      {genOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setGenOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-white text-base font-semibold">Novo link de captura</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Canal</label>
                <select value={genChannel} onChange={e => setGenChannel(e.target.value as 'rastreio' | 'garantia' | 'posvenda')}
                  className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2">
                  <option value="rastreio">Rastreio</option>
                  <option value="garantia">Garantia</option>
                  <option value="posvenda">Pós-venda</option>
                </select>
              </div>
              <input placeholder="Pedido (opcional)" value={genOrder} onChange={e => setGenOrder(e.target.value)}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
              <input placeholder="SKU (opcional)" value={genSku} onChange={e => setGenSku(e.target.value)}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
              <input placeholder="Nome do produto (opcional)" value={genName} onChange={e => setGenName(e.target.value)}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setGenOpen(false)} className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>Cancelar</button>
              <button onClick={generateOne} disabled={genSaving}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-60"
                style={{ background: '#00E5FF', color: '#000' }}>
                {genSaving ? 'Gerando…' : 'Gerar QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setBulkOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-white text-base font-semibold">Gerar QR codes em lote</h3>
            <p className="text-zinc-500 text-xs">Pega os pedidos do período e gera 1 QR por pedido.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Canal</label>
                <select value={bulkChannel} onChange={e => setBulkChannel(e.target.value as 'rastreio' | 'garantia' | 'posvenda')}
                  className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2">
                  <option value="rastreio">Rastreio</option>
                  <option value="garantia">Garantia</option>
                  <option value="posvenda">Pós-venda</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1">De</label>
                  <input type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)}
                    className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1">Até</label>
                  <input type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)}
                    className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
                </div>
              </div>
              {bulkResult && (
                <div className="px-3 py-2 rounded-lg text-xs text-emerald-400"
                  style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}>
                  ✓ {bulkResult.generated} link(s) gerado(s)
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setBulkOpen(false); setBulkResult(null) }}
                className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>Fechar</button>
              <button onClick={generateBulk} disabled={bulkSaving}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-60"
                style={{ background: '#a78bfa', color: '#000' }}>
                {bulkSaving ? 'Gerando…' : 'Gerar lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
