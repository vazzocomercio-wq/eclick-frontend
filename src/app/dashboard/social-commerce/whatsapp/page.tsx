'use client'

/**
 * Dashboard — WhatsApp Business Catalog.
 *
 * Vincula um catalog Meta (mesmo do Instagram Shop) ao WhatsApp Business
 * Account (WABA). Apos vinculado, os produtos do catalog aparecem dentro
 * do WhatsApp Business do lojista + clientes podem acessar via
 * wa.me/c/{phone}.
 *
 * Estados:
 *  - Meta nao conectado     → CTA pra /dashboard/social-commerce/instagram
 *  - Meta conectado, WA off → wizard (escolha WABA + catalog)
 *  - Conectado              → status + sync + disconnect
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, Check, RefreshCw, AlertCircle, ChevronRight, X,
  MessageCircle, ExternalLink, Settings, Phone,
} from 'lucide-react'
import {
  SocialCommerceApi,
  type WhatsappStatus,
  type MetaWaba,
  type MetaCatalog,
  type InstagramStatus,
} from '@/components/social-commerce/socialCommerceApi'

export default function WhatsappCatalogPage() {
  const [waStatus, setWaStatus]   = useState<WhatsappStatus | null>(null)
  const [igStatus, setIgStatus]   = useState<InstagramStatus | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [setupOpen, setSetupOpen] = useState(false)
  const [wabas, setWabas]         = useState<MetaWaba[] | null>(null)
  const [catalogs, setCatalogs]   = useState<MetaCatalog[] | null>(null)
  const [pickedWaba, setPickedWaba] = useState<MetaWaba | null>(null)
  const [pickedPhoneId, setPickedPhoneId] = useState<string | null>(null)
  const [pickedCatalog, setPickedCatalog] = useState<MetaCatalog | null>(null)
  const [setupBusy, setSetupBusy] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; skipped: number } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [wa, ig] = await Promise.all([
        SocialCommerceApi.getWhatsappStatus(),
        SocialCommerceApi.getInstagramStatus(),
      ])
      setWaStatus(wa)
      setIgStatus(ig)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function openWizard() {
    setSetupOpen(true); setError(null)
    try {
      const [w, c] = await Promise.all([
        SocialCommerceApi.listWabas(),
        SocialCommerceApi.listCatalogs(),
      ])
      setWabas(w); setCatalogs(c)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function confirmSetup() {
    if (!pickedWaba || !pickedCatalog) return
    setSetupBusy(true); setError(null)
    try {
      const phone = pickedWaba.phone_numbers?.find(p => p.id === pickedPhoneId)
      await SocialCommerceApi.setupWhatsapp({
        waba_id:         pickedWaba.id,
        catalog_id:      pickedCatalog.id,
        phone_number_id: pickedPhoneId ?? undefined,
        display_phone:   phone?.display_phone_number,
      })
      setSetupOpen(false)
      setPickedWaba(null); setPickedPhoneId(null); setPickedCatalog(null)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSetupBusy(false)
    }
  }

  async function disconnect() {
    if (!confirm('Desvincular catálogo do WhatsApp Business? Os produtos deixam de aparecer no WhatsApp da loja.')) return
    setError(null)
    try {
      await SocialCommerceApi.disconnectWhatsapp()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function syncNow() {
    setSyncing(true); setError(null); setSyncResult(null)
    try {
      const r = await SocialCommerceApi.syncWhatsapp()
      setSyncResult(r)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 size={14} className="animate-spin" /> Carregando…
      </div>
    )
  }

  const igConnected = igStatus?.connected ?? false
  const waConnected = waStatus?.connected ?? false
  const channel     = waStatus?.channel
  const cfg         = (channel?.config ?? {}) as Record<string, unknown>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <MessageCircle size={20} className="text-emerald-400" />
          Catálogo do WhatsApp Business
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Vincule seu catálogo Meta (o mesmo do Instagram Shop) ao WhatsApp Business pra
          que os produtos apareçam dentro do app do WhatsApp.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Etapa 1: Meta conectado? */}
      {!igConnected && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Etapa 1 — Conectar com a Meta</h2>
          <p className="text-xs text-zinc-500 leading-snug">
            O catálogo do WhatsApp Business compartilha a mesma conta Meta usada pro Instagram Shop.
            Conecte primeiro a Meta para liberar a configuração do WhatsApp.
          </p>
          <Link href="/dashboard/social-commerce/instagram"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium">
            Conectar Meta <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Etapa 2: Configurar WABA + Catalog */}
      {igConnected && !waConnected && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Etapa 2 — Vincular WhatsApp Business</h2>
          <p className="text-xs text-zinc-500 leading-snug">
            Selecione a conta WhatsApp Business (WABA) e o catálogo do Meta Commerce.
            Após vincular, os produtos aparecem no WhatsApp Business e os clientes
            conseguem ver o catálogo via <code className="text-cyan-300">wa.me/c/(número)</code>.
          </p>
          <button onClick={openWizard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-sm font-medium">
            <Settings size={14} /> Iniciar configuração
          </button>
        </div>
      )}

      {/* Status conectado */}
      {waConnected && channel && (
        <>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Check size={20} className="text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-emerald-300">
                  Catálogo vinculado ao WhatsApp Business
                </h2>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-zinc-500">WABA ID</dt>
                    <dd className="text-zinc-200 font-mono truncate">{channel.external_account_id ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Catalog ID</dt>
                    <dd className="text-zinc-200 font-mono truncate">{channel.external_catalog_id ?? '-'}</dd>
                  </div>
                  {typeof cfg.display_phone === 'string' && (
                    <div>
                      <dt className="text-zinc-500">Telefone</dt>
                      <dd className="text-zinc-200 font-mono flex items-center gap-1.5">
                        <Phone size={11} /> {cfg.display_phone}
                      </dd>
                    </div>
                  )}
                  {channel.last_sync_at && (
                    <div>
                      <dt className="text-zinc-500">Última sync</dt>
                      <dd className="text-zinc-200">{new Date(channel.last_sync_at).toLocaleString('pt-BR')}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-zinc-500">Produtos sincronizados</dt>
                    <dd className="text-zinc-200">{channel.products_synced}</dd>
                  </div>
                </dl>
                {typeof cfg.display_phone === 'string' && (
                  <a
                    href={`https://wa.me/c/${String(cfg.display_phone).replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-cyan-400 hover:underline">
                    Abrir catálogo no WhatsApp <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={syncNow} disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 hover:border-cyan-400/50 text-zinc-300 hover:text-cyan-300 text-sm disabled:opacity-50">
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sincronizar produtos
            </button>
            <button onClick={disconnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 hover:border-red-400/50 text-zinc-300 hover:text-red-400 text-sm">
              <X size={14} /> Desvincular
            </button>
          </div>

          {syncResult && (
            <div className="text-xs text-zinc-400 rounded border border-zinc-800/70 bg-zinc-900/40 p-3">
              ✓ {syncResult.synced} sincronizados, {syncResult.failed} falhas, {syncResult.skipped} pulados.
            </div>
          )}
        </>
      )}

      {/* Setup Wizard Modal */}
      {setupOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-zinc-100">Configurar WhatsApp Business</h3>
              <button onClick={() => setSetupOpen(false)} aria-label="Fechar"
                className="p-1 text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            {/* WABA picker */}
            <div className="space-y-2 mb-4">
              <p className="text-xs uppercase tracking-wider text-zinc-400">1. Conta WhatsApp Business</p>
              {wabas === null && <p className="text-xs text-zinc-500">Carregando…</p>}
              {wabas?.length === 0 && (
                <p className="text-xs text-amber-300">
                  Nenhuma WABA encontrada. Verifique se a conta Meta conectada tem permissão
                  <code className="text-cyan-300 mx-1">whatsapp_business_management</code>
                  e se há um WhatsApp Business Account no Business Manager.
                </p>
              )}
              {wabas?.map(w => (
                <button key={w.id} onClick={() => { setPickedWaba(w); setPickedPhoneId(w.phone_numbers?.[0]?.id ?? null) }}
                  className={`w-full text-left rounded border p-3 transition-colors ${
                    pickedWaba?.id === w.id
                      ? 'border-emerald-400/70 bg-emerald-400/5'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
                  }`}>
                  <p className="text-sm font-semibold text-zinc-100">{w.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{w.id}</p>
                  {w.phone_numbers && w.phone_numbers.length > 0 && (
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {w.phone_numbers.length} número{w.phone_numbers.length === 1 ? '' : 's'}:
                      {' '}{w.phone_numbers.map(p => p.display_phone_number).join(', ')}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {/* Phone picker (quando há +1) */}
            {pickedWaba && pickedWaba.phone_numbers && pickedWaba.phone_numbers.length > 1 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wider text-zinc-400">Número do WhatsApp</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {pickedWaba.phone_numbers.map(p => (
                    <button key={p.id} onClick={() => setPickedPhoneId(p.id)}
                      className={`text-left rounded border p-2.5 transition-colors ${
                        pickedPhoneId === p.id
                          ? 'border-emerald-400/70 bg-emerald-400/5'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
                      }`}>
                      <p className="text-xs font-mono text-zinc-200">{p.display_phone_number}</p>
                      <p className="text-[10px] text-zinc-500">{p.verified_name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Catalog picker */}
            <div className="space-y-2 mb-4">
              <p className="text-xs uppercase tracking-wider text-zinc-400">2. Catálogo Meta</p>
              {catalogs === null && <p className="text-xs text-zinc-500">Carregando…</p>}
              {catalogs?.length === 0 && (
                <p className="text-xs text-amber-300">
                  Nenhum catálogo encontrado. Crie um em <em>business.facebook.com → Commerce Manager</em>.
                </p>
              )}
              {catalogs?.map(c => (
                <button key={c.id} onClick={() => setPickedCatalog(c)}
                  className={`w-full text-left rounded border p-3 transition-colors ${
                    pickedCatalog?.id === c.id
                      ? 'border-emerald-400/70 bg-emerald-400/5'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
                  }`}>
                  <p className="text-sm font-semibold text-zinc-100">{c.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{c.id}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setSetupOpen(false)} disabled={setupBusy}
                className="px-3 py-2 rounded text-sm text-zinc-400 hover:text-zinc-200">
                Cancelar
              </button>
              <button onClick={confirmSetup} disabled={!pickedWaba || !pickedCatalog || setupBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black text-sm font-semibold">
                {setupBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Vincular catálogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
