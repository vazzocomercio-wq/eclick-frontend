'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Plus, Building2, Store, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { fulfillmentApi, type FulfillmentCompany, type FulfillmentAccount, type CompanyRole } from '../_lib/api'
import { CompanyFiscalPanel } from './CompanyFiscalPanel'

const ROLES: Array<{ key: CompanyRole; label: string }> = [
  { key: 'matriz', label: 'Matriz (dona do estoque)' },
  { key: 'revendedora', label: 'Revendedora' },
  { key: 'unica', label: 'Única' },
]
const platformColor = (p: string) => p === 'mercadolivre' ? '#FFE600' : p === 'loja' ? '#00E5FF' : p === 'b2b' ? '#4ADE50' : '#a1a1aa'
const fmtCnpj = (d: string | null) => {
  if (!d) return ''
  const s = d.replace(/\D/g, '')
  if (s.length !== 14) return d
  return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`
}

/**
 * Empresas (CNPJs) & Contas de canal (Onda A). Cada pedido pertence a uma conta
 * (ex.: conta ML) que pertence a uma empresa (CNPJ). As contas são criadas
 * sozinhas quando chega o 1º pedido — aqui o lojista preenche CNPJ/papel e liga
 * cada conta à empresa certa. Fundação do faturador dropship (futuro).
 */
export function CompaniesSheet({ onClose }: { onClose: () => void }) {
  const [companies, setCompanies] = useState<FulfillmentCompany[]>([])
  const [accounts, setAccounts] = useState<FulfillmentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [fiscalOpen, setFiscalOpen] = useState<Record<string, boolean>>({})

  async function reload() {
    setLoading(true)
    try {
      const [c, a] = await Promise.all([fulfillmentApi.companies(), fulfillmentApi.accounts()])
      setCompanies(c); setAccounts(a); setErr(null)
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [])

  async function addCompany() {
    if (!newName.trim()) return
    setBusy(true); setErr(null)
    try { await fulfillmentApi.createCompany({ name: newName.trim() }); setNewName(''); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function patchCompany(id: string, patch: { name?: string; cnpj?: string | null; role?: CompanyRole }) {
    setCompanies((p) => p.map((c) => c.id === id ? { ...c, ...patch } as FulfillmentCompany : c))
    try { await fulfillmentApi.updateCompany(id, patch) } catch (e) { setErr((e as Error).message) }
  }
  async function linkAccount(id: string, companyId: string) {
    setAccounts((p) => p.map((a) => a.id === id ? { ...a, company_id: companyId } : a))
    try { await fulfillmentApi.updateAccount(id, { company_id: companyId }) } catch (e) { setErr((e as Error).message) }
  }
  async function setAccountPct(id: string, field: 'invoice_sale_pct' | 'invoice_purchase_pct', raw: string) {
    const val = raw.trim() === '' ? null : Math.min(Math.max(Number(raw.replace(',', '.')) || 0, 0), 100)
    setAccounts((p) => p.map((a) => a.id === id ? { ...a, [field]: val } : a))
    try { await fulfillmentApi.updateAccount(id, { [field]: val }) } catch (e) { setErr((e as Error).message) }
  }

  const nameOf = (cid: string | null) => companies.find((c) => c.id === cid)?.name ?? '—'

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Empresas & Contas</h2>
          <button onClick={onClose} className="rounded-xl p-2" style={{ background: '#0c0c10' }}><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs" style={{ color: '#71717a' }}>Organize por CNPJ e conta de canal. As contas aparecem sozinhas quando chega o 1º pedido.</p>

        {err && <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 size={24} className="animate-spin" color="#00E5FF" /></div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Empresas */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: '#a1a1aa' }}><Building2 size={15} /> Empresas (CNPJ)</h3>
              <div className="flex flex-col gap-2">
                {companies.map((c) => (
                  <div key={c.id} className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <input
                      defaultValue={c.name}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && patchCompany(c.id, { name: e.target.value.trim() })}
                      className="mb-2 w-full bg-transparent text-sm font-semibold outline-none"
                      style={{ color: '#fafafa' }}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        defaultValue={fmtCnpj(c.cnpj)}
                        placeholder="CNPJ"
                        onBlur={(e) => patchCompany(c.id, { cnpj: e.target.value })}
                        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
                      />
                      <select
                        value={c.role}
                        onChange={(e) => patchCompany(c.id, { role: e.target.value as CompanyRole })}
                        className="rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    </div>
                    {/* Config fiscal (NF-e) — Faturador F1 */}
                    <button onClick={() => setFiscalOpen((p) => ({ ...p, [c.id]: !p[c.id] }))} className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#00E5FF0f', color: '#00E5FF' }}>
                      <FileText size={13} /> Config fiscal (NF-e) {fiscalOpen[c.id] ? <ChevronDown size={13} className="ml-auto" /> : <ChevronRight size={13} className="ml-auto" />}
                    </button>
                    {fiscalOpen[c.id] && <CompanyFiscalPanel companyId={c.id} />}
                  </div>
                ))}
                {/* nova empresa */}
                <div className="flex gap-2">
                  <input
                    value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nova empresa (nome)"
                    className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button onClick={addCompany} disabled={!newName.trim() || busy} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
            </section>

            {/* Contas */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: '#a1a1aa' }}><Store size={15} /> Contas de canal</h3>
              <div className="flex flex-col gap-2">
                {accounts.length === 0 && <p className="text-sm" style={{ color: '#71717a' }}>Nenhuma conta ainda. Elas aparecem sozinhas quando o 1º pedido entra.</p>}
                {accounts.map((a) => (
                  <div key={a.id} className="rounded-xl p-3" style={{ background: '#0c0c10' }}>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${platformColor(a.platform)}1a`, color: platformColor(a.platform) }}>{a.platform}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{a.label || a.external_account_id}</div>
                        <div className="truncate text-xs" style={{ color: '#71717a' }}>empresa: {nameOf(a.company_id)}</div>
                      </div>
                      <select
                        value={a.company_id ?? ''}
                        onChange={(e) => e.target.value && linkAccount(a.id, e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={{ background: '#18181b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.12)' }}
                      >
                        <option value="">— empresa —</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {/* % de faturamento por conta (sobrescreve o padrão da empresa; vazio = usa o padrão) */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: '#52525b' }}>% faturamento desta conta:</span>
                      <label className="flex items-center gap-1 text-[11px]" style={{ color: '#71717a' }}>
                        venda
                        <input type="number" min={0} max={100} defaultValue={a.invoice_sale_pct ?? ''} placeholder="padrão"
                          onBlur={(e) => setAccountPct(a.id, 'invoice_sale_pct', e.target.value)}
                          className="w-16 rounded-lg px-2 py-1 text-center text-xs outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </label>
                      <label className="flex items-center gap-1 text-[11px]" style={{ color: '#71717a' }}>
                        compra
                        <input type="number" min={0} max={100} defaultValue={a.invoice_purchase_pct ?? ''} placeholder="padrão"
                          onBlur={(e) => setAccountPct(a.id, 'invoice_purchase_pct', e.target.value)}
                          className="w-16 rounded-lg px-2 py-1 text-center text-xs outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
