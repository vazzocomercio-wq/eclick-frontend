'use client'

/**
 * Pagamentos da loja — admin UI.
 *
 * 2 áreas:
 *  1. EXIBIÇÃO DE PREÇO — como o cliente vê preço na vitrine
 *     - Formato em destaque: à vista / parcelado / Pix
 *     - Parcelamento: max x, sem juros até y
 *     - Desconto Pix: %
 *     - Toggles: mostrar parcela / mostrar Pix
 *     Preview ao vivo de um produto (R$ 1000) com as settings atuais.
 *
 *  2. MÉTODOS DE PAGAMENTO — (futuro: ler do gateway via API; agora
 *     apenas mostra toggle de payments_enabled da store_config).
 *
 * Salva via PATCH /store/config { payment_display_settings: {...} }.
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { CreditCard, Loader2, Save, ChevronLeft, Eye } from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface PaymentDisplaySettings {
  installments: { enabled: boolean; max: number; interestFreeUpTo: number }
  pix:          { enabled: boolean; discountPct: number }
  display: {
    format:               'total_first' | 'installment_first' | 'pix_first'
    showInstallmentLabel: boolean
    showPixPrice:         boolean
  }
}

const DEFAULT: PaymentDisplaySettings = {
  installments: { enabled: true, max: 12, interestFreeUpTo: 6 },
  pix:          { enabled: true, discountPct: 5 },
  display:      { format: 'installment_first', showInstallmentLabel: true, showPixPrice: true },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface GatewayState { configured: boolean; scope: 'org' | 'global' | null }
interface GatewayStatus { mercadopago: GatewayState; stripe: GatewayState }

export default function PagamentosPage() {
  const [settings, setSettings] = useState<PaymentDisplaySettings>(DEFAULT)
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean>(false)
  const [gateways, setGateways] = useState<GatewayStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
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
        const [res, gwRes] = await Promise.all([
          fetch(`${BACKEND}/store/config`, { headers }),
          fetch(`${BACKEND}/storefront-orders/gateway-status`, { headers }),
        ])
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const cfg = await res.json()
        setSettings(cfg.payment_display_settings ?? DEFAULT)
        setPaymentsEnabled(Boolean(cfg.payments_enabled))
        if (gwRes.ok) setGateways(await gwRes.json())
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [fetchToken])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_display_settings: settings }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      setSavedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [fetchToken, settings])

  if (loading) {
    return (
      <div className="p-6 text-center" style={{ color: '#a1a1aa' }}>
        <Loader2 className="animate-spin inline-block mr-2" size={16} /> Carregando…
      </div>
    )
  }

  // ── Preview ao vivo ────────────────────────────────────────────────
  // Produto fictício R$ 1000 — atualiza ao vivo conforme o admin mexe.
  const previewProduct = { price: 1000, name: 'Lustre Premium' }
  const installmentVal = previewProduct.price / settings.installments.max
  const pixPrice = previewProduct.price * (1 - settings.pix.discountPct / 100)

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <CreditCard size={24} /> Pagamentos da loja
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Como o cliente vê o preço · condições de parcelamento · desconto no Pix
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
        {savedAt && (
          <p className="text-xs mt-2" style={{ color: '#22c55e' }}>
            ✓ Salvo às {new Date(savedAt).toLocaleTimeString('pt-BR')}
          </p>
        )}
        {error && (
          <p className="text-xs mt-2" style={{ color: '#ef4444' }}>
            ✗ {error}
          </p>
        )}
      </div>

      {/* Grid 2 col: settings + preview */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* COLUNA SETTINGS */}
        <div className="space-y-6">
          {/* Formato em destaque */}
          <Card title="Como o preço aparece na vitrine">
            <p className="text-xs text-zinc-500 mb-4">
              O cliente vê o preço destacado conforme a opção abaixo. Os outros formatos aparecem em segundo plano (menor, em cinza).
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <FormatCard
                label="Parcelado em destaque"
                description="Ideal pra produtos caros — cliente vê o valor da parcela antes."
                example={`${settings.installments.max}x de ${brl(installmentVal)}`}
                subexample={brl(previewProduct.price)}
                selected={settings.display.format === 'installment_first'}
                onSelect={() => setSettings(s => ({ ...s, display: { ...s.display, format: 'installment_first' } }))}
              />
              <FormatCard
                label="À vista em destaque"
                description="Mostra o valor total grande, parcela embaixo."
                example={brl(previewProduct.price)}
                subexample={`${settings.installments.max}x de ${brl(installmentVal)}`}
                selected={settings.display.format === 'total_first'}
                onSelect={() => setSettings(s => ({ ...s, display: { ...s.display, format: 'total_first' } }))}
              />
              <FormatCard
                label="Pix em destaque"
                description="Promove o pagamento à vista com desconto."
                example={`${brl(pixPrice)} no Pix`}
                subexample={brl(previewProduct.price)}
                selected={settings.display.format === 'pix_first'}
                onSelect={() => setSettings(s => ({ ...s, display: { ...s.display, format: 'pix_first' } }))}
              />
            </div>
          </Card>

          {/* Parcelamento */}
          <Card title="Parcelamento">
            <Toggle
              label="Oferecer parcelamento"
              checked={settings.installments.enabled}
              onChange={v => setSettings(s => ({ ...s, installments: { ...s.installments, enabled: v } }))}
            />
            {settings.installments.enabled && (
              <div className="mt-4 space-y-4">
                <Slider
                  label="Parcelar em até"
                  unit="x"
                  min={1} max={12}
                  value={settings.installments.max}
                  onChange={v => setSettings(s => ({
                    ...s,
                    installments: {
                      ...s.installments,
                      max: v,
                      interestFreeUpTo: Math.min(s.installments.interestFreeUpTo, v),
                    },
                  }))}
                />
                <Slider
                  label="Sem juros até"
                  unit="x"
                  min={1} max={settings.installments.max}
                  value={settings.installments.interestFreeUpTo}
                  onChange={v => setSettings(s => ({ ...s, installments: { ...s.installments, interestFreeUpTo: v } }))}
                />
                <Toggle
                  label="Mostrar texto 'X de R$ Y'"
                  checked={settings.display.showInstallmentLabel}
                  onChange={v => setSettings(s => ({ ...s, display: { ...s.display, showInstallmentLabel: v } }))}
                />
              </div>
            )}
          </Card>

          {/* Pix */}
          <Card title="Desconto no Pix">
            <Toggle
              label="Aplicar desconto pra pagamento via Pix"
              checked={settings.pix.enabled}
              onChange={v => setSettings(s => ({ ...s, pix: { ...s.pix, enabled: v } }))}
            />
            {settings.pix.enabled && (
              <div className="mt-4 space-y-4">
                <Slider
                  label="Desconto"
                  unit="%"
                  min={0} max={30}
                  value={settings.pix.discountPct}
                  onChange={v => setSettings(s => ({ ...s, pix: { ...s.pix, discountPct: v } }))}
                />
                <Toggle
                  label="Mostrar preço com desconto Pix no card"
                  checked={settings.display.showPixPrice}
                  onChange={v => setSettings(s => ({ ...s, display: { ...s.display, showPixPrice: v } }))}
                />
              </div>
            )}
          </Card>

          {/* Gateway status (read-only por enquanto) */}
          <Card title="Gateway de pagamento">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: paymentsEnabled ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${paymentsEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: paymentsEnabled ? '#22c55e' : '#f59e0b',
              }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: paymentsEnabled ? '#22c55e' : '#f59e0b' }}>
                  {paymentsEnabled ? 'Pagamento online ativo' : 'Pagamento online desativado'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {paymentsEnabled
                    ? 'Cliente paga direto pelo gateway (MP/Stripe). Senão, finalização via WhatsApp.'
                    : 'Cliente finaliza compra pelo WhatsApp. Ative pra aceitar pagamento online.'}
                </p>
              </div>
              <Link
                href="/dashboard/store/config"
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 32 }}>
                Config
              </Link>
            </div>
            {/* Status real de conexão por gateway */}
            <div className="mt-3 space-y-2">
              {([
                { key: 'mercadopago' as const, label: 'Mercado Pago' },
                { key: 'stripe' as const,      label: 'Stripe' },
              ]).map(({ key, label }) => {
                const st = gateways?.[key]
                const ok = Boolean(st?.configured)
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#22c55e' : '#52525b' }} />
                    <span className="text-zinc-300 font-medium">{label}</span>
                    <span style={{ color: ok ? '#22c55e' : '#71717a' }}>
                      {ok
                        ? (st?.scope === 'org' ? 'conectado' : 'conectado (chave global e-Click)')
                        : 'não conectado'}
                    </span>
                    {!ok && (
                      <Link href="/dashboard/store/config" className="ml-auto text-cyan-400 hover:underline">
                        conectar →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-3">
              💡 As condições de exibição acima (parcelas, Pix) controlam como o preço aparece na vitrine.
              O processamento do pagamento usa o gateway conectado acima.
            </p>
          </Card>
        </div>

        {/* COLUNA PREVIEW */}
        <div className="space-y-4">
          <Card title={<><Eye size={14} className="inline mr-1" /> Preview ao vivo</>}>
            <p className="text-xs text-zinc-500 mb-3">
              Como o cliente vê o preço de um produto de <strong className="text-zinc-300">{brl(previewProduct.price)}</strong>:
            </p>

            {/* Mini ProductCard */}
            <div className="rounded-lg overflow-hidden" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
              <div className="aspect-square" style={{ background: 'linear-gradient(135deg, #18181b, #09090b)', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>💡</div>
              </div>
              <div className="p-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Iluminação · Premium</p>
                <p className="text-sm text-zinc-100 mb-3">{previewProduct.name}</p>
                <PreviewPriceBlock settings={settings} basePrice={previewProduct.price} />
              </div>
            </div>

            <p className="text-xs text-zinc-500 mt-3">
              💡 Mudanças aplicam ao vivo aqui. Lembre de clicar em <strong className="text-zinc-300">Salvar</strong> pra publicar na vitrine.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <h2 className="text-sm font-medium text-zinc-100 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function FormatCard({ label, description, example, subexample, selected, onSelect }: {
  label: string; description: string; example: string; subexample: string
  selected: boolean; onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="text-left p-3 rounded-lg transition-all"
      style={{
        background: selected ? 'rgba(0,229,255,0.08)' : '#09090b',
        border: `1px solid ${selected ? '#00E5FF' : '#27272a'}`,
        minHeight: 100,
      }}>
      <p className="text-xs font-medium" style={{ color: selected ? '#00E5FF' : '#a1a1aa' }}>{label}</p>
      <p className="text-[10px] text-zinc-600 mt-1 mb-3 leading-relaxed">{description}</p>
      <p className="text-lg font-bold" style={{ color: selected ? '#fafafa' : '#71717a' }}>{example}</p>
      <p className="text-xs text-zinc-600">{subexample}</p>
    </button>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer" style={{ minHeight: 44 }}>
      <span className="text-sm text-zinc-200">{label}</span>
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px', boxSizing: 'border-box',
          background: checked ? '#00E5FF' : '#3f3f46',
          borderRadius: '9999px', position: 'relative',
          flexShrink: 0, cursor: 'pointer',
          transition: 'background 150ms',
        }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, background: '#fff',
          borderRadius: '50%', transition: 'left 150ms',
        }} />
      </div>
    </label>
  )
}

function Slider({ label, unit, min, max, value, onChange }: {
  label: string; unit: string
  min: number; max: number; value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-200">{label}</span>
        <span className="text-sm font-medium tabular-nums" style={{ color: '#00E5FF' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: '#00E5FF' }}
      />
    </div>
  )
}

/** Renderiza preview do preço com as settings — espelha PriceDisplay
 *  do renderer pra mostrar exatamente como vai aparecer. */
function PreviewPriceBlock({ settings, basePrice }: { settings: PaymentDisplaySettings; basePrice: number }) {
  const installmentVal = basePrice / settings.installments.max
  const pixPrice = basePrice * (1 - settings.pix.discountPct / 100)

  const formats = {
    installment_first: {
      primary: `${settings.installments.max}x de ${brl(installmentVal)}`,
      primaryNote: settings.installments.interestFreeUpTo >= settings.installments.max ? 'sem juros' : '',
      secondary: brl(basePrice),
      tertiary:  settings.pix.enabled && settings.pix.discountPct > 0 ? `${brl(pixPrice)} no Pix · ${settings.pix.discountPct}% off` : '',
    },
    total_first: {
      primary: brl(basePrice),
      primaryNote: '',
      secondary: settings.installments.enabled ? `${settings.installments.max}x de ${brl(installmentVal)}` : '',
      tertiary:  settings.pix.enabled && settings.pix.discountPct > 0 ? `${brl(pixPrice)} no Pix · ${settings.pix.discountPct}% off` : '',
    },
    pix_first: {
      primary: settings.pix.enabled && settings.pix.discountPct > 0 ? `${brl(pixPrice)} no Pix` : brl(basePrice),
      primaryNote: settings.pix.enabled ? `${settings.pix.discountPct}% off` : '',
      secondary: brl(basePrice),
      tertiary:  settings.installments.enabled ? `${settings.installments.max}x de ${brl(installmentVal)}` : '',
    },
  }
  const cur = formats[settings.display.format]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#00E5FF' }}>{cur.primary}</span>
        {cur.primaryNote && <span style={{ fontSize: 11, color: '#a1a1aa' }}>{cur.primaryNote}</span>}
      </div>
      {cur.secondary && (
        <span style={{ fontSize: 12, color: '#71717a' }}>{cur.secondary}</span>
      )}
      {cur.tertiary && settings.display.showPixPrice && (
        <span style={{ fontSize: 12, color: '#22c55e' }}>{cur.tertiary}</span>
      )}
    </div>
  )
}
