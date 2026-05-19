'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { api } from './api'
import { useConfirm } from '@/components/ui/dialog-provider'

type Channel = 'mercadolivre' | 'shopee' | 'amazon' | 'magalu' | 'all'

interface UntouchableSeller {
  id:                 string
  organization_id:    string
  seller_name:        string
  seller_id_external: string | null
  channel:            Channel | null
  reason:             string | null
  created_at:         string
}

const CHANNEL_OPTIONS: Array<{ value: Channel; label: string; color: string }> = [
  { value: 'all',          label: '',                color: '#a1a1aa' },
  { value: 'mercadolivre', label: 'Mercado Livre',   color: '#ffe600' },
  { value: 'shopee',       label: 'Shopee',          color: '#ee4d2d' },
  { value: 'amazon',       label: 'Amazon',          color: '#ff9900' },
  { value: 'magalu',       label: 'Magalu',          color: '#0086ff' },
]

const channelColor = (c: Channel | null) => CHANNEL_OPTIONS.find(o => o.value === c)?.color ?? '#a1a1aa'

export function UntouchableSellersTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const t = useTranslations('pricing')
  const channelLabel = (c: Channel | null) =>
    c === 'all' ? t('allChannels') : (CHANNEL_OPTIONS.find(o => o.value === c)?.label ?? '—')
  const [list, setList]       = useState<UntouchableSeller[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await api<UntouchableSeller[]>('/pricing/untouchable-sellers')) }
    catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    const ok = await confirm({
      title:        t('removeSellerTitle'),
      message:      t('removeSellerMessage'),
      confirmLabel: t('remove'),
      variant:      'warning',
    })
    if (!ok) return
    try {
      await api(`/pricing/untouchable-sellers/${id}`, { method: 'DELETE' })
      setList(prev => prev.filter(x => x.id !== id))
      onToast(t('sellerRemoved'), 'success')
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">{t('untouchableIntro')}</p>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#00E5FF', color: '#08323b' }}
        >+ {t('addSeller')}</button>
      </div>

      {loading
        ? <div className="h-24 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              {t('noSellersBlocklist')}
            </div>
          : <div className="grid gap-3">
              {list.map(s => {
                const color = channelColor(s.channel)
                return (
                  <div key={s.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold truncate">{s.seller_name}</p>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>
                          {channelLabel(s.channel)}
                        </span>
                        {s.seller_id_external && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono" style={{ background: '#27272a', color: '#a1a1aa' }}>
                            {t('idLabel', { id: s.seller_id_external })}
                          </span>
                        )}
                      </div>
                      {s.reason && <p className="text-zinc-500 text-xs mt-1.5">{s.reason}</p>}
                    </div>
                    <button onClick={() => remove(s.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0" style={{ borderColor: '#3f3f46', color: '#f87171' }}>{t('delete')}</button>
                  </div>
                )
              })}
            </div>}

      {adding && (
        <SellerEditor
          onClose={() => setAdding(false)}
          onSaved={(s) => {
            setAdding(false)
            setList(prev => [s, ...prev])
            onToast(t('sellerAdded'), 'success')
          }}
          onError={(m) => onToast(m, 'error')}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SellerEditor({
  onClose, onSaved, onError,
}: {
  onClose: () => void
  onSaved: (s: UntouchableSeller) => void
  onError: (m: string) => void
}) {
  const t = useTranslations('pricing')
  const [name, setName]         = useState('')
  const [externalId, setExtId]  = useState('')
  const [channel, setChannel]   = useState<Channel>('all')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)

  async function save() {
    if (!name.trim()) return onError(t('errNameRequired'))
    setSaving(true)
    try {
      const s = await api<UntouchableSeller>('/pricing/untouchable-sellers', {
        method: 'POST',
        body: JSON.stringify({
          seller_name:        name.trim(),
          seller_id_external: externalId.trim() || null,
          channel,
          reason:             reason.trim() || null,
        }),
      })
      onSaved(s)
    } catch (e) { onError((e as Error).message); setSaving(false) }
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">{t('addUntouchableSeller')}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('sellerName')}</p>
            <input className="us-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('sellerNamePlaceholder')} autoFocus />
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('externalIdOptional')}</p>
            <input className="us-input font-mono" value={externalId} onChange={e => setExtId(e.target.value)} placeholder={t('externalIdPlaceholder')} />
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('channel')}</p>
            <select className="us-input" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
              {CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.value === 'all' ? t('allChannels') : o.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{t('reasonOptional')}</p>
            <textarea className="us-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('reasonPlaceholder')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>{t('cancel')}</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {saving ? t('saving') : t('add')}
          </button>
        </div>
      </div>
      <style jsx>{`
        .us-input {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .us-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}
