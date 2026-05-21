'use client'

/**
 * Hub central de gestão da Loja Própria.
 *
 * Tela única consolidando os atalhos pras ferramentas comerciais da loja:
 * Designer, Cupons, Frete, Pedidos, Coleções, Banner IA, etc.
 *
 * - Header com status da loja (slug + status + link vitrine)
 * - Cards de atalho com contadores (cupons ativos, regras de frete, etc.)
 * - Quick actions
 * - Seção "Em breve" pra features que ainda não existem (promoções
 *   por produto, bônus, kits combo, etc.) — gerencia expectativa.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Store, Palette, Ticket, Truck, ShoppingCart, Layers, Package, Sparkles,
  Megaphone, Gift, BarChart3, Loader2, AlertCircle, ExternalLink, Plus,
  ChevronRight, Settings, ImageIcon, CreditCard, Tag, Wallet, Trophy, Users,
  MessageSquare,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface StoreConfig {
  store_name:    string
  store_slug:    string
  status:        'setup' | 'active' | 'paused' | 'suspended'
  custom_domain: string | null
  domain_verified?: boolean
  logo_url:      string | null
  payments_enabled: boolean
  whatsapp_widget_enabled: boolean
  google_analytics_id?:   string | null
  meta_pixel_id?:         string | null
  tiktok_pixel_id?:       string | null
  gtm_id?:                string | null
}

interface Stats {
  couponsActive:   number
  couponsTotal:    number
  shippingActive:  number
  shippingTotal:   number
  productsVisible: number
}

export default function LojaHubPage() {
  const [config,  setConfig]  = useState<StoreConfig | null>(null)
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const token = await fetchToken()
        const headers = { Authorization: `Bearer ${token}` }
        const [cfgRes, couponsRes, shippingRes] = await Promise.all([
          fetch(`${BACKEND}/store/config`,    { headers }),
          fetch(`${BACKEND}/coupons`,         { headers }),
          fetch(`${BACKEND}/shipping-rules`,  { headers }),
        ])
        if (cfgRes.ok) setConfig(await cfgRes.json())
        const coupons = couponsRes.ok ? await couponsRes.json() : []
        const shipping = shippingRes.ok ? await shippingRes.json() : []
        setStats({
          couponsActive:   coupons.filter((c: { active: boolean }) => c.active).length,
          couponsTotal:    coupons.length,
          shippingActive:  shipping.filter((r: { active: boolean }) => r.active).length,
          shippingTotal:   shipping.length,
          productsVisible: 0,  // TODO: endpoint de contagem
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar.')
      } finally {
        setLoading(false)
      }
    })()
  }, [fetchToken])

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2" style={{ color: '#a1a1aa' }}>
        <Loader2 size={16} className="animate-spin" /> Carregando…
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg p-3 text-sm flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      </div>
    )
  }

  const statusColor = config?.status === 'active' ? '#22c55e' : config?.status === 'paused' ? '#eab308' : '#a1a1aa'

  // Pixel/analytics health
  const pixelsCount = config
    ? Number(!!config.google_analytics_id) + Number(!!config.meta_pixel_id) + Number(!!config.tiktok_pixel_id) + Number(!!config.gtm_id)
    : 0

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header com status da loja */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {config?.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={config.logo_url} alt={config.store_name}
              style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: '#0a0a0e', padding: 4 }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 8, background: 'linear-gradient(135deg, #00E5FF, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Store size={28} style={{ color: '#0a0a0e' }} />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#fafafa' }}>
              {config?.store_name ?? 'Sua loja'}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: '#a1a1aa' }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, background: `${statusColor}22`, color: statusColor, fontWeight: 600 }}>
                ● {config?.status === 'active' ? 'Ao vivo' : config?.status === 'paused' ? 'Pausada' : config?.status ?? '—'}
              </span>
              <span>/loja/<strong style={{ color: '#fafafa' }}>{config?.store_slug}</strong></span>
              {config?.custom_domain && (
                <span>· domínio: <strong style={{ color: config.domain_verified ? '#4ade80' : '#fcd34d' }}>{config.custom_domain}</strong></span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config?.store_slug && (
            <a href={`/loja/${config.store_slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
              style={{ background: 'transparent', color: '#00E5FF', border: '1px solid #27272a', minHeight: 44 }}>
              <ExternalLink size={14} /> Ver vitrine
            </a>
          )}
          <Link href="/dashboard/store/config"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
            style={{ background: '#1e1e24', color: '#fafafa', border: 'none', minHeight: 44 }}>
            <Settings size={14} /> Config
          </Link>
        </div>
      </div>

      {/* Grid principal — Ferramentas ativas */}
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: '#a1a1aa' }}>
          Ferramentas da loja
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          <ToolCard
            href="/dashboard/store/designer-v3"
            icon={<Palette size={20} />}
            label="Designer da loja"
            description="Editor visual completo · 30 fontes · 5 templates · gera com IA"
            badge="v3 BETA"
            color="#00E5FF"
          />
          <ToolCard
            href="/dashboard/loja/cupons"
            icon={<Ticket size={20} />}
            label="Cupons"
            description="Códigos promocionais com % · valor fixo · frete grátis"
            badge={stats ? `${stats.couponsActive}/${stats.couponsTotal} ativos` : undefined}
            color="#a78bfa"
          />
          <ToolCard
            href="/dashboard/loja/frete"
            icon={<Truck size={20} />}
            label="Frete"
            description="Regras polimórficas · 6 tipos (fixo, CEP, peso, %, grátis, ME)"
            badge={stats ? `${stats.shippingActive}/${stats.shippingTotal} regras` : undefined}
            color="#fcd34d"
          />
          <ToolCard
            href="/dashboard/store/config"
            icon={<Settings size={20} />}
            label="Configurações"
            description="Identidade · domínio · pixels · pagamentos · SEO"
            badge={pixelsCount > 0 ? `${pixelsCount} pixels` : 'Sem pixels'}
            color="#22c55e"
          />
          <ToolCard
            href="/dashboard/store-copilot"
            icon={<Sparkles size={20} />}
            label="Copiloto da loja"
            description="IA assistente · sugestões de pricing/coleções/conteúdo"
            color="#f472b6"
          />
          <ToolCard
            href="/dashboard/collections"
            icon={<Layers size={20} />}
            label="Coleções"
            description="Agrupa produtos por tema · manual ou regra dinâmica"
            color="#60a5fa"
          />
          <ToolCard
            href="/dashboard/kits"
            icon={<Package size={20} />}
            label="Kits & Combos"
            description="Bundles de produtos · preço de pacote"
            color="#fb923c"
          />
          <ToolCard
            href="/dashboard/automation"
            icon={<Megaphone size={20} />}
            label="Automação IA"
            description="Regras autônomas · low stock · sales drop · concorrentes"
            color="#34d399"
          />
          <ToolCard
            href="/dashboard/pedidos?platform=storefront"
            icon={<ShoppingCart size={20} />}
            label="Pedidos da loja"
            description="Pedidos da vitrine no módulo de pedidos · filtro Loja Própria"
            color="#fb7185"
          />
          <ToolCard
            href="/dashboard/loja/entregas"
            icon={<Truck size={20} />}
            label="Entregas"
            description="Tracking físico · marca enviado/entregue · código de rastreio"
            color="#06b6d4"
          />
          <ToolCard
            href="/dashboard/loja/pagamentos"
            icon={<CreditCard size={20} />}
            label="Pagamentos"
            description="Como mostrar preço · parcelas · desconto Pix · gateway"
            color="#10b981"
          />
          <ToolCard
            href="/dashboard/loja/promocoes"
            icon={<Tag size={20} />}
            label="Promoções"
            description="Desconto direto no produto · % bidirectional · bulk apply"
            badge="BETA"
            color="#ef4444"
          />
          <ToolCard
            href="/dashboard/loja/campanhas"
            icon={<Megaphone size={20} />}
            label="Campanhas"
            description="Agrupador de produtos · desconto comum · override individual"
            badge="BETA"
            color="#f472b6"
          />
          <ToolCard
            href="/dashboard/loja/afiliados"
            icon={<Users size={20} />}
            label="Afiliados"
            description="Pessoas indicam sua loja · ganham % por venda · estilo Shopee/TikTok"
            badge="BETA"
            color="#0ea5e9"
          />
          <ToolCard
            href="/dashboard/loja/cashback"
            icon={<Wallet size={20} />}
            label="Cashback inteligente"
            description="% de cada pedido vira saldo · cliente usa em compras futuras"
            badge="BETA"
            color="#22c55e"
          />
          <ToolCard
            href="/dashboard/loja/bonus"
            icon={<Gift size={20} />}
            label="Bônus & Brindes"
            description="Leve 2 pague 1 · brinde acima de R$ X · presente surpresa"
            badge="BETA"
            color="#a78bfa"
          />
          <ToolCard
            href="/dashboard/loja/reviews"
            icon={<MessageSquare size={20} />}
            label="Avaliações"
            description="Modere as estrelas dos clientes · responda em público · ganha confiança"
            badge="BETA"
            color="#fbbf24"
          />
          <ToolCard
            href="/dashboard/loja/banners"
            icon={<ImageIcon size={20} />}
            label="Banners IA"
            description="Galeria de banners gerados · 10 estilos · multi-formato"
            color="#fcd34d"
          />
          <ToolCard
            href="/dashboard/loja/fidelidade"
            icon={<Trophy size={20} />}
            label="Fidelidade"
            description="Níveis bronze/prata/ouro · cliente sobe automaticamente"
            badge="BETA"
            color="#eab308"
          />
        </div>
      </div>

      {/* Em breve / pendentes — vazio (todas as features entregues 🎉) */}

      {/* Quick actions */}
      <div className="rounded-lg p-4" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <h2 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: '#00E5FF' }}>
          <Plus size={14} /> Ações rápidas
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/loja/cupons" className="text-xs px-3 py-2 rounded"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
            + Novo cupom
          </Link>
          <Link href="/dashboard/loja/frete" className="text-xs px-3 py-2 rounded"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
            + Nova regra de frete
          </Link>
          <Link href="/dashboard/store/designer-v3" className="text-xs px-3 py-2 rounded"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
            🎨 Personalizar vitrine
          </Link>
          <Link href="/dashboard/pedidos?platform=storefront" className="text-xs px-3 py-2 rounded"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
            📦 Ver pedidos da loja
          </Link>
          {config?.store_slug && (
            <a href={`/loja/${config.store_slug}`} target="_blank" rel="noopener noreferrer"
              className="text-xs px-3 py-2 rounded"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
              ↗ Abrir vitrine ao vivo
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ href, icon, label, description, badge, color }: {
  href: string; icon: React.ReactNode; label: string; description: string; badge?: string; color: string
}) {
  return (
    <Link href={href}
      style={{
        display: 'block', padding: 16, minHeight: 140,
        background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8,
        textDecoration: 'none', color: '#fafafa',
        transition: 'border-color 150ms, transform 150ms',
      }}
      className="hover:border-cyan-400/50"
    >
      <div className="flex items-start justify-between mb-3">
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: `${color}1a`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {badge && (
          <span style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 4,
            background: `${color}22`, color, fontWeight: 600,
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4, lineHeight: 1.4 }}>{description}</div>
      <div className="flex items-center mt-3 text-xs" style={{ color: '#52525b' }}>
        Abrir <ChevronRight size={12} />
      </div>
    </Link>
  )
}

function ComingSoonCard({ icon, label, description }: {
  icon: React.ReactNode; label: string; description: string
}) {
  return (
    <div style={{
      padding: 16, minHeight: 120,
      background: '#0a0a0e', border: '1px dashed #27272a', borderRadius: 8,
      opacity: 0.7,
    }}>
      <div className="flex items-start justify-between mb-3">
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: '#1e1e24', color: '#a1a1aa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 4,
          background: 'transparent', color: '#52525b',
          border: '1px dashed #52525b', fontWeight: 600,
        }}>
          EM BREVE
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#a1a1aa' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#52525b', marginTop: 4, lineHeight: 1.4 }}>{description}</div>
    </div>
  )
}
