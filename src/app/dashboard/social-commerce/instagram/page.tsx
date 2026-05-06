'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Loader2, Plug, Check, RefreshCw, AlertCircle, ShoppingBag, Settings,
  ExternalLink, ChevronRight, Camera, X,
} from 'lucide-react'
import {
  SocialCommerceApi,
  type InstagramStatus,
  type SocialCommerceProduct,
  type MetaPage,
  type MetaCatalog,
} from '@/components/social-commerce/socialCommerceApi'

export default function InstagramShopPage() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('connected') === '1'

  const [status, setStatus] = useState<InstagramStatus | null>(null)
  const [products, setProducts] = useState<SocialCommerceProduct[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Setup wizard state
  const [setupOpen, setSetupOpen] = useState(false)
  const [pages, setPages]         = useState<MetaPage[] | null>(null)
  const [catalogs, setCatalogs]   = useState<MetaCatalog[] | null>(null)
  const [setupBusy, setSetupBusy] = useState(false)
  const [pickedPage, setPickedPage] = useState<MetaPage | null>(null)
  const [pickedCatalog, setPickedCatalog] = useState<MetaCatalog | null>(null)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; skipped: number } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const s = await SocialCommerceApi.getInstagramStatus()
      setStatus(s)
      if (s.connected) {
        const list = await SocialCommerceApi.listProducts()
        setProducts(list)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function connect() {
    try {
      const { authorize_url } = await SocialCommerceApi.getInstagramAuthorizeUrl(
        '/dashboard/social-commerce/instagram',
      )
      window.location.href = authorize_url
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar a integração? Sincronizações pararão.')) return
    try {
      await SocialCommerceApi.disconnectInstagram()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function loadPagesAndCatalogs() {
    setSetupBusy(true); setError(null)
    try {
      const [p, c] = await Promise.all([
        SocialCommerceApi.listPages(),
        SocialCommerceApi.listCatalogs(),
      ])
      setPages(p)
      setCatalogs(c)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSetupBusy(false)
    }
  }

  async function saveSetup() {
    if (!pickedPage || !pickedCatalog) return
    setSetupBusy(true); setError(null)
    try {
      await SocialCommerceApi.setupCatalog({
        page_id:              pickedPage.id,
        instagram_account_id: pickedPage.instagram_business_account?.id,
        catalog_id:           pickedCatalog.id,
      })
      setSetupOpen(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSetupBusy(false)
    }
  }

  async function doSync() {
    setSyncing(true); setSyncResult(null); setError(null)
    try {
      const res = await SocialCommerceApi.syncAll()
      setSyncResult(res)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <ShoppingBag size={20} className="text-pink-400" />
          Instagram / Facebook Shop
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Sincronize seu catálogo com o Meta Commerce e marque produtos em posts/reels.
        </p>
      </div>

      {/* Just connected banner */}
      {justConnected && status?.connected && !status.channel?.external_catalog_id && (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200 flex items-center gap-2">
          <Check size={14} /> Conectado! Configure agora qual Page + Catálogo usar.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {!loading && status && !status.configured_globally && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200 space-y-2">
          <p className="font-medium">⚠ Integração Meta não configurada pelo administrador.</p>
          <p className="text-xs text-amber-200/70">
            Defina <code className="bg-black/20 px-1 rounded">META_APP_ID</code>, <code className="bg-black/20 px-1 rounded">META_APP_SECRET</code> e <code className="bg-black/20 px-1 rounded">META_REDIRECT_URI</code> no Railway.
          </p>
        </div>
      )}

      {/* Not connected */}
      {!loading && status?.configured_globally && !status.connected && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center space-y-3">
          <Plug size={32} className="mx-auto text-zinc-500" />
          <div>
            <p className="text-sm text-zinc-200 font-medium">Não conectado ao Meta ainda</p>
            <p className="text-xs text-zinc-500 mt-1">
              Conecte sua Business Page do Facebook (com Instagram Business vinculado).
            </p>
          </div>
          <button
            onClick={connect}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0866FF] hover:bg-[#0563d6] text-white text-sm font-medium"
          >
            <Plug size={14} /> Conectar Meta
          </button>
        </div>
      )}

      {/* Connected — needs catalog setup */}
      {!loading && status?.connected && !status.channel?.external_catalog_id && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-amber-300" />
            <p className="text-sm font-medium text-amber-200">Configure Page + Catálogo</p>
          </div>
          <p className="text-xs text-amber-200/70">
            Selecione qual Facebook Page (com IG Business vinculado) e qual catálogo do Meta Commerce
            usar pra sincronizar seus produtos.
          </p>
          <button
            onClick={() => { setSetupOpen(true); void loadPagesAndCatalogs() }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-400/40 hover:bg-amber-400/10 text-amber-200 text-xs"
          >
            <Settings size={12} /> Abrir wizard
          </button>
        </div>
      )}

      {/* Connected — fully configured */}
      {!loading && status?.connected && status.channel?.external_catalog_id && (
        <>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-200">Conectado e configurado</p>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Catalog: {status.channel.external_catalog_id}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Sincronizados: {status.channel.products_synced} ·
                  Erros: {status.channel.sync_errors} ·
                  {status.channel.last_sync_at
                    ? ` Último sync: ${new Date(status.channel.last_sync_at).toLocaleString('pt-BR')}`
                    : ' Nunca sincronizado'}
                </p>
              </div>
              <button
                onClick={disconnect}
                className="text-[11px] text-zinc-500 hover:text-red-300 px-2 py-1"
                title="Desconectar"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={doSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Sincronizar agora
              </button>
              <button
                onClick={() => { setSetupOpen(true); void loadPagesAndCatalogs() }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
              >
                <Settings size={12} /> Reconfigurar
              </button>
            </div>
            {syncResult && (
              <p className="text-[11px] text-zinc-300 pt-2 border-t border-zinc-800/60">
                ✓ {syncResult.synced} sincronizados ·
                {syncResult.failed > 0 && ` ${syncResult.failed} falharam ·`}
                {syncResult.skipped > 0 && ` ${syncResult.skipped} pulados`}
              </p>
            )}
          </div>

          {/* Products synced list */}
          {products && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-200">Produtos sincronizados ({products.length})</h2>
              </div>
              {products.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                  Nenhum produto sincronizado ainda. Clique em "Sincronizar agora" pra começar — só produtos
                  com <code className="text-cyan-300">catalog_status='ready'</code> ou <code className="text-cyan-300">live</code> são considerados.
                </p>
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
                  {products.map(p => <ProductSyncRow key={p.id} item={p} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Setup wizard */}
      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Configurar Meta Catalog</h3>
              <button onClick={() => setSetupOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>

            {setupBusy && !pages && !catalogs && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Loader2 size={14} className="animate-spin" /> carregando dados…
              </div>
            )}

            {pages && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">1. Facebook Page</p>
                {pages.length === 0 ? (
                  <p className="text-xs text-amber-300">Nenhuma Page disponível. Verifique se o user tem permissão de admin.</p>
                ) : (
                  <div className="space-y-1">
                    {pages.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setPickedPage(p)}
                        className={[
                          'w-full text-left px-3 py-2 rounded border text-xs transition-colors',
                          pickedPage?.id === p.id
                            ? 'border-cyan-400/60 bg-cyan-400/5 text-cyan-200'
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between">
                          <span>{p.name}</span>
                          {p.instagram_business_account && (
                            <span className="text-[10px] text-pink-300 flex items-center gap-1">
                              <Camera size={10} /> IG vinculado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">{p.id}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {catalogs && pickedPage && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">2. Catálogo Meta Commerce</p>
                {catalogs.length === 0 ? (
                  <div className="text-xs text-amber-300 space-y-1">
                    <p>Nenhum catálogo encontrado.</p>
                    <a
                      href="https://business.facebook.com/commerce_manager"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                    >
                      Crie um no Commerce Manager <ExternalLink size={10} />
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {catalogs.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setPickedCatalog(c)}
                        className={[
                          'w-full text-left px-3 py-2 rounded border text-xs transition-colors',
                          pickedCatalog?.id === c.id
                            ? 'border-cyan-400/60 bg-cyan-400/5 text-cyan-200'
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300',
                        ].join(' ')}
                      >
                        <span>{c.name}</span>
                        <p className="text-[10px] text-zinc-500 font-mono">{c.id}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setSetupOpen(false)}
                className="px-3 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={saveSetup}
                disabled={!pickedPage || !pickedCatalog || setupBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
              >
                {setupBusy ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                Salvar e ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductSyncRow({ item }: { item: SocialCommerceProduct }) {
  const colorByStatus = {
    pending:  '#71717a',
    syncing:  '#00E5FF',
    synced:   '#22c55e',
    error:    '#ef4444',
    rejected: '#f59e0b',
    paused:   '#52525b',
  } as const
  const c = colorByStatus[item.sync_status] ?? '#71717a'
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0 flex-1">
        <p className="text-zinc-200 truncate font-mono">{item.product_id.slice(0, 8)}…</p>
        {item.last_error && (
          <p className="text-[10px] text-red-300 truncate" title={item.last_error}>
            ⚠ {item.last_error}
          </p>
        )}
        {item.last_synced_at && (
          <p className="text-[10px] text-zinc-500">
            {new Date(item.last_synced_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] border"
        style={{ borderColor: `${c}40`, background: `${c}10`, color: c }}
      >
        {item.sync_status}
      </span>
    </div>
  )
}
