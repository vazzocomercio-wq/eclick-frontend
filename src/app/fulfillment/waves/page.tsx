'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Layers, Plus, Sparkles, Play, X, Check, ChevronRight, PackageSearch, RefreshCw, Loader2, ShoppingCart,
} from 'lucide-react'
import { Scanner } from '../_components/Scanner'
import {
  fulfillmentApi, ApiError,
  type WaveSummary, type WaveDetail, type WaveStatus, type WaveSuggestResponse, type PickTask,
} from '../_lib/api'
import { feedbackOk, feedbackError, feedbackDone } from '../_lib/feedback'

const WID_KEY = 'eclick_fulfillment_wid'

interface Candidate { foId: string; reference: string; channel: string; customer: string; items: number }

export default function WavesPage() {
  const [mode, setMode] = useState<'list' | 'builder' | 'detail'>('list')
  const [waves, setWaves] = useState<WaveSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null

  const loadWaves = useCallback(async () => {
    setLoading(true)
    try { setWaves(await fulfillmentApi.waves(wid ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [wid])

  useEffect(() => { loadWaves() }, [loadWaves])

  if (mode === 'builder') {
    return <WaveBuilder wid={wid} onCancel={() => setMode('list')} onCreated={(id) => { setActiveId(id); setMode('detail'); loadWaves() }} />
  }
  if (mode === 'detail' && activeId) {
    return <WaveDetailView id={activeId} onExit={() => { setActiveId(null); setMode('list'); loadWaves() }} />
  }

  const active = waves.filter((w) => !['done', 'cancelled'].includes(w.status))
  const past = waves.filter((w) => ['done', 'cancelled'].includes(w.status))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Separação em ondas</h1>
          <p className="text-xs" style={{ color: '#71717a' }}>Coleta consolidada + sorting</p>
        </div>
        <button onClick={loadWaves} className="rounded-xl p-2.5" style={{ background: '#18181b' }} aria-label="Atualizar"><RefreshCw size={18} color="#00E5FF" /></button>
      </header>

      {err && <ErrBox msg={err} />}

      <button
        onClick={() => setMode('builder')}
        className="flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99] transition-transform"
        style={{ background: 'linear-gradient(135deg,#1a1430,#0c0c10)', border: '1px solid #a78bfa55' }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: '#a78bfa1a' }}><Plus size={24} color="#a78bfa" /></div>
        <div className="flex-1 text-left">
          <div className="text-lg font-bold">Montar nova onda</div>
          <div className="text-sm" style={{ color: '#a1a1aa' }}>Agrupe pedidos com ajuda da IA</div>
        </div>
      </button>

      {loading && <SkeletonList />}

      {!loading && active.length === 0 && past.length === 0 && !err && (
        <Empty icon={<Layers size={30} color="#52525b" />} text="Nenhuma onda ainda. Monte a primeira pra acelerar a separação." />
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: '#71717a' }}>Em andamento</h2>
          <ul className="flex flex-col gap-2">
            {active.map((w) => <WaveRow key={w.id} w={w} onOpen={() => { setActiveId(w.id); setMode('detail') }} />)}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: '#71717a' }}>Finalizadas</h2>
          <ul className="flex flex-col gap-2">
            {past.slice(0, 15).map((w) => <WaveRow key={w.id} w={w} onOpen={() => { setActiveId(w.id); setMode('detail') }} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Linha de onda ──────────────────────────────────────────────────────────
function WaveRow({ w, onOpen }: { w: WaveSummary; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform"
        style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: '#a78bfa1a' }}><Layers size={18} color="#a78bfa" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{w.name || `Onda ${w.id.slice(0, 6)}`}</span>
            <StatusPill status={w.status} />
          </div>
          <div className="text-sm" style={{ color: '#a1a1aa' }}>{w.orders_count} {w.orders_count === 1 ? 'pedido' : 'pedidos'} · {timeAgo(w.created_at)}</div>
        </div>
        <ChevronRight size={18} color="#52525b" />
      </button>
    </li>
  )
}

// ── Builder (supervisor monta a onda) ────────────────────────────────────────
function WaveBuilder({ wid, onCancel, onCreated }: { wid: string | null; onCancel: () => void; onCreated: (id: string) => void }) {
  const [cands, setCands] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<WaveSuggestResponse | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const tasks = await fulfillmentApi.pickQueue(wid ?? undefined)
        const map = new Map<string, Candidate>()
        for (const t of tasks as PickTask[]) {
          const c = map.get(t.fulfillment_order_id) ?? {
            foId: t.fulfillment_order_id,
            reference: t.order?.reference ?? t.fulfillment_order_id.slice(0, 8),
            channel: t.order?.channel ?? '—',
            customer: t.order?.customer?.name ?? '',
            items: 0,
          }
          c.items += 1
          map.set(t.fulfillment_order_id, c)
        }
        setCands([...map.values()])
        setErr(null)
      } catch (e) { setErr((e as Error).message) }
      finally { setLoading(false) }
    })()
  }, [wid])

  const suggestedIds = useMemo(() => new Set((suggestion?.suggestions ?? []).map((s) => s.foId)), [suggestion])
  const warnIds = useMemo(() => new Set((suggestion?.warnings ?? []).map((w) => w.foId)), [suggestion])
  const reasonByFo = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of suggestion?.suggestions ?? []) m.set(s.foId, s.reason)
    return m
  }, [suggestion])

  function toggle(foId: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(foId)) n.delete(foId); else n.add(foId); return n })
  }

  async function askAi() {
    setSuggesting(true); setErr(null)
    try { setSuggestion(await fulfillmentApi.suggestWave({ warehouseId: wid ?? undefined, selectedIds: [...selected] })) }
    catch (e) { setErr((e as Error).message) }
    finally { setSuggesting(false) }
  }

  function addAllSuggested() {
    setSelected((prev) => { const n = new Set(prev); for (const id of suggestedIds) n.add(id); return n })
  }

  async function create() {
    if (selected.size === 0) return
    setBusy(true); setErr(null)
    try {
      const r = await fulfillmentApi.createWave({ warehouseId: wid ?? undefined, name: name.trim() || undefined, fulfillmentOrderIds: [...selected] })
      feedbackOk(); onCreated(r.id)
    } catch (e) { feedbackError(); setErr(e instanceof ApiError ? e.message : (e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <button onClick={onCancel} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold">Montar onda</h1>
      </header>

      {err && <ErrBox msg={err} />}

      <input
        value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Nome da onda (opcional)"
        className="w-full rounded-xl px-4 py-3 text-base outline-none"
        style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}
      />

      <div className="flex gap-2">
        <button onClick={askAi} disabled={suggesting || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          style={{ background: '#a78bfa22', color: '#c4b5fd', border: '1px solid #a78bfa55' }}>
          {suggesting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} IA sugerir
        </button>
        {suggestedIds.size > 0 && (
          <button onClick={addAllSuggested} className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#a78bfa', color: '#1a1030' }}>
            + {suggestedIds.size} sugerido(s)
          </button>
        )}
      </div>

      {suggestion?.rationale && (
        <div className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: '#a78bfa12', border: '1px solid #a78bfa33', color: '#c4b5fd' }}>
          <Sparkles size={15} className="mt-0.5 shrink-0" /> <span>{suggestion.rationale}</span>
        </div>
      )}
      {(suggestion?.warnings.length ?? 0) > 0 && (
        <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid #F59E0B55', color: '#fcd34d' }}>
          {suggestion!.warnings.map((w) => <div key={w.foId}>⚠ #{w.reference ?? w.foId.slice(0, 6)}: {w.reason}</div>)}
        </div>
      )}

      {loading && <SkeletonList />}
      {!loading && cands.length === 0 && !err && (
        <Empty icon={<PackageSearch size={30} color="#52525b" />} text="Sem pedidos pendentes pra agrupar agora." />
      )}

      <ul className="flex flex-col gap-2">
        {cands.map((c) => {
          const sel = selected.has(c.foId)
          const sug = suggestedIds.has(c.foId)
          const warn = warnIds.has(c.foId)
          return (
            <li key={c.foId}>
              <button onClick={() => toggle(c.foId)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform"
                style={{ background: sel ? '#0c2814' : '#0c0c10', border: `1px solid ${sel ? '#4ADE50' : sug ? '#a78bfa66' : warn ? '#F59E0B55' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="grid h-6 w-6 place-items-center rounded-md" style={{ background: sel ? '#4ADE50' : '#18181b', border: sel ? 'none' : '1px solid rgba(255,255,255,0.15)' }}>
                  {sel && <Check size={15} color="#06210d" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{c.reference}</span>
                    <ChannelPill channel={c.channel} />
                    {sug && !sel && <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: '#a78bfa22', color: '#c4b5fd' }}>IA</span>}
                  </div>
                  <div className="text-sm" style={{ color: '#a1a1aa' }}>
                    {c.customer || 'Cliente'} · {c.items} {c.items === 1 ? 'item' : 'itens'}
                    {sug && reasonByFo.get(c.foId) && <span style={{ color: '#c4b5fd' }}> · {reasonByFo.get(c.foId)}</span>}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <button onClick={create} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold disabled:opacity-50"
            style={{ background: '#a78bfa', color: '#1a1030' }}>
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Layers size={20} />} Criar onda · {selected.size} pedido(s)
          </button>
        </div>
      )}
    </div>
  )
}

// ── Detalhe / execução da onda ───────────────────────────────────────────────
function WaveDetailView({ id, onExit }: { id: string; onExit: () => void }) {
  const [wave, setWave] = useState<WaveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setWave(await fulfillmentApi.wave(id)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const flashFx = (k: 'ok' | 'err') => { setFlash(k); setTimeout(() => setFlash(null), 450) }

  async function release() {
    setBusy(true); setErr(null)
    try { setWave(await fulfillmentApi.releaseWave(id)); feedbackOk() }
    catch (e) { feedbackError(); setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  async function cancel() {
    setBusy(true)
    try { await fulfillmentApi.cancelWave(id); onExit() }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  async function onScan(code: string) {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const r = await fulfillmentApi.scanWaveItem(id, code)
      feedbackOk(); flashFx('ok')
      setMsg(`${r.sku}: ${r.collected}/${r.total}`)
      if (r.allCollected) feedbackDone()
      await load()
    } catch (e) {
      feedbackError(); flashFx('err')
      setMsg(e instanceof ApiError ? e.message : (e as Error).message)
    } finally { setBusy(false) }
  }

  async function completeOrder(foId: string) {
    setBusy(true); setMsg(null)
    try {
      const r = await fulfillmentApi.completeWaveOrder(id, foId)
      feedbackOk()
      if (r.allSorted) { feedbackDone(); setMsg('Onda concluída! ✓') }
      await load()
    } catch (e) { feedbackError(); setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="flex flex-col gap-4"><BackHeader onExit={onExit} title="Onda" /><SkeletonList /></div>
  if (!wave) return <div className="flex flex-col gap-4"><BackHeader onExit={onExit} title="Onda" />{err && <ErrBox msg={err} />}</div>

  const totalUnits = wave.consolidated.reduce((s, i) => s + i.totalQty, 0)
  const collectedUnits = wave.consolidated.reduce((s, i) => s + i.collectedQty, 0)
  const allCollected = totalUnits > 0 && collectedUnits >= totalUnits
  const isOpen = wave.status === 'open'
  const isCollecting = wave.status === 'collecting' || wave.status === 'sorting'
  const isFinal = wave.status === 'done' || wave.status === 'cancelled'

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onExit={onExit} title={wave.name || `Onda ${wave.id.slice(0, 6)}`} status={wave.status} />

      {err && <ErrBox msg={err} />}

      {/* OPEN — supervisor revisa e libera */}
      {isOpen && (
        <>
          <div className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-2 text-sm font-semibold" style={{ color: '#71717a' }}>{wave.orders.length} pedido(s) · {wave.consolidated.length} SKU(s) · {totalUnits} unidade(s)</div>
            <ul className="flex flex-col gap-1">
              {wave.orders.map((o) => (
                <li key={o.fulfillmentOrderId} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: '#121214' }}>
                  <span className="font-bold">#{o.reference ?? o.fulfillmentOrderId.slice(0, 6)}</span>
                  <ChannelPill channel={o.channel ?? '—'} />
                </li>
              ))}
            </ul>
          </div>
          <CartPlanPanel waveId={id} warehouseId={wave.warehouse_id} plan={wave.cart_plan ?? null} onPlanned={load} />
          <button onClick={release} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#04222a' }}>
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />} Liberar pra coleta
          </button>
          <button onClick={cancel} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold" style={{ background: '#18181b', color: '#f87171' }}>
            <X size={16} /> Cancelar onda
          </button>
        </>
      )}

      {/* COLLECTING/SORTING — operador coleta consolidado e faz sorting */}
      {isCollecting && (
        <>
          {/* progresso da coleta */}
          <div className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: '#71717a' }}>Coleta consolidada</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: allCollected ? '#4ADE50' : '#00E5FF' }}>{collectedUnits}/{totalUnits}</span>
            </div>
            {wave.cart_plan && wave.cart_plan.carts.length > 0 && (
              <div className="mb-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#a5f3fc' }}>
                🛒 Plano: <b>{wave.cart_plan.carts.length} carrinho(s)</b> ({wave.cart_plan.cartName})
                {wave.cart_plan.toMeasure.length > 0 && <span style={{ color: '#fcd34d' }}> · {wave.cart_plan.toMeasure.length} item(s) a medir</span>}
                {wave.cart_plan.oversized && wave.cart_plan.oversized.length > 0 && <span style={{ color: '#fb923c' }}> · {wave.cart_plan.oversized.length} grande(s)</span>}
              </div>
            )}
            <ul className="flex flex-col gap-1.5">
              {wave.consolidated.map((it) => {
                const done = it.collectedQty >= it.totalQty
                return (
                  <li key={it.sku} className="rounded-lg px-3 py-2" style={{ background: done ? '#0c2814' : '#121214', border: `1px solid ${done ? '#4ADE5044' : 'transparent'}` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {it.locationCode
                          ? <span className="font-mono text-xs font-bold" style={{ color: '#00E5FF' }}>📍{it.locationCode}</span>
                          : <span className="text-xs" style={{ color: '#52525b' }}>📍—</span>}
                        <span className="font-mono text-sm font-bold">{it.sku}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums" style={{ color: done ? '#4ADE50' : '#fafafa' }}>{it.collectedQty}/{it.totalQty}</span>
                    </div>
                    {it.title && <div className="text-xs" style={{ color: '#71717a' }}>{it.title}</div>}
                  </li>
                )
              })}
            </ul>
          </div>

          {!allCollected && <Scanner onScan={onScan} disabled={busy} hint="Bipe os itens da onda (SKU, EAN ou QR)" />}

          {msg && (
            <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: flash === 'err' ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,80,0.10)', color: flash === 'err' ? '#f87171' : '#4ADE50' }}>
              {msg}
            </div>
          )}

          {/* sorting: marca cada pedido como separado */}
          <div className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: '#71717a' }}>
              <Layers size={15} /> Distribuir nos pedidos (sorting)
              {!allCollected && <span className="text-xs font-normal" style={{ color: '#52525b' }}>— colete tudo primeiro</span>}
            </div>
            <ul className="flex flex-col gap-2">
              {wave.orders.map((o) => (
                <li key={o.fulfillmentOrderId} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#121214' }}>
                  <span className="flex-1 font-bold">#{o.reference ?? o.fulfillmentOrderId.slice(0, 6)}</span>
                  <ChannelPill channel={o.channel ?? '—'} />
                  {o.sorted ? (
                    <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#4ADE50' }}><Check size={15} /> ok</span>
                  ) : (
                    <button onClick={() => completeOrder(o.fulfillmentOrderId)} disabled={busy || !allCollected}
                      className="rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-40"
                      style={{ background: '#4ADE50', color: '#06210d' }}>Concluir</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* FINAL */}
      {isFinal && (
        <div className="rounded-2xl p-6 text-center" style={{ background: wave.status === 'done' ? '#0c2814' : '#1a1010', border: `1px solid ${wave.status === 'done' ? '#4ADE5055' : '#EF444455'}` }}>
          {wave.status === 'done' ? <Check size={42} className="mx-auto mb-2" color="#4ADE50" /> : <X size={42} className="mx-auto mb-2" color="#f87171" />}
          <div className="text-lg font-bold">{wave.status === 'done' ? 'Onda concluída' : 'Onda cancelada'}</div>
          <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>{wave.orders.length} pedido(s) · {totalUnits} unidade(s)</p>
          <button onClick={onExit} className="mt-4 w-full rounded-xl py-3 font-bold" style={{ background: '#18181b', color: '#fafafa' }}>Voltar</button>
        </div>
      )}
    </div>
  )
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function BackHeader({ onExit, title, status }: { onExit: () => void; title: string; status?: WaveStatus }) {
  return (
    <header className="flex items-center gap-3 pt-1">
      <button onClick={onExit} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
      <div className="flex flex-1 items-center gap-2">
        <h1 className="text-lg font-bold">{title}</h1>
        {status && <StatusPill status={status} />}
      </div>
    </header>
  )
}

function StatusPill({ status }: { status: WaveStatus }) {
  const map: Record<WaveStatus, { label: string; color: string }> = {
    open:       { label: 'Aberta',     color: '#a78bfa' },
    released:   { label: 'Liberada',   color: '#00E5FF' },
    collecting: { label: 'Coletando',  color: '#00E5FF' },
    sorting:    { label: 'Sorting',    color: '#fcd34d' },
    done:       { label: 'Concluída',  color: '#4ADE50' },
    cancelled:  { label: 'Cancelada',  color: '#f87171' },
  }
  const s = map[status]
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${s.color}1a`, color: s.color }}>{s.label}</span>
}

function ChannelPill({ channel }: { channel: string }) {
  const c = channel === 'mercadolivre' ? '#FFE600' : channel === 'loja' ? '#00E5FF' : channel === 'b2b' ? '#4ADE50' : '#a1a1aa'
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${c}1a`, color: c }}>{channel}</span>
}
function ErrBox({ msg }: { msg: string }) {
  return <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{msg}</div>
}

// Plano de carrinhos (cubagem): escolhe um carrinho e divide a onda em carrinhos pela rota.
function CartPlanPanel({ waveId, warehouseId, plan, onPlanned }: { waveId: string; warehouseId: string | null; plan: import('../_lib/api').CartPlan | null; onPlanned: () => Promise<void> | void }) {
  const [carts, setCarts] = useState<import('../_lib/api').PickingCart[]>([])
  const [cartId, setCartId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { fulfillmentApi.carts(warehouseId ?? undefined).then((c) => { setCarts(c); if (c[0]) setCartId(c[0].id) }).catch(() => {}) }, [warehouseId])
  async function plan_() {
    if (!cartId) { setErr('Cadastre/escolha um carrinho.'); return }
    setBusy(true); setErr(null)
    try { await fulfillmentApi.planWaveCarts(waveId, cartId); await onPlanned() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-2 flex items-center gap-2"><ShoppingCart size={15} color="#00E5FF" /><span className="text-sm font-semibold" style={{ color: '#71717a' }}>Plano de carrinhos (cubagem)</span></div>
      {carts.length === 0
        ? <p className="text-xs" style={{ color: '#fcd34d' }}>Nenhum carrinho cadastrado — cadastre em 🛒 Carrinhos no início.</p>
        : (
          <div className="flex gap-2">
            <select value={cartId} onChange={(e) => setCartId(e.target.value)} className="flex-1 rounded-lg px-2 py-2 text-sm outline-none" style={{ background: '#121214', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
              {carts.map((c) => <option key={c.id} value={c.id}>{c.name} ({(c.usable_volume_cm3 / 1000).toFixed(1)} L úteis)</option>)}
            </select>
            <button onClick={plan_} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>Planejar</button>
          </div>
        )}
      {err && <p className="mt-2 text-xs" style={{ color: '#f87171' }}>{err}</p>}
      {plan && plan.carts.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          <div className="text-xs font-semibold" style={{ color: '#a5f3fc' }}>{plan.carts.length} carrinho(s) · {plan.cartName}{plan.toMeasure.length > 0 ? ` · ${plan.toMeasure.length} a medir` : ''}</div>
          {plan.carts.map((c) => (
            <div key={c.index} className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#121214' }}>
              <b style={{ color: '#00E5FF' }}>Carrinho {c.index}</b> <span style={{ color: '#71717a' }}>· {c.items.length} SKU(s) · {(c.volumeUsed / 1000).toFixed(1)}/{(c.volumeCap / 1000).toFixed(1)} L</span>
              {c.items.some((i) => i.split) && <span style={{ color: '#a78bfa' }}> · lote dividido</span>}
            </div>
          ))}
          {plan.toMeasure.length > 0 && <div className="text-xs" style={{ color: '#fcd34d' }}>⚠ {plan.toMeasure.length} item(s) sem medida ficaram de fora — meça em 🛒 Carrinhos.</div>}
          {plan.oversized && plan.oversized.length > 0 && <div className="text-xs" style={{ color: '#fb923c' }}>📦 {plan.oversized.length} item(s) grande(s) não cabem no carrinho (use outro carrinho/leve à mão): {plan.oversized.map((o) => o.sku).join(', ')}</div>}
        </div>
      )}
    </div>
  )
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}><div className="mb-2 flex justify-center">{icon}</div><p className="text-sm" style={{ color: '#a1a1aa' }}>{text}</p></div>
}
function SkeletonList() {
  return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
