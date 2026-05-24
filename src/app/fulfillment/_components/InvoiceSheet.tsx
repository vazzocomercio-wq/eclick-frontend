'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Loader2, FileText, Plus, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react'
import { fulfillmentApi, type FulfillmentInvoice } from '../_lib/api'

const KIND_LABEL: Record<string, string> = { venda: 'Venda → consumidor', transferencia: 'Transferência (matriz→revenda)', devolucao: 'Devolução', outra: 'Outra' }
const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', issued: 'Emitida', cancelled: 'Cancelada' }

/**
 * NF-e (preparação — Onda D). Anexa nota(s) ao pedido e VALIDA que os itens da
 * nota batem com o que foi separado. Ainda NÃO emite (provedor decidido depois).
 */
export function InvoiceSheet({ fulfillmentOrderId, reference, onClose }: { fulfillmentOrderId: string; reference: string; onClose: () => void }) {
  const [list, setList] = useState<FulfillmentInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setList(await fulfillmentApi.invoices(fulfillmentOrderId)); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [fulfillmentOrderId])

  useEffect(() => { void reload() }, [reload])

  async function createDraft() {
    setBusy(true); setErr(null)
    try { await fulfillmentApi.upsertInvoice(fulfillmentOrderId, { kind: 'venda' }); await reload() } // itens vêm do pedido
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function patch(id: string, body: Parameters<typeof fulfillmentApi.upsertInvoice>[1]) {
    try { await fulfillmentApi.upsertInvoice(fulfillmentOrderId, { id, ...body }); await reload() }
    catch (e) { setErr((e as Error).message) }
  }
  async function validate(id: string) {
    setBusy(true); setErr(null)
    try { await fulfillmentApi.validateInvoice(id); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true)
    try { await fulfillmentApi.removeInvoice(id); await reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl p-5" style={{ background: '#121214' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={18} color="#00E5FF" /> NF-e · #{reference}</h2>
          <button onClick={onClose} className="rounded-xl p-2" style={{ background: '#0c0c10' }}><X size={18} /></button>
        </div>
        <p className="mb-4 text-xs" style={{ color: '#71717a' }}>Preparação fiscal — ainda não emite. Valide que os itens da nota batem com o separado antes de liberar a coleta.</p>

        {err && <div className="mb-3 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 size={24} className="animate-spin" color="#00E5FF" /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.length === 0 && <p className="text-sm" style={{ color: '#71717a' }}>Nenhuma nota anexada a este pedido.</p>}

            {list.map((inv) => {
              const v = inv.validation_status
              const vColor = v === 'match' ? '#4ADE50' : v === 'mismatch' ? '#f87171' : '#71717a'
              return (
                <div key={inv.id} className="rounded-2xl p-3" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#00E5FF1a', color: '#00E5FF' }}>{KIND_LABEL[inv.kind] ?? inv.kind}</span>
                    <span className="text-xs" style={{ color: '#71717a' }}>{STATUS_LABEL[inv.status] ?? inv.status}</span>
                    <button onClick={() => remove(inv.id)} disabled={busy} className="ml-auto rounded-lg p-1.5" style={{ background: '#18181b' }} aria-label="Remover"><Trash2 size={14} color="#f87171" /></button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input defaultValue={inv.number ?? ''} placeholder="Número"
                      onBlur={(e) => e.target.value !== (inv.number ?? '') && patch(inv.id, { number: e.target.value })}
                      className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                    <input defaultValue={inv.access_key ?? ''} placeholder="Chave de acesso (44 díg.)"
                      onBlur={(e) => e.target.value !== (inv.access_key ?? '') && patch(inv.id, { accessKey: e.target.value })}
                      className="flex-[2] rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                  </div>

                  {/* itens */}
                  <div className="mt-2 rounded-lg p-2" style={{ background: '#09090b' }}>
                    <p className="mb-1 text-[11px] font-semibold" style={{ color: '#71717a' }}>Itens da nota</p>
                    {(inv.items ?? []).map((it, i) => (
                      <div key={i} className="flex justify-between text-xs" style={{ color: '#a1a1aa' }}>
                        <span className="font-mono">{it.sku}</span><span>{it.qty}x</span>
                      </div>
                    ))}
                  </div>

                  {/* validação */}
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => validate(inv.id)} disabled={busy}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Validar conferência
                    </button>
                    {v !== 'not_checked' && (
                      <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: vColor }}>
                        {v === 'match' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                        {v === 'match' ? 'Confere com o separado' : 'Divergência'}
                      </span>
                    )}
                  </div>

                  {/* diff */}
                  {inv.validation_status === 'mismatch' && inv.validation_diff && (
                    <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {inv.validation_diff.filter((d) => !d.ok).map((d) => (
                        <div key={d.sku} className="flex justify-between text-xs" style={{ color: '#f87171' }}>
                          <span className="font-mono">{d.sku}</span>
                          <span>nota {d.invoiceQty} × separado {d.pickedQty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <button onClick={createDraft} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50" style={{ background: '#18181b', color: '#00E5FF', border: '1px solid #00E5FF44' }}>
              <Plus size={16} /> Anexar NF-e (rascunho com os itens do pedido)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
