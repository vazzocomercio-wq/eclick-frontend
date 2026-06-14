'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Camera, Printer, ChevronRight, PackageCheck, ScanLine, Sparkles } from 'lucide-react'
import { Scanner } from '../_components/Scanner'
import { CameraCapture } from '../_components/CameraCapture'
import { fulfillmentApi, ApiError, type PackTask } from '../_lib/api'
import { feedbackOk, feedbackError, feedbackDone } from '../_lib/feedback'

const WID_KEY = 'eclick_fulfillment_wid'

export default function PackingPage() {
  const [tasks, setTasks] = useState<PackTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const wid = typeof window !== 'undefined' ? localStorage.getItem(WID_KEY) : null

  const load = useCallback(async () => {
    setLoading(true)
    try { setTasks(await fulfillmentApi.packQueue(wid ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [wid])

  useEffect(() => { load() }, [load])

  const active = useMemo(() => tasks.find((t) => t.id === activeId) ?? null, [tasks, activeId])
  if (active) return <PackSession task={active} onExit={() => { setActiveId(null); load() }} />

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <Link href="/fulfillment" className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></Link>
        <h1 className="text-xl font-bold">Conferir e expedir</h1>
      </header>

      {err && <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {loading && <div className="flex flex-col gap-2">{[0, 1].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-2xl" style={{ background: '#0c0c10' }} />)}</div>}

      {!loading && tasks.length === 0 && !err && (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
          <PackageCheck size={30} className="mx-auto mb-2" color="#52525b" />
          <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum pedido pronto para conferência.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <button onClick={() => setActiveId(t.id)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left active:scale-[0.99] transition-transform" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">#{t.order?.reference ?? t.fulfillment_order_id.slice(0, 8)}</span>
                  <ChannelPill platform={t.order?.platform} channel={t.order?.channel} label={t.order?.accountLabel} />
                  {t.requires_photo && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#00E5FF1a', color: '#00E5FF' }}>foto</span>}
                  {t.status === 'in_progress' && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#4ADE501a', color: '#4ADE50' }}>em conferência</span>}
                </div>
                <div className="text-sm" style={{ color: '#a1a1aa' }}>{t.order?.customer?.name ?? 'Cliente'} · {t.items?.length ?? t.order?.items_count ?? 0} itens{t.order?.companyName ? ` · ${t.order.companyName}` : ''}</div>
              </div>
              <ChevronRight size={18} color="#52525b" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChannelPill({ platform, channel, label }: { platform?: string | null; channel?: string | null; label?: string | null }) {
  const key = (platform ?? channel ?? '').toLowerCase()
  const c = key.includes('mercado') ? '#FFE600'
    : key === 'loja' || key === 'storefront' ? '#00E5FF'
    : key === 'b2b' ? '#4ADE50'
    : key.includes('shopee') ? '#EE4D2D'
    : key.includes('tiktok') ? '#fafafa'
    : '#a1a1aa'
  // Mostra o apelido da conta (ex.: VAZZO_) quando houver — nunca só "mercadolivre".
  const text = label || channel || platform || '—'
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${c}1a`, color: c }}>{text}</span>
}

type Step = 'scan' | 'check' | 'done'

function PackSession({ task, onExit }: { task: PackTask; onExit: () => void }) {
  const [step, setStep] = useState<Step>(task.scanned_order_at ? 'check' : 'scan')
  const [photoUrl, setPhotoUrl] = useState<string | null>(task.photo_url)
  const [aiVerdict, setAiVerdict] = useState<boolean | null>(null)
  const [shoot, setShoot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null)
  const [label, setLabel] = useState<{ url: string | null; tracking: string | null; format: string } | null>(null)

  const items = task.items ?? []
  const flashFx = (k: 'ok' | 'err') => { setFlash(k); setTimeout(() => setFlash(null), 450) }

  async function scanOrder(code: string) {
    if (busy) return
    setBusy(true); setMsg(null)
    try { await fulfillmentApi.packScanOrder(task.id, code); feedbackOk(); flashFx('ok'); setStep('check') }
    catch (e) { feedbackError(); flashFx('err'); setMsg(e instanceof ApiError ? e.message : (e as Error).message) }
    finally { setBusy(false) }
  }

  async function uploadPhoto(b64: string, mime: string) {
    setBusy(true); setMsg(null); setShoot(false)
    try {
      const r = await fulfillmentApi.packPhoto(task.id, b64, mime)
      setPhotoUrl(r.photoUrl)
      setAiVerdict(r.aiVerification)
      feedbackOk()
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  async function complete() {
    setBusy(true); setMsg(null)
    try { await fulfillmentApi.packComplete(task.id); feedbackDone(); setStep('done') }
    catch (e) { setMsg(e instanceof ApiError ? e.message : (e as Error).message) }
    finally { setBusy(false) }
  }

  async function printLabel() {
    setBusy(true); setMsg(null)
    try {
      const r = await fulfillmentApi.printLabel(task.fulfillment_order_id)
      setLabel({ url: r.labelUrl, tracking: r.trackingCode, format: r.format })
      if (r.labelUrl) window.open(r.labelUrl, '_blank')
    } catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  const photoOk = !task.requires_photo || !!photoUrl

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 pt-1">
        <button onClick={onExit} className="rounded-xl p-2.5" style={{ background: '#18181b' }}><ArrowLeft size={20} /></button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">#{task.order?.reference ?? task.fulfillment_order_id.slice(0, 8)}</h1>
            <ChannelPill platform={task.order?.platform} channel={task.order?.channel} label={task.order?.accountLabel} />
          </div>
          <p className="text-xs" style={{ color: '#71717a' }}>{task.order?.customer?.name ?? 'Cliente'}{task.order?.companyName ? ` · ${task.order.companyName}` : ''}</p>
        </div>
      </header>

      {step === 'scan' && (
        <>
          <div className="rounded-2xl p-5 text-center" style={{ background: '#0c0c10', border: `1px solid ${flash === 'err' ? '#EF4444' : 'rgba(255,255,255,0.08)'}` }}>
            <ScanLine size={32} className="mx-auto mb-2" color="#00E5FF" />
            <p className="text-sm" style={{ color: '#a1a1aa' }}>Bipe a etiqueta/QR do pedido para liberar a conferência.</p>
          </div>
          <Scanner onScan={scanOrder} disabled={busy} hint="Bipe o pedido (QR, referência ou código)" />
          {msg && <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{msg}</div>}
        </>
      )}

      {step === 'check' && (
        <>
          <section className="rounded-2xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="mb-2 text-sm font-semibold" style={{ color: '#71717a' }}>Confira os itens</h2>
            <ul className="flex flex-col gap-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold tabular-nums" style={{ background: '#00E5FF1a', color: '#00E5FF' }}>{it.qty}</span>
                  <span className="flex-1 font-mono text-sm">{it.sku}</span>
                  <span className="truncate text-xs" style={{ color: '#71717a', maxWidth: 140 }}>{it.title}</span>
                </li>
              ))}
              {items.length === 0 && <li className="text-sm" style={{ color: '#52525b' }}>—</li>}
            </ul>
          </section>

          <section className="rounded-2xl p-4" style={{ background: '#0c0c10', border: `1px solid ${task.requires_photo && !photoUrl ? '#00E5FF55' : 'rgba(255,255,255,0.08)'}` }}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: '#71717a' }}>
                Foto do pacote {task.requires_photo ? <span style={{ color: '#00E5FF' }}>(obrigatória)</span> : '(opcional)'}
              </h2>
              {aiVerdict !== null && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: aiVerdict ? '#4ADE50' : '#fcd34d' }}>
                  <Sparkles size={13} /> IA: {aiVerdict ? 'confere' : 'revisar'}
                </span>
              )}
            </div>
            {shoot ? (
              <CameraCapture label="Foto do pacote" onCapture={uploadPhoto} onCancel={() => setShoot(false)} />
            ) : photoUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="pacote" className="h-16 w-16 rounded-lg object-cover" />
                <button onClick={() => setShoot(true)} className="text-sm font-semibold" style={{ color: '#00E5FF' }}>Refazer foto</button>
              </div>
            ) : (
              <button onClick={() => setShoot(true)} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold" style={{ background: '#18181b', color: '#fafafa' }}>
                <Camera size={18} /> Tirar foto
              </button>
            )}
          </section>

          {msg && <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{msg}</div>}

          <button onClick={complete} disabled={busy || !photoOk} className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50" style={{ background: '#4ADE50', color: '#06210d' }}>
            <Check size={20} /> Fechar conferência
          </button>
          {!photoOk && <p className="text-center text-xs" style={{ color: '#fcd34d' }}>Tire a foto antes de fechar.</p>}
        </>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-6 text-center" style={{ background: '#0c2814', border: '1px solid #4ADE5055' }}>
            <Check size={42} className="mx-auto mb-2" color="#4ADE50" />
            <div className="text-lg font-bold">Pedido conferido!</div>
            <p className="mt-1 text-sm" style={{ color: '#a1a1aa' }}>Agora imprima a etiqueta para expedir.</p>
          </div>

          {label ? (
            <div className="rounded-2xl p-4 text-center" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Printer size={26} className="mx-auto mb-2" color="#00E5FF" />
              <div className="text-sm font-semibold">Etiqueta {label.format} gerada</div>
              {label.tracking && <div className="mt-1 font-mono text-xs" style={{ color: '#a1a1aa' }}>{label.tracking}</div>}
              {label.url && <a href={label.url} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl px-4 py-2 text-sm font-bold" style={{ background: '#00E5FF', color: '#04222a' }}>Abrir / imprimir</a>}
            </div>
          ) : (
            <button onClick={printLabel} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>
              <Printer size={20} /> Imprimir etiqueta
            </button>
          )}
          {msg && <div className="rounded-xl p-3 text-center text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{msg}</div>}
          <button onClick={onExit} className="w-full rounded-xl py-3 font-semibold" style={{ background: '#18181b', color: '#fafafa' }}>Próximo pedido</button>
        </div>
      )}
    </div>
  )
}
