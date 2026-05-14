'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ToastViewport, todoToast, pushToast } from '@/hooks/useToast'
import AccountSelector from '@/components/ml/AccountSelector'
import { PulsingButton } from '@/components/ui/pulsing-button'
import { CopyButton } from '@/components/ui/copy-button'
import { ProdutosTable } from './_components/ProdutosTable'
import { useConfirm } from '@/components/ui/dialog-provider'
import BulkCostUploadModal from '@/components/catalog/BulkCostUploadModal'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ────────────────────────────────────────────────────────────────────

type WholesaleLevel = { id: string; minQty: string; price: string }

type Product = {
  id: string
  name: string
  sku: string | null
  brand: string | null
  price: number | null
  stock: number | null
  status: 'draft' | 'active' | 'paused'
  platforms: string[]
  photo_urls: string[] | null
  ml_title: string | null
  condition: string | null
  category: string | null
  created_at: string
  wholesale_enabled: boolean | null
  wholesale_levels: WholesaleLevel[] | null
  ml_listing_type: string | null
  ml_free_shipping: boolean | null
  ml_flex: boolean | null
  ml_listing_id: string | null
}

// ── constants ─────────────────────────────────────────────────────────────────

const PM: Record<string, { abbr: string; bg: string; fg: string }> = {
  mercadolivre: { abbr: 'ML', bg: '#FFE600', fg: '#111' },
  shopee:       { abbr: 'SH', bg: '#EE4D2D', fg: '#fff' },
  amazon:       { abbr: 'AZ', bg: '#FF9900', fg: '#111' },
  magalu:       { abbr: 'MG', bg: '#0086FF', fg: '#fff' },
}

const SM = {
  active: { label: 'Ativo',    bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  draft:  { label: 'Rascunho', bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  paused: { label: 'Pausado',  bg: 'rgba(113,113,122,0.15)', color: '#71717a' },
}

function brl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function shortId(id: string) {
  return id.replace(/-/g, '').slice(0, 10).toUpperCase()
}

// ── active filter chip (compartilhado pelos filtros avançados) ────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ background: 'rgba(0,229,255,0.06)', borderColor: 'rgba(0,229,255,0.25)', color: '#67e8f9' }}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors -mr-0.5"
        aria-label={`Remover filtro ${label}`}>
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

// ── bulk action bar ────────────────────────────────────────────────────────────

function BulkBar({
  count, onClear, onPause, onDelete,
}: {
  count: number; onClear: () => void
  onPause: () => void; onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 text-sm"
      style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)' }}>
      <span className="font-semibold" style={{ color: '#00E5FF' }}>{count} selecionado{count !== 1 ? 's' : ''}</span>
      <div className="flex gap-2 ml-2">
        <button onClick={onPause}
          className="px-3 py-1 rounded-lg text-[12px] font-medium border transition-all"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#f59e0b' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa' }}>
          Pausar
        </button>
        <button onClick={onDelete}
          className="px-3 py-1 rounded-lg text-[12px] font-medium border transition-all"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa' }}>
          Excluir
        </button>
      </div>
      <button onClick={onClear} className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── row menu ───────────────────────────────────────────────────────────────────

// ── Floating Tools Panel (right side) ─────────────────────────────────────────

const TOOLS_PANEL_PREFS_KEY = 'eclick.produtos.tools-panel.collapsed'

function ProdutosToolsPanel({ products }: { products: Product[] }) {
  const router = useRouter()
  // Padrão: fechado. Lembra preferência via localStorage (sessão 2026-05-14
  // — antes abria aberto e sobrepunha o header de actions do /produtos).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const raw = localStorage.getItem(TOOLS_PANEL_PREFS_KEY)
      if (raw === 'false') return false
      return true
    } catch { return true }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(TOOLS_PANEL_PREFS_KEY, String(collapsed)) } catch {}
  }, [collapsed])
  const [exporting, setExporting] = useState(false)

  // KPIs reais do servidor (GET /products/kpis) — totais do catálogo inteiro,
  // não filtrados pela paginação atual. Sem Ads = produtos cujo ml_listing_id
  // não está em nenhum ml_ads_campaigns ativo (count exato).
  type Kpis = { active: number; no_stock: number; critical: number; no_ads: number }
  const [kpis, setKpis] = useState<Kpis | null>(null)
  // Cadastro pendente — count separado vindo do completeness-summary
  // (2026-05-14: F2/F3 — campos faltando vs requisitos ML).
  const [pendentes, setPendentes] = useState<number | null>(null)
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const [kpisRes, pendRes] = await Promise.all([
          fetch(`${BACKEND}/products/kpis`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND}/products/completeness-summary?limit=500`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const kpisBody = await kpisRes.json().catch(() => null) as Kpis | null
        const pendBody = await pendRes.json().catch(() => null) as { incomplete_count?: number } | null
        if (kpisBody) setKpis(kpisBody)
        if (pendBody && typeof pendBody.incomplete_count === 'number') setPendentes(pendBody.incomplete_count)
      } catch { /* fallback pra contagem local abaixo */ }
    })()
  }, [products.length]) // refresca quando o catálogo carregado muda

  // Fallback local caso /kpis falhe (offline/network)
  const ativos     = kpis?.active   ?? products.filter(p => p.status === 'active').length
  const semEstoque = kpis?.no_stock ?? products.filter(p => (p.stock ?? 0) === 0).length
  const critico    = kpis?.critical ?? products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length
  const semAds: string | number = kpis?.no_ads ?? '—'

  function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const cols = ['sku','name','status','stock','price','brand','platforms']
      const esc  = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv  = [cols.join(',')]
        .concat(products.map(p => cols.map(c => esc(
          c === 'platforms' ? (p.platforms ?? []).join('|') : (p as unknown as Record<string, unknown>)[c],
        )).join(',')))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `catalogo-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      todoToast(`✓ ${products.length} produtos exportados`)
    } finally {
      setTimeout(() => setExporting(false), 300)
    }
  }

  if (collapsed) {
    // Aba vertical fina estilo "Copilot" — colada na borda direita, texto
    // rotacionado 90° pra ler de cima pra baixo. Não sobrepõe nada (~28px
    // de largura) e fica visível pra abrir quando precisar.
    return (
      <button onClick={() => setCollapsed(false)}
        className="fixed top-1/2 -translate-y-1/2 right-0 z-30 group transition-all hover:right-0.5 hidden lg:flex"
        title="Abrir painel do catálogo">
        <div
          className="flex flex-col items-center justify-center gap-2 py-4 px-1.5 rounded-l-xl"
          style={{
            background: 'linear-gradient(180deg, #1a1a20 0%, #111114 100%)',
            borderTop: '1px solid #27272a',
            borderLeft: '1px solid #27272a',
            borderBottom: '1px solid #27272a',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.35)',
          }}>
          {/* Drag handle / decorativo (3 pontos) */}
          <div className="flex flex-col gap-0.5 opacity-50 group-hover:opacity-80 transition-opacity">
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
            <span className="w-0.5 h-0.5 rounded-full bg-zinc-500" />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 group-hover:text-cyan-400 transition-colors"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Catálogo
          </span>
          {/* Badge pra cadastro pendente se houver — chama atenção */}
          {pendentes != null && pendentes > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>
              {pendentes > 999 ? '999+' : pendentes}
            </span>
          )}
        </div>
      </button>
    )
  }

  return (
    <aside
      className="fixed top-24 right-3 z-30 w-[240px] rounded-2xl overflow-hidden hidden lg:block"
      style={{ background: '#111114', border: '1px solid #1e1e24', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <header className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid #1e1e24' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Catálogo</span>
        <button onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-zinc-800/70 text-zinc-500 hover:text-zinc-300"
          title="Recolher">▶</button>
      </header>
      <div className="px-3 py-2.5 space-y-1.5">
        <KpiRow label="Ativos"          value={ativos.toLocaleString('pt-BR')}      color="#34d399" />
        <KpiRow label="Sem estoque"     value={semEstoque.toLocaleString('pt-BR')}  color="#f87171" />
        <KpiRow label="Estoque crítico" value={critico.toLocaleString('pt-BR')}     color="#facc15" />
        <KpiRow label="Sem Ads"         value={typeof semAds === 'number' ? semAds.toLocaleString('pt-BR') : semAds} color="#a1a1aa" />
        {pendentes != null && pendentes > 0 && (
          <button
            onClick={() => router.push('/dashboard/produtos?quick_filter=cadastro_pendente')}
            className="w-full -mx-3 px-3 py-1.5 flex items-center justify-between text-[11px] transition-colors hover:bg-amber-500/5 group"
            title="Filtrar produtos com cadastro pendente"
            style={{ borderTop: '1px solid #1e1e24' }}>
            <span className="text-zinc-400 group-hover:text-amber-300 transition-colors">Cadastro pendente</span>
            <span className="font-bold text-amber-400">{pendentes.toLocaleString('pt-BR')} →</span>
          </button>
        )}
      </div>
      <div className="px-3 py-2"
        style={{ borderTop: '1px solid #1e1e24' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ferramentas</span>
      </div>
      <div className="px-3 pb-3 space-y-2">
        <PulsingButton
          onClick={exportCsv}
          loading={exporting}
          icon={<span className="text-[11px]">📊</span>}
          label="Exportar catálogo"
          badge={products.length}
          variant="emerald"
          className="w-full justify-center"
        />
        {/* 2026-05-14: atalhos pras features novas (F1-F5) */}
        <Link href="/dashboard/produtos/importar"
          className="block w-full text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-center hover:border-cyan-500/40 hover:text-cyan-400"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          📤 Importar planilha
        </Link>
        <Link href="/dashboard/produtos/operacao-cadastro"
          className="block w-full text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-center hover:border-amber-500/40 hover:text-amber-400"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          📋 Operação cadastro
        </Link>
        <Link href="/dashboard/produtos/ai-bulk"
          className="block w-full text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-center hover:border-cyan-500/40 hover:text-cyan-400"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          🤖 Enriquecer SEO em lote
        </Link>
        <Link href="/dashboard/inteligencia/ml"
          className="block w-full text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors text-center hover:border-purple-500/40 hover:text-purple-400"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          🕵️ Analisar mercado
        </Link>
      </div>
    </aside>
  )
}

function KpiRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  )
}

function RowMenu({ onEdit, onDuplicate, onDelete }: {
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  // placement: 'bottom' = abre pra baixo do botão (default).
  //            'top'    = abre pra cima (quando não há espaço abaixo).
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; placement: 'top' | 'bottom' }>({
    top: 0, right: 0, placement: 'bottom',
  })
  // Visible = open + 1 tick — separamos pra animação CSS funcionar (opacity 0 → 1).
  // Sem isso, o menu aparece direto sem fade in.
  const [visible, setVisible] = useState(false)
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 10)
    function handle(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handle)
    }
  }, [open])

  // Reposiciona em scroll/resize quando aberto — evita menu "voar" do botão
  useEffect(() => {
    if (!open) return
    const reposition = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const spaceAbove = r.top
      const MENU_EST_H = 380 // ~10 items * 36px + paddings
      const flipUp = spaceBelow < MENU_EST_H && spaceAbove > spaceBelow
      setPos(flipUp
        ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right, placement: 'top' }
        : { top: r.bottom + 4,                       right: window.innerWidth - r.right, placement: 'bottom' })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function handleToggle() {
    setOpen(o => !o)
  }

  type Item = { label: string; tone?: 'danger'; onClick: () => void }
  const items: Item[] = [
    { label: 'Editar',                onClick: onEdit },
    { label: 'Editar preço inline',   onClick: () => todoToast('Edição inline de preço') },
    { label: 'Editar custo inline',   onClick: () => todoToast('Edição inline de custo') },
    { label: 'Atualizar estoque',     onClick: () => todoToast('Atualização de estoque') },
    { label: 'Adicionar a campanha Ads', onClick: () => todoToast('Vínculo com campanha Ads') },
    { label: 'Gerar conteúdo com IA', onClick: () => todoToast('IA — título / descrição / fotos / atributos') },
    { label: 'Analisar concorrentes', onClick: () => todoToast('Drawer de concorrentes ML') },
    { label: 'Marcar para repor',     onClick: () => todoToast('Bridge → módulo Compras') },
    { label: 'Duplicar (outro marketplace)', onClick: onDuplicate },
    { label: 'Excluir',               tone: 'danger', onClick: onDelete },
  ]

  return (
    <>
      <button ref={btnRef} onClick={handleToggle}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: '#a1a1aa' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
        onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div ref={menuRef}
          className="fixed z-[9999] w-56 rounded-xl border py-1 shadow-2xl"
          style={{
            background:    '#18181b',
            borderColor:   '#2e2e33',
            top:           pos.top,
            bottom:        pos.bottom,
            right:         pos.right,
            // Animação: fade + escala + leve translate na direção oposta
            // ao placement (vem "de cima" se abrindo pra baixo, e vice-versa).
            opacity:        visible ? 1 : 0,
            transform:      visible
              ? 'scale(1) translateY(0)'
              : pos.placement === 'bottom' ? 'scale(0.95) translateY(-6px)' : 'scale(0.95) translateY(6px)',
            transformOrigin: pos.placement === 'bottom' ? 'top right' : 'bottom right',
            transition:     'opacity 0.14s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            // Box shadow elevado pra destacar do fundo
            boxShadow:      '0 10px 38px -10px rgba(0,0,0,0.6), 0 10px 20px -15px rgba(0,0,0,0.4)',
          }}>
          {items.map((it, i) => {
            const isDanger = it.tone === 'danger'
            const wrappedClick = () => { it.onClick(); setOpen(false) }
            return (
              <div key={it.label}>
                {isDanger && i > 0 && <div className="my-1" style={{ borderTop: '1px solid #2e2e33' }} />}
                <button onClick={wrappedClick}
                  className="w-full text-left px-3 py-2 text-[13px] transition-colors"
                  style={{ color: isDanger ? '#f87171' : '#a1a1aa' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isDanger ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.05)'
                    if (!isDanger) e.currentTarget.style.color = '#fff'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    if (!isDanger) e.currentTarget.style.color = '#a1a1aa'
                  }}>
                  {it.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── table row ─────────────────────────────────────────────────────────────────

function TableRow({
  product, selected, onSelect, onStatusChange, onDelete, onDuplicate, stockInfo,
}: {
  product: Product
  selected: boolean
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: Product['status']) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  stockInfo?: StockSummary
}) {
  const router = useRouter()
  const [hover, setHover] = useState(false)
  const [toggling, setToggling] = useState(false)
  const cover = product.photo_urls?.[0] ?? null
  const status = SM[product.status] ?? SM.draft
  const wLevels = product.wholesale_levels ?? []

  async function toggleStatus() {
    if (product.status === 'draft') return
    const next = product.status === 'active' ? 'paused' : 'active'
    setToggling(true)
    const token = await getAuthToken()
    if (token) {
      await fetch(`${BACKEND}/products/${product.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
    }
    onStatusChange(product.id, next)
    setToggling(false)
  }

  const rowBg = selected
    ? 'rgba(0,229,255,0.05)'
    : hover ? 'rgba(255,255,255,0.02)' : 'transparent'

  // Click na linha vira "editar" — mesma UX da view card. Controles
  // internos (checkbox, botões Ativo/Pausar, RowMenu) param propagação
  // pra não disparar navegação ao serem clicados.
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input, button, [role="menu"], a')) return
    router.push(`/dashboard/produtos/${product.id}/editar`)
  }

  return (
    <tr
      style={{
        background: rowBg,
        transition: 'background 0.15s',
        borderBottom: '1px solid #1e1e24',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleRowClick}
      title="Clique pra editar o produto"
    >
      {/* Checkbox */}
      <td className="pl-4 pr-2 py-3 w-10" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onSelect(product.id)}
          className="w-4 h-4 rounded cursor-pointer accent-[#00E5FF]" />
      </td>

      {/* Anúncio */}
      <td className="px-3 py-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Thumbnail */}
          <div className="rounded-xl shrink-0 overflow-hidden"
            style={{ width: 72, height: 72, background: '#1c1c1f', border: '1px solid #2e2e33' }}>
            {cover
              ? <img
                  src={cover}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-200"
                  style={{ display: 'block' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.07)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              : <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
            }
          </div>
          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1 max-w-[280px]">
              <p className="text-white text-[13px] font-medium leading-tight truncate flex-1">
                {product.name}
              </p>
              <CopyButton value={product.name} size={10} />
            </div>
            <p className="text-zinc-600 text-[11px] mt-0.5 font-mono">
              ID: {shortId(product.id)}
            </p>
            {product.sku && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-zinc-600">SKU: {product.sku}</span>
                <CopyButton value={product.sku} size={10} />
              </div>
            )}
            {product.ml_listing_id && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full mt-1"
                style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                🔗 ML Vinculado
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <p className="text-zinc-500 text-[11px]">
                Estoque: <span className={product.stock === 0 ? 'text-red-400' : 'text-zinc-400'}>
                  {stockInfo && stockInfo.virtual_quantity > 0
                    ? `${(product.stock ?? 0).toLocaleString('pt-BR')} + ${stockInfo.virtual_quantity.toLocaleString('pt-BR')} = ${((product.stock ?? 0) + stockInfo.virtual_quantity).toLocaleString('pt-BR')}`
                    : `${product.stock ?? 0}`} u.
                </span>
              </p>
              {stockInfo?.auto_pause_enabled && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  ⏸ Auto-pausa
                </span>
              )}
              {stockInfo?.auto_pause_enabled &&
               (product.stock ?? 0) + (stockInfo.virtual_quantity ?? 0) <= (stockInfo.min_stock_to_pause ?? 0) && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                  ⚠ Pausar agora
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Preço */}
      <td className="px-3 py-3 w-40">
        <p className="text-white font-bold text-[15px] leading-tight">{brl(product.price)}</p>
        {product.wholesale_enabled && wLevels.length > 0 && (
          <>
            <p className="text-zinc-500 text-[11px] mt-0.5">
              em atacado a{' '}
              <span style={{ color: '#34d399' }}>
                R$ {wLevels[0].price}
              </span>
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: '#a1a1aa' }}>
              Com {wLevels.length} preço{wLevels.length !== 1 ? 's' : ''} de atacado
            </p>
          </>
        )}
      </td>

      {/* Plataformas */}
      <td className="px-3 py-3 w-52">
        {/* Platform badges */}
        <div className="flex gap-1 mb-1.5">
          {(product.platforms ?? []).map(p => {
            const m = PM[p]; if (!m) return null
            return (
              <span key={p} className="text-[9px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={{ background: m.bg, color: m.fg }}>{m.abbr}</span>
            )
          })}
        </div>
        {/* Listing type */}
        {product.ml_listing_type && (
          <p className="text-[11px]" style={{ color: product.ml_listing_type === 'premium' ? '#a78bfa' : '#71717a' }}>
            {product.ml_listing_type === 'premium' ? '★ Premium' : 'Clássico'} · {product.ml_listing_type === 'premium' ? '16%' : '11%'}
          </p>
        )}
        {/* Shipping */}
        <div className="flex flex-wrap gap-x-2 mt-1">
          {product.ml_free_shipping && (
            <span className="text-[10px]" style={{ color: '#34d399' }}>Frete grátis</span>
          )}
          {!product.ml_free_shipping && (
            <span className="text-[10px] text-zinc-600">Frete por conta do comprador</span>
          )}
          {product.ml_flex && (
            <span className="text-[10px]" style={{ color: '#00E5FF' }}>Envios Flex</span>
          )}
        </div>
      </td>

      {/* Métricas */}
      <td className="px-3 py-3 w-36">
        <div className="space-y-1">
          {[
            { label: 'Visitas 7d', value: '—' },
            { label: 'Vendas 7d', value: '—' },
            { label: 'Conversão', value: '—' },
          ].map(m => (
            <div key={m.label} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">{m.label}</span>
              <span className="text-[11px] font-medium text-zinc-500">{m.value}</span>
            </div>
          ))}
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3 w-36">
        <div className="flex flex-col items-start gap-2">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
          {product.status !== 'draft' && (
            <button onClick={toggleStatus} disabled={toggling}
              className="text-[11px] font-medium px-2 py-0.5 rounded-md border transition-all disabled:opacity-50"
              style={{
                borderColor: product.status === 'active' ? '#3f3f46' : 'rgba(52,211,153,0.4)',
                color: product.status === 'active' ? '#71717a' : '#34d399',
                background: 'transparent',
              }}>
              {toggling ? '…' : product.status === 'active' ? 'Pausar' : 'Ativar'}
            </button>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="pr-4 py-3 w-12">
        <RowMenu
          onEdit={() => router.push(`/dashboard/produtos/${product.id}/editar`)}
          onDuplicate={() => onDuplicate(product.id)}
          onDelete={() => onDelete(product.id)}
        />
      </td>
    </tr>
  )
}

// ── table skeleton ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
          <td className="pl-4 pr-2 py-3 w-10">
            <div className="w-4 h-4 rounded" style={{ background: '#1e1e24' }} />
          </td>
          <td className="px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl shrink-0" style={{ width: 72, height: 72, background: '#1e1e24' }} />
              <div className="space-y-2 flex-1">
                <div className="h-3 rounded w-3/4" style={{ background: '#1e1e24' }} />
                <div className="h-2.5 rounded w-1/3" style={{ background: '#1e1e24' }} />
              </div>
            </div>
          </td>
          {[...Array(5)].map((_, j) => (
            <td key={j} className="px-3 py-3">
              <div className="h-3 rounded w-2/3" style={{ background: '#1e1e24' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── card (grid view) ───────────────────────────────────────────────────────────

function ProductCard({ product, onDelete, onStatusChange, onDuplicate }: {
  product: Product
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: Product['status']) => void
  onDuplicate: (id: string) => void
}) {
  const router = useRouter()
  const [toggling, setToggling] = useState(false)
  const cover = product.photo_urls?.[0] ?? null
  const status = SM[product.status] ?? SM.draft

  async function toggleStatus() {
    if (product.status === 'draft') return
    const next = product.status === 'active' ? 'paused' : 'active'
    setToggling(true)
    const token = await getAuthToken()
    if (token) {
      await fetch(`${BACKEND}/products/${product.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
    }
    onStatusChange(product.id, next)
    setToggling(false)
  }

  return (
    <div className="rounded-2xl border overflow-hidden flex flex-col transition-all group"
      style={{ background: '#111114', borderColor: '#1e1e24' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e24')}>
      <div className="relative h-44 shrink-0 overflow-hidden" style={{ background: '#1c1c1f' }}>
        {cover
          ? <img src={cover} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          : <div className="w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
        }
        <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.color }}>{status.label}</span>
        <div className="absolute top-3 right-3 flex gap-1">
          {(product.platforms ?? []).map(p => {
            const m = PM[p]; if (!m) return null
            return <span key={p} className="text-[9px] font-black w-5 h-5 rounded-md flex items-center justify-center" style={{ background: m.bg, color: m.fg }}>{m.abbr}</span>
          })}
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2">
        <div className="flex items-start gap-1">
          <p className="text-white text-sm font-semibold leading-tight line-clamp-2 flex-1">{product.name}</p>
          <CopyButton value={product.name} size={11} />
        </div>
        {product.sku && (
          <div className="flex items-center gap-1">
            <p className="text-zinc-600 text-[11px] font-mono">SKU: {product.sku}</p>
            <CopyButton value={product.sku} size={10} />
          </div>
        )}
        {product.ml_listing_id && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
            🔗 ML Vinculado
          </span>
        )}
        <div className="flex items-end justify-between mt-auto">
          <div>
            <p className="font-bold text-base leading-tight" style={{ color: '#00E5FF' }}>{brl(product.price)}</p>
            <p className="text-zinc-600 text-[11px] mt-0.5">{product.stock ?? 0} em estoque</p>
          </div>
          {product.brand && <span className="text-[11px] text-zinc-500 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>{product.brand}</span>}
        </div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => router.push(`/dashboard/produtos/${product.id}/editar`)}
          className="flex-1 py-2 rounded-lg text-[12px] font-medium border transition-all"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00E5FF'; e.currentTarget.style.color = '#00E5FF' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa' }}>
          Editar
        </button>
        {product.status !== 'draft' && (
          <button onClick={toggleStatus} disabled={toggling}
            className="px-3 py-2 rounded-lg text-[12px] font-medium border transition-all"
            style={{ borderColor: '#3f3f46', color: '#71717a' }}>
            {toggling ? '…' : product.status === 'active' ? 'Pausar' : 'Ativar'}
          </button>
        )}
        <RowMenu
          onEdit={() => router.push(`/dashboard/produtos/${product.id}/editar`)}
          onDuplicate={() => onDuplicate(product.id)}
          onDelete={() => onDelete(product.id)}
        />
      </div>
    </div>
  )
}

// ── ML Import Modal ───────────────────────────────────────────────────────────

type MlItem = {
  id: string
  title: string
  price: number
  available_quantity: number
  thumbnail: string
  status: string
  sold_quantity: number
}

function MlImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [items, setItems] = useState<MlItem[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<Set<string>>(new Set())
  const [imported, setImported] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const token = await getAuthToken()
      if (!token) { setError('Sessão expirada.'); setLoading(false); return }
      const res = await fetch(`${BACKEND}/ml/items?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setError('Falha ao carregar anúncios do ML.'); setLoading(false); return }
      const { items: data } = await res.json()
      setItems(data ?? [])
      setLoading(false)
    })()
  }, [])

  async function handleImport(mlItemId: string) {
    setImporting(prev => new Set(prev).add(mlItemId))
    const token = await getAuthToken()
    if (!token) return
    const res = await fetch(`${BACKEND}/ml/items/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ml_item_id: mlItemId }),
    })
    setImporting(prev => { const n = new Set(prev); n.delete(mlItemId); return n })
    if (res.ok) {
      setImported(prev => new Set(prev).add(mlItemId))
      onImported()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: '#ffe600', color: '#333' }}>ML</div>
            <div>
              <p className="text-white text-sm font-semibold">Importar do Mercado Livre</p>
              <p className="text-zinc-500 text-xs">Selecione os anúncios para importar ao catálogo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <svg className="w-7 h-7 animate-spin" style={{ color: '#00E5FF' }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {error && (
            <div className="mx-6 my-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {error}
              {error.includes('conectar') || error.includes('ML') ? (
                <Link href="/dashboard/integracoes" className="ml-2 underline" onClick={onClose}>Conectar conta</Link>
              ) : null}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-zinc-400 text-sm">Nenhum anúncio encontrado na sua conta ML.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
              {items.map(item => {
                const done = imported.has(item.id)
                const busy = importing.has(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <img src={item.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0"
                      style={{ background: '#1c1c1f', border: '1px solid #2e2e33' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] font-bold" style={{ color: '#00E5FF' }}>
                          {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[11px] text-zinc-500">{item.available_quantity} em estoque</span>
                        <span className="text-[11px] text-zinc-600">{item.sold_quantity} vendidos</span>
                      </div>
                    </div>
                    <button
                      onClick={() => !done && !busy && handleImport(item.id)}
                      disabled={done || busy}
                      className="shrink-0 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:cursor-default"
                      style={done
                        ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                        : busy
                          ? { background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }
                          : { background: '#00E5FF', color: '#000' }
                      }>
                      {done ? '✓ Importado' : busy ? 'Importando…' : 'Importar'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type StockSummary = {
  quantity:          number
  virtual_quantity:  number
  min_stock_to_pause: number
  auto_pause_enabled: boolean
}

// Meta agregada por produto — populada em paralelo via Supabase pra alimentar
// os filtros de saneamento (sem concorrentes / sem vínculo / sem custo / etc).
type ProductMeta = {
  competitorsCount: number
  listingsCount:    number
  distinctPlatforms: string[]
  costPrice:        number | null
}

export default function ProdutosPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState('all')
  const [view, setView]             = useState<'list' | 'grid' | 'table'>('list')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [orgId, setOrgId]           = useState<string | null>(null)
  const [showMlImport, setShowMlImport] = useState(false)
  const [showBulkCost, setShowBulkCost] = useState(false)
  const [mlConnected, setMlConnected]   = useState(false)
  const [stockMap, setStockMap]         = useState<Record<string, StockSummary>>({})
  // Filtros avançados (toggle do painel + 5+3 critérios)
  const [advOpen, setAdvOpen]       = useState(false)
  const [filterStock, setFilterStock] = useState<'all' | 'zero' | 'critical' | 'normal'>('all')
  const [filterPlatforms, setFilterPlatforms] = useState<Set<string>>(new Set())
  const [filterPriceMin, setFilterPriceMin]   = useState<string>('')
  const [filterPriceMax, setFilterPriceMax]   = useState<string>('')
  const [filterFlags, setFilterFlags] = useState({
    noCompetitors: false,  // sem competidores monitorados
    noListings:    false,  // sem listing em nenhum marketplace
    noCost:        false,  // cost_price null/0
    noPhoto:       false,  // photo_urls vazio
    singlePlatform: false, // anunciado em apenas 1 plataforma (oportunidade de expandir)
  })
  const [productMeta, setProductMeta] = useState<Record<string, ProductMeta>>({})
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await getAuthToken()
      if (!token) { setError('Não autenticado'); setLoading(false); return }
      const res = await fetch(`${BACKEND}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch product_stock for virtual qty badges
  useEffect(() => {
    if (products.length === 0) return
    const sb = createClient()
    sb.from('product_stock')
      .select('product_id, quantity, virtual_quantity, min_stock_to_pause, auto_pause_enabled')
      .is('platform', null)
      .then(({ data }) => {
        const map: Record<string, StockSummary> = {}
        for (const row of (data ?? [])) {
          map[row.product_id] = {
            quantity:          row.quantity           ?? 0,
            virtual_quantity:  row.virtual_quantity   ?? 0,
            min_stock_to_pause: row.min_stock_to_pause ?? 0,
            auto_pause_enabled: row.auto_pause_enabled ?? false,
          }
        }
        setStockMap(map)
      })
  }, [products])

  useEffect(() => { load() }, [load])

  // Fetch supplementary data pros filtros avançados — competitors, listings,
  // cost_price. Tudo via Supabase direto (RLS em cima de organization_id).
  // Roda 1x quando products carrega (não muda durante a sessão).
  useEffect(() => {
    if (products.length === 0) return
    const sb = createClient()
    const ids = products.map(p => p.id)
    ;(async () => {
      const [compsRes, listingsRes, costsRes] = await Promise.all([
        sb.from('competitors').select('product_id').in('product_id', ids),
        sb.from('product_listings').select('product_id, platform').in('product_id', ids).eq('is_active', true),
        sb.from('products').select('id, cost_price').in('id', ids),
      ])
      const compsCount: Record<string, number> = {}
      for (const r of (compsRes.data ?? []) as Array<{ product_id: string }>) {
        compsCount[r.product_id] = (compsCount[r.product_id] ?? 0) + 1
      }
      const platsByProduct: Record<string, Set<string>> = {}
      for (const r of (listingsRes.data ?? []) as Array<{ product_id: string; platform: string | null }>) {
        if (!platsByProduct[r.product_id]) platsByProduct[r.product_id] = new Set()
        if (r.platform) platsByProduct[r.product_id].add(r.platform)
      }
      const costMap: Record<string, number | null> = {}
      for (const r of (costsRes.data ?? []) as Array<{ id: string; cost_price: number | null }>) {
        costMap[r.id] = r.cost_price
      }
      const meta: Record<string, ProductMeta> = {}
      for (const p of products) {
        const plats = platsByProduct[p.id] ?? new Set<string>()
        meta[p.id] = {
          competitorsCount:  compsCount[p.id] ?? 0,
          listingsCount:     plats.size,
          distinctPlatforms: [...plats],
          costPrice:         costMap[p.id] ?? null,
        }
      }
      setProductMeta(meta)
    })()
  }, [products])

  // Check ML connection
  useEffect(() => {
    ;(async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch(`${BACKEND}/ml/status`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setMlConnected(!!data)
      }
    })()
  }, [])

  // ── handlers ────────────────────────────────────────────────────────────────

  function handleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelectAll(ids: string[]) {
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids))
  }

  function handleStatusChange(id: string, status: Product['status']) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  /** Page-level toggle pause/active — usado pela <ProdutosTable> (DataTable
   * view). Mesma lógica do toggleStatus interno do TableRow/ProductCard
   * (PUT /products/{id} { status }), mas extraído pra fora pra ser
   * compartilhável. Optimistic UI com rollback em erro. */
  const togglePauseActive = useCallback(async (id: string, next: 'active' | 'paused') => {
    const token = await getAuthToken()
    if (!token) return
    const prev = products.find(p => p.id === id)?.status
    setProducts(ps => ps.map(p => p.id === id ? { ...p, status: next } : p))
    try {
      const res = await fetch(`${BACKEND}/products/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      pushToast({ tone: 'success', message: `✓ Anúncio ${next === 'paused' ? 'pausado' : 'ativado'}` })
    } catch {
      if (prev) setProducts(ps => ps.map(p => p.id === id ? { ...p, status: prev } : p))
      pushToast({ tone: 'error', message: `Falha ao ${next === 'paused' ? 'pausar' : 'ativar'} anúncio` })
    }
  }, [products])

  async function handleDelete(id: string) {
    const token = await getAuthToken()
    if (!token) return
    await fetch(`${BACKEND}/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setProducts(prev => prev.filter(p => p.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  async function handleDuplicate(id: string) {
    const source = products.find(p => p.id === id)
    if (!source || !orgId) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, created_at: _ca, ...rest } = source as Product & { [key: string]: unknown }
    const { data } = await supabase
      .from('products')
      .insert({ ...rest, name: `${source.name} (cópia)`, status: 'draft', organization_id: orgId })
      .select()
      .single()
    if (data) setProducts(prev => [data as Product, ...prev])
  }

  /** Pausa N produtos. Aceita ids explícito (DataTable bulk actions);
   * o BulkBar antigo passa [...selected]. Mesma lógica em ambos. */
  async function bulkPause(ids: string[]) {
    if (ids.length === 0) return
    const supabase = createClient()
    await supabase.from('products').update({ status: 'paused' }).in('id', ids)
    setProducts(prev => prev.map(p => ids.includes(p.id) ? { ...p, status: 'paused' } : p))
    setSelected(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n })
    pushToast({ tone: 'success', message: `✓ ${ids.length} produto${ids.length === 1 ? '' : 's'} pausado${ids.length === 1 ? '' : 's'}` })
  }

  async function bulkDelete(ids: string[]) {
    if (ids.length === 0) return
    const token = await getAuthToken()
    if (!token) return
    const ok = await confirm({
      title:        'Excluir produtos',
      message:      `Excluir ${ids.length} produto${ids.length === 1 ? '' : 's'}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      variant:      'danger',
    })
    if (!ok) return
    await fetch(`${BACKEND}/products/bulk-delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setProducts(prev => prev.filter(p => !ids.includes(p.id)))
    setSelected(prev => { const n = new Set(prev); ids.forEach(i => n.delete(i)); return n })
    pushToast({ tone: 'success', message: `${ids.length} produto${ids.length === 1 ? '' : 's'} excluído${ids.length === 1 ? '' : 's'}` })
  }

  // ── filter ───────────────────────────────────────────────────────────────────

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q)
    if (!matchSearch) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false

    // Estoque tier (usa stockMap quando disponível, senão p.stock)
    if (filterStock !== 'all') {
      const sm = stockMap[p.id]
      const stock = sm ? (sm.virtual_quantity || sm.quantity) : (p.stock ?? 0)
      if (filterStock === 'zero'     && stock !== 0) return false
      if (filterStock === 'critical' && (stock <= 0 || stock > 5)) return false
      if (filterStock === 'normal'   && stock <= 5) return false
    }

    // Plataformas — multi-select (qualquer match passa)
    if (filterPlatforms.size > 0) {
      const plats = p.platforms ?? []
      if (!plats.some(plat => filterPlatforms.has(plat))) return false
    }

    // Preço range
    const priceMin = filterPriceMin ? Number(filterPriceMin) : null
    const priceMax = filterPriceMax ? Number(filterPriceMax) : null
    if (priceMin != null && (p.price ?? 0) < priceMin) return false
    if (priceMax != null && (p.price ?? Infinity) > priceMax) return false

    // Flags de saneamento — só aplicam quando productMeta carregou
    const meta = productMeta[p.id]
    if (filterFlags.noCompetitors && meta && meta.competitorsCount > 0) return false
    if (filterFlags.noListings    && meta && meta.listingsCount > 0)    return false
    if (filterFlags.noCost        && meta && (meta.costPrice ?? 0) > 0) return false
    if (filterFlags.noPhoto       && p.photo_urls && p.photo_urls.length > 0) return false
    if (filterFlags.singlePlatform && meta && meta.distinctPlatforms.length !== 1) return false

    return true
  })

  // Contadores pra mostrar ao lado de cada chip de filtro (quantos passariam SE
  // só esse filtro estivesse ativo). Calculados apenas em produtos que já
  // passaram pelos filtros básicos (search + status), pra serem coerentes.
  const baseFiltered = products.filter(p => {
    const q = search.toLowerCase()
    const ms = !q || p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q)
    return ms && (filterStatus === 'all' || p.status === filterStatus)
  })
  const counts = {
    noCompetitors:  baseFiltered.filter(p => (productMeta[p.id]?.competitorsCount ?? 0) === 0).length,
    noListings:     baseFiltered.filter(p => (productMeta[p.id]?.listingsCount ?? 0) === 0).length,
    noCost:         baseFiltered.filter(p => (productMeta[p.id]?.costPrice ?? 0) === 0).length,
    noPhoto:        baseFiltered.filter(p => !p.photo_urls || p.photo_urls.length === 0).length,
    singlePlatform: baseFiltered.filter(p => (productMeta[p.id]?.distinctPlatforms.length ?? 0) === 1).length,
  }

  // Lista total de plataformas disponíveis (das que aparecem em pelo menos 1 produto)
  const availablePlatforms = [...new Set(products.flatMap(p => p.platforms ?? []))].sort()

  // Conta total de filtros avançados ativos pra badge no toggle
  const advCount =
    (filterStock !== 'all' ? 1 : 0) +
    (filterPlatforms.size > 0 ? 1 : 0) +
    (filterPriceMin || filterPriceMax ? 1 : 0) +
    Object.values(filterFlags).filter(Boolean).length

  function clearAdv() {
    setFilterStock('all')
    setFilterPlatforms(new Set())
    setFilterPriceMin('')
    setFilterPriceMax('')
    setFilterFlags({ noCompetitors: false, noListings: false, noCost: false, noPhoto: false, singlePlatform: false })
  }

  const allFilteredIds = filtered.map(p => p.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 min-h-full" style={{ background: 'var(--background)' }}>
      <ToastViewport />
      <ProdutosToolsPanel products={products} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-lg font-semibold">Produtos</h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            {loading ? 'Carregando…' : `${products.length} produto${products.length !== 1 ? 's' : ''} no catálogo`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <AccountSelector compact hideWhenEmpty />
          {mlConnected && (
            <button onClick={() => setShowMlImport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all active:scale-[0.98]"
              style={{ borderColor: '#ffe600', color: '#ffe600', background: 'rgba(255,230,0,0.06)' }}>
              <span className="text-[8px] font-black w-3 h-3 rounded-sm flex items-center justify-center leading-none" style={{ background: '#ffe600', color: '#333' }}>ML</span>
              Importar do ML
            </button>
          )}
          <button
            onClick={() => setShowBulkCost(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all active:scale-[0.98]"
            style={{ borderColor: 'rgba(34,197,94,0.4)', color: '#4ADE80', background: 'rgba(34,197,94,0.06)' }}
            title="Importar planilha XLSX/CSV pra atualizar custos e impostos em massa"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6h13M9 11V5h13M3 5h3M3 11h3M3 17h3" />
            </svg>
            Atualizar Custos
          </button>
          <Link href="/dashboard/produtos/importar"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all hover:border-cyan-500/50 hover:text-cyan-400"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
            title="Subir planilha CSV/XLSX">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar planilha
          </Link>
          <Link href="/dashboard/produtos/operacao-cadastro"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all hover:border-amber-500/50 hover:text-amber-400"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
            title="Cadastros pendentes + despacho pro operador">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Operação cadastro
          </Link>
          <Link href="/dashboard/produtos/novo"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all active:scale-[0.98]"
            style={{ background: '#00E5FF', color: '#000' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Produto
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Buscar nome, SKU, marca…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none transition-all focus:border-[#00E5FF]"
            style={{ background: '#111114' }} />
        </div>

        {/* Status filters */}
        <div className="flex gap-1.5">
          {(['all', 'active', 'draft', 'paused'] as const).map(s => {
            const labels = { all: 'Todos', active: 'Ativos', draft: 'Rascunhos', paused: 'Pausados' }
            const active = filterStatus === s
            const count = s === 'all' ? products.length : products.filter(p => p.status === s).length
            return (
              <button key={s} onClick={() => setFilter(s)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all flex items-center gap-1.5"
                style={{
                  background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                  borderColor: active ? '#00E5FF' : '#3f3f46',
                  color: active ? '#00E5FF' : '#71717a',
                }}>
                {labels[s]}
                {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Toggle filtros avançados */}
        <button onClick={() => setAdvOpen(v => !v)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all flex items-center gap-1.5"
          style={{
            background: advCount > 0 ? 'rgba(0,229,255,0.08)' : 'transparent',
            borderColor: advCount > 0 || advOpen ? '#00E5FF' : '#3f3f46',
            color: advCount > 0 || advOpen ? '#00E5FF' : '#71717a',
          }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros
          {advCount > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: '#00E5FF', color: '#000' }}>{advCount}</span>}
        </button>

        {/* View toggle */}
        <div className="flex gap-1 ml-auto p-1 rounded-lg" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          {([
            { v: 'list',  path: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
            { v: 'grid',  path: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
            // BETA — DataTable view (Sprint A bloco 1, read-only)
            { v: 'table', path: 'M3 5h18M3 10h18M3 15h18M5 5v14M19 5v14' },
          ] as const).map(({ v, path }) => (
            <button key={v} onClick={() => setView(v)}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
              style={{
                background: view === v ? 'rgba(0,229,255,0.1)' : 'transparent',
                color: view === v ? '#00E5FF' : '#52525b',
              }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={path} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Painel de filtros avançados — colapsável */}
      {advOpen && (
        <div className="mb-4 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          style={{ background: '#0c0c0f', border: '1px solid #1e1e24' }}>
          {/* Estoque */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Estoque</p>
            <div className="flex flex-wrap gap-1">
              {([
                { v: 'all',      label: 'Todos' },
                { v: 'zero',     label: 'Zerado' },
                { v: 'critical', label: 'Crítico (≤5)' },
                { v: 'normal',   label: 'Normal (>5)' },
              ] as const).map(o => (
                <button key={o.v} onClick={() => setFilterStock(o.v)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                  style={{
                    background: filterStock === o.v ? 'rgba(0,229,255,0.08)' : 'transparent',
                    borderColor: filterStock === o.v ? '#00E5FF' : '#27272a',
                    color: filterStock === o.v ? '#00E5FF' : '#a1a1aa',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plataformas */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Plataformas</p>
            <div className="flex flex-wrap gap-1">
              {availablePlatforms.length === 0 ? (
                <span className="text-[11px] text-zinc-600">Nenhuma vinculada</span>
              ) : availablePlatforms.map(plat => {
                const meta = PM[plat]
                const active = filterPlatforms.has(plat)
                return (
                  <button key={plat}
                    onClick={() => setFilterPlatforms(prev => {
                      const next = new Set(prev)
                      next.has(plat) ? next.delete(plat) : next.add(plat)
                      return next
                    })}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: active ? `${meta?.bg ?? '#27272a'}24` : 'transparent',
                      borderColor: active ? (meta?.bg ?? '#00E5FF') : '#27272a',
                      color: active ? (meta?.bg ?? '#00E5FF') : '#a1a1aa',
                    }}>
                    {meta?.abbr ?? plat.slice(0, 2).toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Preço range */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Preço (R$)</p>
            <div className="flex items-center gap-1.5">
              <input type="number" min="0" placeholder="Min"
                value={filterPriceMin}
                onChange={e => setFilterPriceMin(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-[11px] text-white placeholder-zinc-600 border outline-none focus:border-[#00E5FF]"
                style={{ background: '#070709', borderColor: '#27272a' }} />
              <span className="text-zinc-600 text-[11px]">—</span>
              <input type="number" min="0" placeholder="Máx"
                value={filterPriceMax}
                onChange={e => setFilterPriceMax(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-[11px] text-white placeholder-zinc-600 border outline-none focus:border-[#00E5FF]"
                style={{ background: '#070709', borderColor: '#27272a' }} />
            </div>
          </div>

          {/* Saneamento de dados */}
          <div className="md:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Saneamento</p>
            <div className="flex flex-col gap-1">
              {([
                { k: 'noCompetitors',  label: 'Sem concorrentes',          count: counts.noCompetitors },
                { k: 'noListings',     label: 'Sem vínculo (marketplace)', count: counts.noListings },
                { k: 'noCost',         label: 'Sem custo cadastrado',      count: counts.noCost },
                { k: 'noPhoto',        label: 'Sem foto',                  count: counts.noPhoto },
                { k: 'singlePlatform', label: 'Em 1 só plataforma',        count: counts.singlePlatform },
              ] as const).map(o => {
                const active = filterFlags[o.k]
                return (
                  <button key={o.k}
                    onClick={() => setFilterFlags(prev => ({ ...prev, [o.k]: !prev[o.k] }))}
                    className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
                      borderColor: active ? '#f59e0b' : '#27272a',
                      color: active ? '#f59e0b' : '#a1a1aa',
                    }}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded border flex items-center justify-center"
                        style={{ borderColor: active ? '#f59e0b' : '#3f3f46', background: active ? '#f59e0b' : 'transparent' }}>
                        {active && <svg className="w-2 h-2" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {o.label}
                    </span>
                    <span className="text-[10px] opacity-70">{o.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active filters chip bar — só renderiza quando há algo */}
      {advCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500 font-medium">Ativos:</span>
          {filterStock !== 'all' && (
            <ActiveChip label={`Estoque: ${({ zero: 'Zerado', critical: 'Crítico', normal: 'Normal' } as const)[filterStock]}`} onRemove={() => setFilterStock('all')} />
          )}
          {[...filterPlatforms].map(plat => (
            <ActiveChip key={plat} label={PM[plat]?.abbr ?? plat} onRemove={() => setFilterPlatforms(prev => { const n = new Set(prev); n.delete(plat); return n })} />
          ))}
          {(filterPriceMin || filterPriceMax) && (
            <ActiveChip label={`R$ ${filterPriceMin || '0'} — ${filterPriceMax || '∞'}`} onRemove={() => { setFilterPriceMin(''); setFilterPriceMax('') }} />
          )}
          {filterFlags.noCompetitors  && <ActiveChip label="Sem concorrentes"  onRemove={() => setFilterFlags(p => ({ ...p, noCompetitors: false }))} />}
          {filterFlags.noListings     && <ActiveChip label="Sem vínculo"        onRemove={() => setFilterFlags(p => ({ ...p, noListings: false }))} />}
          {filterFlags.noCost         && <ActiveChip label="Sem custo"          onRemove={() => setFilterFlags(p => ({ ...p, noCost: false }))} />}
          {filterFlags.noPhoto        && <ActiveChip label="Sem foto"           onRemove={() => setFilterFlags(p => ({ ...p, noPhoto: false }))} />}
          {filterFlags.singlePlatform && <ActiveChip label="1 só plataforma"    onRemove={() => setFilterFlags(p => ({ ...p, singlePlatform: false }))} />}
          <button onClick={clearAdv}
            className="ml-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
            style={{ color: '#71717a' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717a' }}>
            Limpar tudo
          </button>
        </div>
      )}

      {/* Bulk action bar (list/grid view — DataTable view tem seu próprio
          banner integrado dentro de <ProdutosTable>) */}
      {selected.size > 0 && view !== 'table' && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())}
          onPause={() => bulkPause([...selected])}
          onDelete={() => bulkDelete([...selected])} />
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error} <button onClick={load} className="ml-2 underline">Tentar novamente</button>
        </div>
      )}

      {/* Empty */}
      {!loading && products.length === 0 && !error && (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20"
          style={{ background: '#111114', borderColor: '#1e1e24' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,229,255,0.08)' }}>
            <svg className="w-7 h-7" fill="none" stroke="#00E5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-white font-semibold text-base mb-1">Nenhum produto cadastrado</p>
          <p className="text-zinc-500 text-sm mb-6 text-center max-w-xs">
            Adicione produtos ao seu catálogo para começar a monitorar preços e concorrentes.
          </p>
          <Link href="/dashboard/produtos/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: '#00E5FF', color: '#000' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Cadastrar primeiro produto
          </Link>
        </div>
      )}

      {/* No results */}
      {!loading && products.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-14"
          style={{ background: '#111114', borderColor: '#1e1e24' }}>
          <p className="text-zinc-400 text-sm">Nenhum produto encontrado para <strong className="text-white">&quot;{search}&quot;</strong></p>
          <button onClick={() => { setSearch(''); setFilter('all'); clearAdv() }}
            className="mt-3 text-[12px] font-medium" style={{ color: '#00E5FF' }}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* ── TABLE VIEW (BETA) ──
          - Clique na linha → navega pra detail page (edição completa)
          - Duplicar / Excluir wirados em handlers existentes
          - Pausar/Ativar via togglePauseActive (Bloco 2): page-level
            helper com PUT /products/{id} { status } + optimistic UI.
            Inline editing de preço/custo/estoque NÃO existe na list/grid
            (só em /produtos/[id]/editar) — não há nada pra migrar. */}
      {view === 'table' && (
        // Sem `products` → ProdutosTable entra em SERVER-SIDE mode:
        // fetch GET /products?page=&per_page=&search=&quick_filter=&...
        // com totais corretos do catálogo inteiro (não da página).
        <ProdutosTable
          onRefresh={load}
          onToggleStatus={togglePauseActive}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBulkPause={bulkPause}
          onBulkDelete={bulkDelete}
        />
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (filtered.length > 0 || loading) && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: '860px' }}>
              <thead>
                <tr style={{ background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                  <th className="pl-4 pr-2 py-3 w-10">
                    <input type="checkbox" checked={allSelected}
                      onChange={() => handleSelectAll(allFilteredIds)}
                      className="w-4 h-4 rounded cursor-pointer accent-[#00E5FF]" />
                  </th>
                  {['ANÚNCIO', 'PREÇO', 'PLATAFORMAS', 'MÉTRICAS', 'STATUS', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: '#a1a1aa' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <TableSkeleton />
                  : filtered.map(p => (
                      <TableRow key={p.id} product={p}
                        selected={selected.has(p.id)}
                        onSelect={handleSelect}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        stockInfo={stockMap[p.id]}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {view === 'grid' && filtered.length > 0 && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {view === 'grid' && loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden animate-pulse" style={{ background: '#111114', borderColor: '#1e1e24' }}>
              <div className="h-44" style={{ background: '#1c1c1f' }} />
              <div className="p-4 space-y-3">
                <div className="h-4 rounded w-3/4" style={{ background: '#1e1e24' }} />
                <div className="h-3 rounded w-1/3" style={{ background: '#1e1e24' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showMlImport && (
        <MlImportModal
          onClose={() => setShowMlImport(false)}
          onImported={() => { load() }}
        />
      )}

      {showBulkCost && (
        <BulkCostUploadModal
          onClose={() => setShowBulkCost(false)}
          onSaved={() => { load() }}
        />
      )}
    </div>
  )
}
