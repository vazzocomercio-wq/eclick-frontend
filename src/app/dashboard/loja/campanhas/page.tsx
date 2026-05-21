'use client'

/**
 * Campanhas de Promoção — lista + criação.
 *
 * Campanha = agrupador com desconto padrão + N produtos. Cada produto
 * pode ter override individual. Quando "aplicar", escreve sale_price
 * em todos os produtos respeitando override > default.
 *
 * Endpoints:
 *   GET/POST     /store/config/campaigns
 *   PATCH/DELETE /store/config/campaigns/:id
 *   POST         /store/config/campaigns/:id/apply
 *   POST         /store/config/campaigns/:id/unapply
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Megaphone, Loader2, ChevronLeft, Plus, X, Save, AlertCircle,
  Trash2, Power, PowerOff, Sparkles, Package, Calendar,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                   string
  name:                 string
  description:          string | null
  default_discount_pct: number
  badge_text:           string | null
  starts_at:            string | null
  ends_at:              string | null
  active:               boolean
  applied_at:           string | null
  applied_count:        number
  product_count:        number
  created_at:           string
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const [creating, setCreating] = useState(false)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCampaigns(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken])

  useEffect(() => { void load() }, [load])

  const remove = async (c: Campaign) => {
    const ok = await confirm({
      title:        'Remover campanha',
      message:      `A campanha "${c.name}" será excluída e o sale_price será limpo em todos os produtos que faziam parte dela. Não dá pra desfazer.`,
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${c.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const toggleActive = async (c: Campaign) => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${c.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <Megaphone size={24} /> Campanhas de Promoção
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Agrupa produtos sob desconto comum · override individual · aplicação em massa
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            <Plus size={14} /> Nova campanha
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Megaphone size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500 mb-3">Nenhuma campanha criada ainda</p>
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
            <Plus size={12} /> Criar primeira campanha
          </button>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {campaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggle={() => toggleActive(c)}
              onDelete={() => remove(c)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CampaignFormModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function CampaignCard({ campaign, onToggle, onDelete }: {
  campaign: Campaign
  onToggle: () => void
  onDelete: () => void
}) {
  const isApplied = Boolean(campaign.applied_at)
  return (
    <div className="rounded-lg p-4 transition-all"
      style={{
        background: '#0a0a0e',
        border: `1px solid ${campaign.active ? '#27272a' : '#1a1a1a'}`,
        opacity: campaign.active ? 1 : 0.6,
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <Link href={`/dashboard/loja/campanhas/${campaign.id}`}
            className="text-base font-semibold text-zinc-100 hover:text-cyan-400 line-clamp-1">
            {campaign.name}
          </Link>
          {campaign.description && (
            <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{campaign.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} title={campaign.active ? 'Desativar' : 'Ativar'}
            className="p-1.5 rounded hover:bg-zinc-800" style={{ minHeight: 32, minWidth: 32 }}>
            {campaign.active
              ? <Power size={14} style={{ color: '#22c55e' }} />
              : <PowerOff size={14} style={{ color: '#71717a' }} />}
          </button>
          <button onClick={onDelete} title="Remover" className="p-1.5 rounded hover:bg-zinc-800"
            style={{ minHeight: 32, minWidth: 32 }}>
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded p-2" style={{ background: '#09090b' }}>
          <p className="text-[10px] text-zinc-500">Desconto</p>
          <p className="text-lg font-bold" style={{ color: '#22c55e' }}>
            {campaign.default_discount_pct}%
          </p>
        </div>
        <div className="rounded p-2" style={{ background: '#09090b' }}>
          <p className="text-[10px] text-zinc-500">Produtos</p>
          <p className="text-lg font-bold text-zinc-100">{campaign.product_count}</p>
        </div>
      </div>

      {campaign.badge_text && (
        <div className="mb-2">
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
            style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
            {campaign.badge_text}
          </span>
        </div>
      )}

      {(campaign.starts_at || campaign.ends_at) && (
        <p className="text-[11px] text-zinc-500 flex items-center gap-1 mb-2">
          <Calendar size={9} />
          {campaign.starts_at && new Date(campaign.starts_at).toLocaleDateString('pt-BR')}
          {' → '}
          {campaign.ends_at ? new Date(campaign.ends_at).toLocaleDateString('pt-BR') : 'sem prazo'}
        </p>
      )}

      <div className="pt-2 border-t flex items-center justify-between text-[11px]"
        style={{ borderColor: '#27272a', color: '#a1a1aa' }}>
        {isApplied ? (
          <span style={{ color: '#22c55e' }}>
            ✓ Aplicada em {campaign.applied_count} produto{campaign.applied_count === 1 ? '' : 's'}
          </span>
        ) : (
          <span>Não aplicada ainda</span>
        )}
        <Link href={`/dashboard/loja/campanhas/${campaign.id}`}
          className="text-cyan-400 hover:underline">Gerenciar →</Link>
      </div>
    </div>
  )
}

function CampaignFormModal({ onClose, onSaved, fetchToken }: {
  onClose: () => void
  onSaved: () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultDiscountPct, setDefaultDiscountPct] = useState('20')
  const [badgeText, setBadgeText] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const pctNum = parseFloat(defaultDiscountPct)
  const validPct = Number.isFinite(pctNum) && pctNum > 0 && pctNum < 100

  const save = async () => {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    if (!validPct) { setErr('% deve ser entre 1 e 99'); return }
    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                 name.trim(),
          description:          description.trim() || null,
          default_discount_pct: pctNum,
          badge_text:           badgeText.trim() || null,
          starts_at:            startsAt ? new Date(startsAt).toISOString() : null,
          ends_at:              endsAt   ? new Date(endsAt).toISOString()   : null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-lg p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#09090b', border: '1px solid #27272a' }}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Nova campanha</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100"
            style={{ minHeight: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        {err && (
          <div className="mb-4 p-2.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome da campanha</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder='Ex: "BLACK FRIDAY 2026"'
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição (opcional, só admin)</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">% Desconto padrão</label>
            <div className="relative">
              <input type="number" min="1" max="99" step="1"
                value={defaultDiscountPct} onChange={e => setDefaultDiscountPct(e.target.value)}
                className="w-full text-xl px-3 py-3 rounded outline-none text-center font-bold"
                style={{
                  background: '#0a0a0e', color: '#22c55e',
                  border: `1px solid ${!validPct && defaultDiscountPct ? '#ef4444' : '#27272a'}`, minHeight: 60,
                }} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base text-zinc-500">%</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Esse % vale pra todos os produtos da campanha — cada um pode ter override
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Texto do badge (opcional)</label>
            <input value={badgeText} onChange={e => setBadgeText(e.target.value)}
              placeholder='Ex: "BLACK FRIDAY"' maxLength={20}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <Calendar size={11} className="inline mr-1" /> Início (opcional)
              </label>
              <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <Calendar size={11} className="inline mr-1" /> Fim (opcional)
              </label>
              <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <div className="flex-1" />
          <button onClick={onClose} disabled={saving}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="text-sm px-4 py-2 rounded font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Criar campanha
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-3">
          💡 Após criar, adicione produtos e clique em "Aplicar" pra escrever sale_price em todos.
        </p>
      </div>
    </div>
  )
}
