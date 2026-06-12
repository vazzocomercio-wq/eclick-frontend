'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Tag, Zap, ChevronRight, ChevronLeft, AlertTriangle, ShieldCheck,
  ShieldAlert, ShieldX, Sparkles, Loader2, Check, Store, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 — Wizard de criação de Voucher / Oferta Relâmpago direto do painel.
 *  Fluxo: config → produtos → preview da trava de margem → confirmação em
 *  2 cliques. Margem negativa = bloqueada no servidor; 0-5% = aviso com
 *  confirmação extra (accept_warning). */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'

async function token(): Promise<string> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? ''
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await token()}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { message?: string | string[] })?.message?.toString() ?? `HTTP ${res.status}`)
  return body as T
}

type Vehicle = 'voucher' | 'flash_sale'

interface Shop { shop_id: number; nickname: string | null }
interface LinkedItem {
  item_id: number; shop_id: number | null; title: string | null
  thumbnail: string | null; price: number | null; linked: boolean
  product: { id: string; cost_price: number | null } | null
  margin: { contribution_margin_pct: number } | null
}
interface Slot { timeslot_id: number; start_time: number; end_time: number }
interface PreviewItem { item_id: number; title: string | null; price: number | null; projected_margin_pct: number; verdict: 'ok' | 'warning' | 'blocked' }
interface Preview {
  verdict: 'ok' | 'warning' | 'blocked'; message: string; floor_pct: number
  total_items: number; blocked_count: number; warning_count: number; items: PreviewItem[]
}
interface Suggestion { item_id: number; suggested_pct: number; max_safe_pct: number; rationale: string }

export default function PromoWizardModal({ vehicle, onClose, onCreated }: {
  vehicle: Vehicle
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslations('shopeeCampaigns.wizard')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // dados compartilhados
  const [shops, setShops] = useState<Shop[] | null>(null)
  const [writeEnabled, setWriteEnabled] = useState(true)
  const [shopId, setShopId] = useState<number | null>(null)
  const [items, setItems] = useState<LinkedItem[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')

  // voucher
  const [vName, setVName] = useState('')
  const [vCode, setVCode] = useState('')
  const [vScope, setVScope] = useState<1 | 2>(2)        // 1 loja toda, 2 produtos
  const [vRewardType, setVRewardType] = useState<1 | 2>(2) // 1 R$, 2 %
  const [vPct, setVPct] = useState(10)
  const [vAmount, setVAmount] = useState(10)
  const [vMaxPrice, setVMaxPrice] = useState(0)
  const [vMinBasket, setVMinBasket] = useState(0)
  const [vQty, setVQty] = useState(100)
  const [vStart, setVStart] = useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)))
  const [vEnd, setVEnd] = useState(() => toLocalInput(new Date(Date.now() + 8 * 86400 * 1000)))

  // flash sale
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotId, setSlotId] = useState<number | null>(null)
  const [flashPct, setFlashPct] = useState<Map<number, number>>(new Map())
  const [suggestions, setSuggestions] = useState<Map<number, Suggestion>>(new Map())
  const [suggesting, setSuggesting] = useState(false)

  // preview / confirm
  const [preview, setPreview] = useState<Preview | null>(null)
  const [acceptWarning, setAcceptWarning] = useState(false)
  const [armed, setArmed] = useState(false) // 2º clique
  const [done, setDone] = useState<string | null>(null)

  const isFlash = vehicle === 'flash_sale'
  const needsProducts = isFlash || vScope === 2

  // carrega lojas
  useEffect(() => {
    api<{ shops: Shop[]; write_enabled: boolean }>('/shopee/promos/shops')
      .then(r => {
        setShops(r.shops); setWriteEnabled(r.write_enabled)
        if (r.shops.length === 1) setShopId(r.shops[0].shop_id)
      })
      .catch(e => setError((e as Error).message))
  }, [])

  // carrega anúncios vinculados (com margem) quando a loja resolve
  useEffect(() => {
    if (shopId == null) return
    setItems(null)
    api<{ items: LinkedItem[] }>('/shopee/listings/link-status')
      .then(r => setItems((r.items ?? []).filter(i =>
        i.linked && i.product?.cost_price != null && i.price != null && i.price > 0
        && (i.shop_id == null || Number(i.shop_id) === Number(shopId)))))
      .catch(e => setError((e as Error).message))
  }, [shopId])

  // carrega slots da flash sale
  useEffect(() => {
    if (!isFlash || shopId == null) return
    setSlots(null)
    api<{ slots: Slot[] }>(`/shopee/promos/flash-slots?shop_id=${shopId}`)
      .then(r => setSlots(r.slots))
      .catch(e => setError((e as Error).message))
  }, [isFlash, shopId])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (items ?? []).filter(i => !q || (i.title ?? '').toLowerCase().includes(q) || String(i.item_id).includes(q))
  }, [items, search])

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 50) next.add(id)
      return next
    })
    setPreview(null); setArmed(false)
  }

  const askSuggestions = useCallback(async () => {
    if (!selected.size) return
    setSuggesting(true); setError(null)
    try {
      const r = await api<{ suggestions: Suggestion[] }>('/shopee/promos/suggest', {
        method: 'POST',
        body: JSON.stringify({ item_ids: [...selected], vehicle }),
      })
      const map = new Map(r.suggestions.map(s => [s.item_id, s]))
      setSuggestions(map)
      if (isFlash) {
        setFlashPct(prev => {
          const next = new Map(prev)
          for (const s of r.suggestions) next.set(s.item_id, s.suggested_pct)
          return next
        })
      } else if (vRewardType === 2 && r.suggestions.length) {
        // voucher: usa a mediana das sugestões como % único
        const ps = r.suggestions.map(s => s.suggested_pct).sort((a, b) => a - b)
        setVPct(Math.max(1, ps[Math.floor(ps.length / 2)]))
      }
    } catch (e) { setError((e as Error).message) }
    setSuggesting(false)
  }, [selected, vehicle, isFlash, vRewardType])

  const runPreview = useCallback(async () => {
    setBusy(true); setError(null); setPreview(null); setAcceptWarning(false); setArmed(false)
    try {
      if (isFlash) {
        const body = {
          shop_id: shopId,
          items: [...selected].map(id => ({ item_id: id, discount_pct: flashPct.get(id) ?? 10 })),
        }
        const r = await api<Preview>('/shopee/promos/flash-sale/preview', { method: 'POST', body: JSON.stringify(body) })
        setPreview(r)
      } else {
        const r = await api<Preview>('/shopee/promos/voucher/preview', { method: 'POST', body: JSON.stringify(voucherBody()) })
        setPreview(r)
      }
      setStep(2)
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlash, shopId, selected, flashPct, vScope, vRewardType, vPct, vAmount, vMaxPrice, vMinBasket])

  function voucherBody() {
    return {
      shop_id: shopId,
      voucher_type: vScope,
      reward_type: vRewardType,
      percentage: vRewardType === 2 ? vPct : undefined,
      discount_amount: vRewardType === 1 ? vAmount : undefined,
      max_price: vRewardType === 2 && vMaxPrice > 0 ? vMaxPrice : undefined,
      min_basket_price: vMinBasket,
      item_ids: vScope === 2 ? [...selected] : undefined,
    }
  }

  const create = useCallback(async () => {
    if (!armed) { setArmed(true); return } // 1º clique arma, 2º cria
    setBusy(true); setError(null)
    try {
      if (isFlash) {
        const r = await api<{ flash_sale_id: number }>('/shopee/promos/flash-sale', {
          method: 'POST',
          body: JSON.stringify({
            shop_id: shopId, timeslot_id: slotId,
            items: [...selected].map(id => ({ item_id: id, discount_pct: flashPct.get(id) ?? 10 })),
            accept_warning: acceptWarning,
          }),
        })
        setDone(t('doneFlash', { id: r.flash_sale_id }))
      } else {
        const r = await api<{ voucher_id: number }>('/shopee/promos/voucher', {
          method: 'POST',
          body: JSON.stringify({
            ...voucherBody(),
            name: vName, code: vCode,
            start_time: Math.floor(new Date(vStart).getTime() / 1000),
            end_time: Math.floor(new Date(vEnd).getTime() / 1000),
            usage_quantity: vQty,
            accept_warning: acceptWarning,
          }),
        })
        setDone(t('doneVoucher', { id: r.voucher_id }))
      }
      onCreated()
    } catch (e) { setError((e as Error).message); setArmed(false) }
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, isFlash, shopId, slotId, selected, flashPct, acceptWarning, vName, vCode, vStart, vEnd, vQty, vScope, vRewardType, vPct, vAmount, vMaxPrice, vMinBasket, onCreated, t])

  const canLeaveStep0 = isFlash
    ? shopId != null && slotId != null
    : shopId != null && vName.trim().length > 0 && /^[A-Za-z0-9]{1,5}$/.test(vCode) && vStart < vEnd
      && (vRewardType === 2 ? vPct >= 1 && vPct <= 99 : vAmount > 0)
  const canPreview = needsProducts ? selected.size > 0 : true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: '#111114', border: '1px solid #2e2e33' }}>

        {/* header */}
        <div className="flex items-center gap-3 p-4 border-b sticky top-0 z-10" style={{ borderColor: '#1e1e24', background: '#111114' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: isFlash ? 'rgba(251,191,36,0.15)' : 'rgba(167,139,250,0.15)', color: isFlash ? '#fbbf24' : '#a78bfa' }}>
            {isFlash ? <Zap size={16} /> : <Tag size={16} />}
          </div>
          <div className="flex-1">
            <h3 className="text-white text-sm font-semibold">{isFlash ? t('titleFlash') : t('titleVoucher')}</h3>
            <p className="text-[11px] text-zinc-500">{t('steps', { n: step + 1 })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#a1a1aa' }}><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {!writeEnabled && (
            <Banner color="#fcd34d" icon={<AlertTriangle size={13} />} text={t('gateOff')} />
          )}
          {error && <Banner color="#f87171" icon={<AlertTriangle size={13} />} text={error} />}

          {done ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                <Check size={22} />
              </div>
              <p className="text-sm font-semibold text-zinc-100">{done}</p>
              <p className="text-xs text-zinc-500">{t('doneHint')}</p>
              <button onClick={onClose} className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}40` }}>{t('close')}</button>
            </div>
          ) : (
            <>
              {/* STEP 0 — configuração */}
              {step === 0 && (
                <div className="space-y-4">
                  {/* loja */}
                  {shops && shops.length > 1 && (
                    <Field label={t('shop')}>
                      <div className="flex flex-wrap gap-2">
                        {shops.map(s => (
                          <Choice key={s.shop_id} active={shopId === s.shop_id} onClick={() => { setShopId(s.shop_id); setSelected(new Set()); setPreview(null) }}
                            icon={<Store size={12} />} label={s.nickname ?? String(s.shop_id)} />
                        ))}
                      </div>
                    </Field>
                  )}

                  {isFlash ? (
                    <Field label={t('slot')}>
                      {slots === null ? <Skeleton /> : slots.length === 0 ? (
                        <p className="text-xs text-zinc-500">{t('noSlots')}</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {slots.map(s => (
                            <Choice key={s.timeslot_id} active={slotId === s.timeslot_id} onClick={() => setSlotId(s.timeslot_id)}
                              icon={<Clock size={12} />} label={formatSlot(s)} />
                          ))}
                        </div>
                      )}
                    </Field>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('vName')}>
                          <input value={vName} onChange={e => setVName(e.target.value)} maxLength={100} placeholder={t('vNamePh')} className="inp" style={inp} />
                        </Field>
                        <Field label={t('vCode')} hint={t('vCodeHint')}>
                          <input value={vCode} onChange={e => setVCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} placeholder="EX: PROMO" className="inp" style={inp} />
                        </Field>
                      </div>
                      <Field label={t('vScope')}>
                        <div className="flex gap-2">
                          <Choice active={vScope === 2} onClick={() => { setVScope(2); setPreview(null) }} label={t('vScopeProducts')} />
                          <Choice active={vScope === 1} onClick={() => { setVScope(1); setPreview(null) }} label={t('vScopeShop')} />
                        </div>
                        {vScope === 1 && <p className="text-[11px] text-zinc-500 mt-1.5">{t('vScopeShopHint')}</p>}
                      </Field>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label={t('vRewardType')}>
                          <div className="flex gap-2">
                            <Choice active={vRewardType === 2} onClick={() => setVRewardType(2)} label="%" />
                            <Choice active={vRewardType === 1} onClick={() => setVRewardType(1)} label="R$" />
                          </div>
                        </Field>
                        {vRewardType === 2 ? (
                          <>
                            <Field label={t('vPct')}>
                              <input type="number" min={1} max={99} value={vPct} onChange={e => { setVPct(Number(e.target.value)); setPreview(null) }} style={inp} />
                            </Field>
                            <Field label={t('vMaxPrice')} hint={t('optional')}>
                              <input type="number" min={0} value={vMaxPrice} onChange={e => setVMaxPrice(Number(e.target.value))} style={inp} />
                            </Field>
                          </>
                        ) : (
                          <Field label={t('vAmount')}>
                            <input type="number" min={0.01} step={0.5} value={vAmount} onChange={e => { setVAmount(Number(e.target.value)); setPreview(null) }} style={inp} />
                          </Field>
                        )}
                        <Field label={t('vMinBasket')}>
                          <input type="number" min={0} value={vMinBasket} onChange={e => { setVMinBasket(Number(e.target.value)); setPreview(null) }} style={inp} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label={t('vStart')}>
                          <input type="datetime-local" value={vStart} onChange={e => setVStart(e.target.value)} style={inp} />
                        </Field>
                        <Field label={t('vEnd')}>
                          <input type="datetime-local" value={vEnd} onChange={e => setVEnd(e.target.value)} style={inp} />
                        </Field>
                        <Field label={t('vQty')} hint={t('vQtyHint')}>
                          <input type="number" min={1} value={vQty} onChange={e => setVQty(Number(e.target.value))} style={inp} />
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 1 — produtos */}
              {step === 1 && needsProducts && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPh')} className="flex-1" style={inp} />
                    <button onClick={askSuggestions} disabled={!selected.size || suggesting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0 disabled:opacity-40"
                      style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}40` }}>
                      {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {t('aiSuggest')}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500">{t('selectedCount', { n: selected.size })}</p>
                  {items === null ? <Skeleton /> : filteredItems.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-6 text-center">{t('noLinkedItems')}</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[44vh] overflow-y-auto pr-1">
                      {filteredItems.map(i => {
                        const checked = selected.has(i.item_id)
                        const sug = suggestions.get(i.item_id)
                        const m = i.margin?.contribution_margin_pct
                        return (
                          <div key={i.item_id} onClick={() => toggleItem(i.item_id)}
                            className="flex items-center gap-3 p-2 rounded-xl cursor-pointer"
                            style={{ background: checked ? `${CYAN}0d` : '#18181b', border: `1px solid ${checked ? CYAN + '55' : '#27272a'}` }}>
                            <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{ background: checked ? CYAN : 'transparent', border: `1px solid ${checked ? CYAN : '#3f3f46'}` }}>
                              {checked && <Check size={11} color="#09090b" strokeWidth={3} />}
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {i.thumbnail ? <img src={i.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" /> :
                              <div className="w-9 h-9 rounded-lg shrink-0" style={{ background: '#27272a' }} />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-zinc-200 truncate">{i.title ?? i.item_id}</p>
                              <p className="text-[10px] text-zinc-500">
                                {formatBRL(i.price ?? 0)}
                                {m != null && <> · {t('marginNow')} <span style={{ color: marginColor(m) }}>{m.toFixed(1)}%</span></>}
                              </p>
                              {sug && checked && <p className="text-[10px] mt-0.5" style={{ color: CYAN }}>✨ {sug.suggested_pct}% — {sug.rationale}</p>}
                            </div>
                            {isFlash && checked && (
                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                <input type="number" min={1} max={90} value={flashPct.get(i.item_id) ?? 10}
                                  onChange={e => { setFlashPct(prev => new Map(prev).set(i.item_id, Number(e.target.value))); setPreview(null); setArmed(false) }}
                                  className="w-14 text-center" style={{ ...inp, padding: '4px 6px' }} />
                                <span className="text-[10px] text-zinc-500">% OFF</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 — preview + confirmação */}
              {step === 2 && preview && (
                <div className="space-y-3">
                  <VerdictBanner preview={preview} t={t} />
                  <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-1">
                    {preview.items.slice().sort((a, b) => a.projected_margin_pct - b.projected_margin_pct).map(i => (
                      <div key={i.item_id} className="flex items-center gap-3 p-2 rounded-lg"
                        style={{ background: '#18181b', border: '1px solid #27272a' }}>
                        <VerdictIcon verdict={i.verdict} />
                        <p className="text-xs text-zinc-300 flex-1 truncate">{i.title ?? i.item_id}</p>
                        <p className="text-xs font-bold shrink-0" style={{ color: marginColor(i.projected_margin_pct) }}>
                          {i.projected_margin_pct.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                  {preview.verdict === 'warning' && (
                    <label className="flex items-start gap-2 p-3 rounded-xl cursor-pointer"
                      style={{ background: 'rgba(252,211,77,0.07)', border: '1px solid rgba(252,211,77,0.3)' }}>
                      <input type="checkbox" checked={acceptWarning} onChange={e => { setAcceptWarning(e.target.checked); setArmed(false) }} className="mt-0.5" />
                      <span className="text-[11px] text-amber-200">{t('acceptWarning')}</span>
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        {!done && (
          <div className="flex items-center gap-2 p-4 border-t sticky bottom-0" style={{ borderColor: '#1e1e24', background: '#111114' }}>
            {step > 0 && (
              <button onClick={() => { setStep(step - 1); setArmed(false) }} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ border: '1px solid #2e2e33', color: '#a1a1aa' }}>
                <ChevronLeft size={13} /> {t('back')}
              </button>
            )}
            <div className="flex-1" />
            {step === 0 && (
              <button disabled={!canLeaveStep0} onClick={() => setStep(needsProducts ? 1 : 2)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}40` }}>
                {t('next')} <ChevronRight size={13} />
              </button>
            )}
            {step === 1 && (
              <button disabled={!canPreview || busy} onClick={runPreview}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}40` }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                {t('previewBtn')}
              </button>
            )}
            {step === 2 && !needsProducts && !preview && (
              <button disabled={busy} onClick={runPreview}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}40` }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                {t('previewBtn')}
              </button>
            )}
            {step === 2 && preview && preview.verdict !== 'blocked' && (
              <button disabled={busy || !writeEnabled || (preview.verdict === 'warning' && !acceptWarning)} onClick={create}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
                style={armed
                  ? { background: '#34d399', color: '#09090b' }
                  : { background: `${CYAN}18`, color: CYAN, border: `1px solid ${CYAN}40` }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {armed ? t('confirmBtn') : (isFlash ? t('createFlashBtn') : t('createVoucherBtn'))}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── sub-componentes ──────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
        {label}{hint && <span className="ml-1 normal-case font-normal text-zinc-600">({hint})</span>}
      </p>
      {children}
    </div>
  )
}

function Choice({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
      style={{
        background: active ? CYAN + '18' : '#18181b',
        color: active ? CYAN : '#a1a1aa',
        border: `1px solid ${active ? CYAN + '55' : '#27272a'}`,
      }}>
      {icon}{label}
    </button>
  )
}

function Banner({ color, icon, text }: { color: string; icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-lg p-3 text-xs flex items-start gap-2"
      style={{ background: `${color}14`, color, border: `1px solid ${color}45` }}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

function VerdictBanner({ preview, t }: { preview: Preview; t: ReturnType<typeof useTranslations> }) {
  const map = {
    ok:      { color: '#34d399', icon: <ShieldCheck size={14} />, title: t('verdictOk') },
    warning: { color: '#fcd34d', icon: <ShieldAlert size={14} />, title: t('verdictWarning') },
    blocked: { color: '#f87171', icon: <ShieldX size={14} />,     title: t('verdictBlocked') },
  }[preview.verdict]
  return (
    <div className="rounded-xl p-3" style={{ background: `${map.color}10`, border: `1px solid ${map.color}40` }}>
      <div className="flex items-center gap-2" style={{ color: map.color }}>
        {map.icon}
        <p className="text-xs font-bold">{map.title}</p>
      </div>
      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: map.color }}>{preview.message}</p>
      <p className="text-[10px] text-zinc-500 mt-1.5">{t('floorInfo', { pct: preview.floor_pct })}</p>
    </div>
  )
}

function VerdictIcon({ verdict }: { verdict: 'ok' | 'warning' | 'blocked' }) {
  if (verdict === 'blocked') return <ShieldX size={13} color="#f87171" className="shrink-0" />
  if (verdict === 'warning') return <ShieldAlert size={13} color="#fcd34d" className="shrink-0" />
  return <ShieldCheck size={13} color="#34d399" className="shrink-0" />
}

function Skeleton() {
  return <div className="h-20 rounded-xl animate-pulse" style={{ background: '#18181b' }} />
}

// ── helpers ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: '#0a0a0e', border: '1px solid #2e2e33', borderRadius: 8,
  color: '#fafafa', fontSize: 12, padding: '8px 10px', width: '100%',
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSlot(s: Slot): string {
  const f = (sec: number) => new Date(sec * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return `${f(s.start_time)} → ${f(s.end_time)}`
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function marginColor(pct: number): string {
  if (pct < 0) return '#f87171'
  if (pct < 5) return '#fcd34d'
  return '#34d399'
}
