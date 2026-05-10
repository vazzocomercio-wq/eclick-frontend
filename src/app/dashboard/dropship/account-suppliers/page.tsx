'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Plus, X, Link2, Trash2, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface AccountSupplier {
  id: string
  marketplace: string
  seller_id: number | null
  shopee_shop_id: string | null
  amazon_seller_id: string | null
  account_label: string | null
  is_default: boolean
  active_since: string
  active_until: string | null
  notes: string | null
  created_at: string
  suppliers: { id: string; name: string }
}

interface PartnerOption {
  id: string  // dropship_profile id
  supplier_id: string
  suppliers: { id: string; name: string }
}

interface NewLinkForm {
  supplier_id: string
  marketplace: 'mercado_livre' | 'shopee' | 'amazon' | 'magalu' | 'others'
  seller_id: string
  shopee_shop_id: string
  amazon_seller_id: string
  account_label: string
  is_default: boolean
  notes: string
}

const EMPTY_FORM: NewLinkForm = {
  supplier_id: '', marketplace: 'mercado_livre',
  seller_id: '', shopee_shop_id: '', amazon_seller_id: '',
  account_label: '', is_default: true, notes: '',
}

const MARKETPLACE_LABELS: Record<string, string> = {
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  magalu: 'Magalu',
  others: 'Outros',
}

export default function AccountSuppliersPage() {
  const supabase = useMemo(() => createClient(), [])

  const [links, setLinks] = useState<AccountSupplier[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMarketplace, setFilterMarketplace] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewLinkForm>(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [pageErr, setPageErr] = useState('')

  // Contas conectadas (OAuth) do marketplace selecionado
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{
    id_field: 'seller_id' | 'shopee_shop_id' | 'amazon_seller_id'
    id_value: string
    nickname: string | null
    already_linked: boolean
  }>>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setPageErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterMarketplace !== 'all') params.set('marketplace', filterMarketplace)

      const [linksRes, partnersRes] = await Promise.all([
        fetch(`${BACKEND}/dropship/account-suppliers?${params}`, { headers }),
        fetch(`${BACKEND}/dropship/partners?status=active`, { headers }),
      ])
      if (!linksRes.ok) throw new Error(`Vínculos HTTP ${linksRes.status}`)
      if (!partnersRes.ok) throw new Error(`Parceiros HTTP ${partnersRes.status}`)
      setLinks(await linksRes.json())
      setPartners(await partnersRes.json())
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setLinks([])
    } finally { setLoading(false) }
  }, [getHeaders, filterMarketplace])

  useEffect(() => { load() }, [load])

  // Busca contas conectadas quando marketplace muda no modal
  useEffect(() => {
    if (!showModal) return
    let cancelled = false
    setLoadingAccounts(true)
    setConnectedAccounts([])
    // Reseta IDs ao trocar marketplace
    setForm(f => ({ ...f, seller_id: '', shopee_shop_id: '', amazon_seller_id: '', account_label: '' }))
    ;(async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(
          `${BACKEND}/dropship/connected-accounts?marketplace=${encodeURIComponent(form.marketplace)}`,
          { headers },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setConnectedAccounts(data.accounts ?? [])
      } catch {
        if (!cancelled) setConnectedAccounts([])
      } finally {
        if (!cancelled) setLoadingAccounts(false)
      }
    })()
    return () => { cancelled = true }
  }, [showModal, form.marketplace, getHeaders])

  function selectAccount(idValue: string) {
    const acc = connectedAccounts.find(a => a.id_value === idValue)
    if (!acc) return
    setForm(f => ({
      ...f,
      seller_id: acc.id_field === 'seller_id' ? acc.id_value : '',
      shopee_shop_id: acc.id_field === 'shopee_shop_id' ? acc.id_value : '',
      amazon_seller_id: acc.id_field === 'amazon_seller_id' ? acc.id_value : '',
      // Auto-preenche label se vazio
      account_label: f.account_label || acc.nickname || '',
    }))
  }

  // Valor selecionado no dropdown (qual id_value está preenchido)
  const selectedAccountValue = form.seller_id || form.shopee_shop_id || form.amazon_seller_id

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplier_id) { setFormErr('Escolha um parceiro'); return }
    if (!form.seller_id && !form.shopee_shop_id && !form.amazon_seller_id) {
      setFormErr('Informe pelo menos um ID da conta no marketplace')
      return
    }
    setSaving(true); setFormErr('')
    try {
      const headers = await getHeaders()
      const payload = {
        supplier_id: form.supplier_id,
        marketplace: form.marketplace,
        seller_id: form.seller_id ? Number(form.seller_id) : null,
        shopee_shop_id: form.shopee_shop_id || null,
        amazon_seller_id: form.amazon_seller_id || null,
        account_label: form.account_label || null,
        is_default: form.is_default,
        notes: form.notes || null,
      }
      const res = await fetch(`${BACKEND}/dropship/account-suppliers`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setShowModal(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function handleUnlink(linkId: string) {
    const ok = await confirm({
      title: 'Desvincular conta?',
      message: 'Histórico de pedidos antigos é preservado, mas pedidos novos NÃO serão mais atribuídos a este parceiro.',
      confirmLabel: 'Desvincular',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/account-suppliers/${linkId}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : 'Erro ao desvincular')
    }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Vínculo Conta ↔ Parceiro</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Mapeie qual parceiro despacha pelos pedidos de cada conta de marketplace
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(EMPTY_FORM); setFormErr('') }}
          disabled={partners.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: '#00E5FF', color: '#09090b', opacity: partners.length === 0 ? 0.5 : 1 }}
        >
          <Plus size={15} />
          Novo Vínculo
        </button>
      </div>

      {/* explainer card */}
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <Link2 size={18} style={{ color: '#00E5FF' }} className="mt-0.5 shrink-0" />
        <div className="text-sm text-zinc-300">
          <p className="font-medium text-white mb-1">Como funciona</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Quando entra um pedido de uma conta marketplace (ML/Shopee/Amazon), o sistema busca o parceiro vinculado nessa tabela e cria a identificação dropship com o supplier correto. Pra desvincular, usamos <code>active_until</code> (não DELETE) — pedidos antigos mantêm referência histórica.
          </p>
        </div>
      </div>

      {/* alerts */}
      {pageErr && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {pageErr}
        </div>
      )}

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['all', 'mercado_livre', 'shopee', 'amazon', 'magalu', 'others'] as const).map(m => (
            <button
              key={m}
              onClick={() => setFilterMarketplace(m)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterMarketplace === m ? '#00E5FF' : 'transparent',
                color: filterMarketplace === m ? '#09090b' : '#a1a1aa',
              }}
            >
              {m === 'all' ? 'Todos' : MARKETPLACE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {['Marketplace', 'Conta', 'ID', 'Parceiro', 'Default', 'Desde', 'Ativo Até', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : links.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  {partners.length === 0 ? (
                    <>
                      Cadastre um <Link href="/dashboard/dropship/partners" style={{ color: '#00E5FF' }}>parceiro</Link> antes de criar vínculos.
                    </>
                  ) : (
                    <>
                      Nenhum vínculo cadastrado.{' '}
                      <button onClick={() => setShowModal(true)} style={{ color: '#00E5FF' }}>Criar o primeiro</button>
                    </>
                  )}
                </td>
              </tr>
            ) : links.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3">
                  <MarketplacePill marketplace={l.marketplace} />
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{l.account_label ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs font-mono">
                  {l.seller_id ?? l.shopee_shop_id ?? l.amazon_seller_id ?? '—'}
                </td>
                <td className="px-4 py-3 font-medium text-white">{l.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  {l.is_default ? (
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{
                      background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)',
                    }}>
                      Default
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDate(l.active_since)}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {l.active_until ? (
                    <span style={{ color: '#71717a' }}>{fmtDate(l.active_until)}</span>
                  ) : (
                    <span style={{ color: '#22c55e' }}>Ativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!l.active_until && (
                    <button
                      onClick={() => handleUnlink(l.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                      title="Desvincular"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal novo vínculo */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !saving && setShowModal(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md flex flex-col overflow-hidden"
            style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-2">
                <Link2 size={18} style={{ color: '#00E5FF' }} />
                <h2 className="text-white font-semibold">Novo Vínculo</h2>
              </div>
              <button onClick={() => !saving && setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className={lbl}>Parceiro *</label>
                <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className={inp}>
                  <option value="">— Selecione —</option>
                  {partners.map(p => (
                    <option key={p.supplier_id} value={p.supplier_id}>{p.suppliers?.name ?? p.supplier_id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>Marketplace *</label>
                <select value={form.marketplace} onChange={e => setForm(f => ({ ...f, marketplace: e.target.value as NewLinkForm['marketplace'] }))} className={inp}>
                  {Object.entries(MARKETPLACE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>Conta conectada *</label>
                {loadingAccounts ? (
                  <div className={inp + ' flex items-center gap-2 text-zinc-500'}>
                    <Loader2 size={14} className="animate-spin" />
                    Buscando contas conectadas...
                  </div>
                ) : connectedAccounts.length === 0 ? (
                  <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
                    background: 'rgba(252,211,77,0.10)',
                    color: '#fcd34d',
                    border: '1px solid rgba(252,211,77,0.3)',
                  }}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">Nenhuma conta {MARKETPLACE_LABELS[form.marketplace]} conectada</p>
                      <p className="text-zinc-400 mt-1">
                        Conecte uma conta primeiro em{' '}
                        <Link href="/dashboard/integracoes" className="underline" style={{ color: '#00E5FF' }} onClick={() => setShowModal(false)}>
                          Configurações &gt; Integrações
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedAccountValue}
                      onChange={e => selectAccount(e.target.value)}
                      className={inp}
                    >
                      <option value="">— Selecione a conta —</option>
                      {connectedAccounts.map(acc => (
                        <option key={`${acc.id_field}:${acc.id_value}`} value={acc.id_value}>
                          {acc.nickname ? `${acc.nickname}` : '(sem apelido)'}
                          {' · '}
                          {acc.id_field === 'seller_id' ? 'Seller ID' :
                           acc.id_field === 'shopee_shop_id' ? 'Shop ID' :
                           'Seller ID Amazon'}{' '}
                          {acc.id_value}
                          {acc.already_linked ? ' [já vinculada]' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">
                      {connectedAccounts.length} {connectedAccounts.length === 1 ? 'conta' : 'contas'} conectada{connectedAccounts.length !== 1 ? 's' : ''}.
                      Vinculadas em vermelho já têm parceiro ativo.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label className={lbl}>Apelido da conta</label>
                <input value={form.account_label} onChange={e => setForm(f => ({ ...f, account_label: e.target.value }))} className={inp} placeholder="Ex: Vazzo Principal, EsLar Loja" />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="default"
                  checked={form.is_default}
                  onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                  className="w-4 h-4 accent-[#00E5FF]"
                />
                <label htmlFor="default" className="text-sm text-zinc-400 cursor-pointer">
                  Vínculo default (1 conta = 1 parceiro principal)
                </label>
              </div>

              <div>
                <label className={lbl}>Observações</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inp + ' resize-none'} />
              </div>
            </form>

            <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
              {formErr && (
                <div className="rounded-lg p-2 text-xs flex-1" style={{
                  background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
                }}>{formErr}</div>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => !saving && setShowModal(false)} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white transition-colors" style={{ border: '1px solid #27272a' }}>Cancelar</button>
                <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : 'Criar Vínculo'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function MarketplacePill({ marketplace }: { marketplace: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    mercado_livre: { bg: 'rgba(255,224,0,0.10)',  fg: '#fde047' },  // ML amarelo
    shopee:        { bg: 'rgba(255,107,53,0.10)', fg: '#fb923c' },  // Shopee laranja
    amazon:        { bg: 'rgba(255,153,0,0.10)',  fg: '#fb923c' },  // Amazon laranja
    magalu:        { bg: 'rgba(0,116,255,0.10)',  fg: '#60a5fa' },  // Magalu azul
    others:        { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa' },
  }
  const c = colors[marketplace] ?? colors.others
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.fg}33` }}>
      {MARKETPLACE_LABELS[marketplace] ?? marketplace}
    </span>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
