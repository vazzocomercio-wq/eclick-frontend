'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, ExternalLink, AlertTriangle, ShieldOff, ShieldAlert,
  Pause, Image as ImageIcon, FileText, DollarSign, FolderOpen, Lock, AlertCircle,
  Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Category =
  | 'out_of_stock' | 'paused_by_seller' | 'moderation_pending'
  | 'policy_violation' | 'image_problem' | 'description_problem'
  | 'price_problem' | 'category_problem' | 'restricted_product'
  | 'incomplete_required_fields' | 'expired' | 'unknown'

interface Group {
  category: Category
  count: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  suggested_fix: string | null
  items: Array<{
    ml_item_id: string
    item_title: string | null
    item_price: number | null
    item_sold_quantity: number | null
    days_paused: number | null
    is_self_solvable: boolean
  }>
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Pause; description: string }> = {
  policy_violation:           { label: 'Violação de política',     icon: ShieldOff,    description: 'Anúncio viola política ML' },
  restricted_product:         { label: 'Produto restrito',         icon: Lock,         description: 'Produto restrito pelo ML' },
  moderation_pending:         { label: 'Moderação pendente',       icon: ShieldAlert,  description: 'Aguardando análise do ML' },
  out_of_stock:               { label: 'Sem estoque',              icon: Pause,        description: 'Pausado por estoque zerado' },
  image_problem:              { label: 'Problema com imagem',      icon: ImageIcon,    description: 'Foto não atende requisitos' },
  description_problem:        { label: 'Problema na descrição',    icon: FileText,     description: 'Texto com termos proibidos / links' },
  price_problem:              { label: 'Problema de preço',        icon: DollarSign,   description: 'Preço inválido ou fora do range' },
  category_problem:           { label: 'Categoria errada',         icon: FolderOpen,   description: 'Anúncio na categoria errada' },
  incomplete_required_fields: { label: 'Atributos obrigatórios',   icon: AlertCircle,  description: 'Ficha técnica incompleta' },
  expired:                    { label: 'Anúncio expirado',         icon: Clock,        description: 'Validade venceu' },
  paused_by_seller:           { label: 'Pausado pelo vendedor',    icon: Pause,        description: 'Pausa voluntária' },
  unknown:                    { label: 'Outros / desconhecido',    icon: AlertTriangle, description: 'Motivo não classificado' },
}

const SEV_META: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Crítica' },
  high:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Alta' },
  medium:   { color: '#00E5FF', bg: 'rgba(0,229,255,0.08)',   label: 'Média' },
  low:      { color: '#a1a1aa', bg: 'rgba(113,113,122,0.08)', label: 'Baixa' },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PolicyPage() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [groups, setGroups]   = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `?seller_id=${sellerId}` : ''
      const res = await fetch(`${BACKEND}/listings/policy/by-category${sellerQs}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGroups(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro ao carregar', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, toast])

  useEffect(() => { load() }, [load])

  const runScan = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: 'Selecione uma conta ML', tone: 'error' })
      return
    }
    setScanning(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/scan/status`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      toast({ message: `Scan status · ${r.items_scanned} items pausados/inativos analisados`, tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const toggle = (cat: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(cat)) n.delete(cat); else n.add(cat)
      return n
    })
  }

  const totalItems = groups.reduce((s, g) => s + g.count, 0)
  const criticalCount = groups.filter(g => g.severity === 'critical').reduce((s, g) => s + g.count, 0)

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />

      <div>
        <Link href="/dashboard/listings"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> Voltar para Listing Center
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Listing Center · Política & motivos de pausa</p>
            <h1 className="text-white text-3xl font-semibold">Anúncios pausados — por motivo</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {totalItems > 0
                ? `${totalItems} anúncio${totalItems !== 1 ? 's' : ''} classificado${totalItems !== 1 ? 's' : ''}${criticalCount > 0 ? ` · ${criticalCount} crítico${criticalCount !== 1 ? 's' : ''}` : ''}`
                : 'Rode o scan de status pra detectar e classificar pausados'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={runScan} disabled={scanning}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> Rodar scan
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>Carregando…</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-400 text-sm">Nenhum anúncio pausado classificado</p>
          <p className="text-zinc-600 text-xs mt-1">Rode o scan pra começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const meta = CATEGORY_META[group.category] ?? CATEGORY_META.unknown
            const sev = SEV_META[group.severity] ?? SEV_META.low
            const Icon = meta.icon
            const isOpen = expanded.has(group.category)

            return (
              <div key={group.category} className="rounded-xl overflow-hidden"
                style={{ background: '#111114', border: '1px solid #1a1a1f', borderLeft: `3px solid ${sev.color}` }}>
                <button onClick={() => toggle(group.category)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900/40 transition-colors">
                  <div className="shrink-0 p-2 rounded-lg" style={{ background: sev.bg, border: `1px solid ${sev.color}40` }}>
                    <Icon size={18} style={{ color: sev.color }} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-zinc-100 font-semibold">{meta.label}</p>
                      <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                        style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}40` }}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-400 font-mono">{group.count} anúncio{group.count !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{meta.description}</p>
                    {group.suggested_fix && (
                      <p className="text-[11px] text-cyan-300 mt-1 italic">💡 {group.suggested_fix}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-zinc-500">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
                    {group.items.length === 0 ? (
                      <div className="p-4 text-xs text-zinc-500 text-center">Sem amostras</div>
                    ) : (
                      group.items.map(it => (
                        <div key={it.ml_item_id} className="p-3 flex items-center gap-3 hover:bg-zinc-900/30">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <Link href={`/dashboard/listings/items/${it.ml_item_id}`}
                                className="font-mono text-xs text-zinc-300 hover:text-cyan-400">{it.ml_item_id}</Link>
                              <a href={`https://www.mercadolivre.com.br/${it.ml_item_id}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
                                ML <ExternalLink size={9} />
                              </a>
                              {it.is_self_solvable && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded text-emerald-400"
                                  style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                  Resolvível
                                </span>
                              )}
                            </div>
                            {it.item_title && <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{it.item_title}</p>}
                          </div>
                          <div className="shrink-0 text-right text-[10px] text-zinc-500">
                            {it.item_price != null && <p className="text-zinc-300">{brl(it.item_price)}</p>}
                            {it.item_sold_quantity != null && it.item_sold_quantity > 0 && (
                              <p>{it.item_sold_quantity} vendido{it.item_sold_quantity !== 1 ? 's' : ''}</p>
                            )}
                            {it.days_paused != null && it.days_paused > 0 && (
                              <p className={it.days_paused > 30 ? 'text-amber-400' : ''}>{it.days_paused}d parado</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {group.count > group.items.length && (
                      <div className="p-2 text-center text-[10px] text-zinc-600">
                        +{group.count - group.items.length} adicional{group.count - group.items.length !== 1 ? 'is' : ''} (limitado a {group.items.length})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
