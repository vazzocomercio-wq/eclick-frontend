'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { useMlAccount } from '@/components/ml/AccountSelector'
import {
  RefreshCw, CheckCircle2, ExternalLink,
  Clock, ShieldAlert, X, MessageSquare, Send, AlertCircle,
  Sparkles, Scale, ShieldCheck, Camera, Eye, Store,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Translator = ReturnType<typeof useTranslations<'atendimento'>>

// ── Types ─────────────────────────────────────────────────────────────────────

type ClaimAction = { action: string; mandatory?: boolean; due_date?: string | null }
type ClaimPlayer = { role: string; user_id: number; available_actions?: ClaimAction[] }

type Claim = {
  id:             string | number
  resource_id?:   string | number
  seller_id?:     number          // conta ML dona (carimbada pelo backend no fan-out)
  reason?:        { id?: string; label?: string } | null
  reason_id?:     string | null
  reason_name?:   string | null
  status?:        string
  type?:          string
  stage?:         string
  date_created?:  string
  last_updated?:  string
  players?:       ClaimPlayer[]
  resolution?:    { reason?: string } | null
}

// Resolução ML — ações disponíveis + recomendação da IA e-Click
type MlResolutionAction = { action: string; label: string; mandatory: boolean; due_date: string | null }
type MlRecommendation = { recommended_action: string; rationale: string; confidence: number; watch_out: string } | null
type MlResolution = { seller_id: number; actions: MlResolutionAction[]; recommendation: MlRecommendation } | null

// consequência mostrada na confirmação, por código de ação do ML
const ML_ACTION_CONFIRM: Record<string, string> = {
  refund:                     'Isso REEMBOLSA o comprador (100% do valor) e encerra a reclamação a favor dele. Não dá pra desfazer.',
  open_dispute:               'Isso ABRE uma disputa: o Mercado Livre vai analisar as evidências e decidir o caso. Use quando você tem provas a seu favor (rastreio, fotos).',
  allow_return:               'Isso AUTORIZA a devolução do produto pelo comprador.',
  return_review_ok:           'Isso confirma que o produto devolvido chegou OK e LIBERA o reembolso ao comprador.',
  return_review_fail:         'Isso RECUSA o produto devolvido (chegou errado/danificado). O Mercado Livre vai mediar o caso.',
  return_review_unified_ok:   'Isso aprova a devolução (chegou OK) e libera o reembolso.',
  return_review_unified_fail: 'Isso recusa a devolução (chegou errado/danificado). O Mercado Livre vai mediar.',
}
const mlActionConfirm = (a: string, label: string) =>
  ML_ACTION_CONFIRM[a] ?? `Confirmar a ação "${label}" no Mercado Livre? Essa decisão é enviada direto pra plataforma.`

// ações que mexem em dinheiro / abrem litígio → confirmação em vermelho
const ML_ACTION_DANGER = new Set(['refund', 'open_dispute', 'return_review_ok', 'return_review_unified_ok'])

type ClaimDetail = {
  due_date?:           string | null
  action_responsible?: string | null
  title?:              string | null
  description?:        string | null
  problem?:            string | null
} | null

type ClaimMessage = {
  id?:              string | number
  sender_role?:     string
  receiver_role?:   string
  message?:         string
  text?:            string
  date_created?:    string
  date?:            string
  attachments?:     Array<{ name?: string; url?: string }>
  stage?:           string
}

type FilterKey = 'all' | 'opened' | 'closed'

type ChannelKey = 'ml' | 'shopee'

// ── Shopee returns (devoluções) ───────────────────────────────────────────────

type ShopeeReturnItem = {
  item_id?:   number
  name?:      string
  item_sku?:  string
  amount?:    number
  item_price?: number
  images?:    string[]
}

type PlaybookAction = 'accept' | 'accept_offer' | 'dispute' | 'collect_evidence' | 'monitor'

type PlaybookMeta = {
  negotiation?: {
    negotiation_status?:  string
    latest_offer_amount?: number
    latest_solution?:     string
  } | null
  economics?: {
    recoverable_value?: number | null
    cost_to_recover?:   number
  } | null
  ai?: { classification?: string; dispute_win_probability?: number } | null
} | null

type DisputeReason = {
  dispute_reason:      number
  dispute_requirement: string
}

type ShopeeReturn = {
  id:               string
  shop_id:          string | null
  return_sn:        string
  order_sn:         string | null
  status:           string | null
  reason:           string | null
  text_reason:      string | null
  refund_amount:    number | null
  currency:         string | null
  needs_logistics:  boolean | null
  tracking_number:  string | null
  buyer_username:   string | null
  due_date:         string | null
  return_create_at: string | null
  return_update_at: string | null
  playbook_action?:          PlaybookAction | null
  playbook_rationale?:       string | null
  playbook_confidence?:      number | null
  playbook_processed_at?:    string | null
  playbook_meta?:            PlaybookMeta
  playbook_executed_action?: string | null
  playbook_executed_at?:     string | null
  raw?: {
    image?:        string[]
    buyer_videos?: Array<{ thumbnail_url?: string; video_url?: string }>
    item?:         ShopeeReturnItem[]
  } | null
}

// selo da recomendação do playbook (cor + ícone por ação)
const PLAYBOOK_BADGE: Record<PlaybookAction, { color: string; bg: string; Icon: typeof Sparkles }> = {
  accept:           { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  Icon: CheckCircle2 },
  accept_offer:     { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  Icon: CheckCircle2 },
  dispute:          { color: '#c084fc', bg: 'rgba(192,132,252,0.1)', Icon: Scale },
  collect_evidence: { color: '#facc15', bg: 'rgba(250,204,21,0.1)',  Icon: Camera },
  monitor:          { color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)', Icon: Eye },
}

// status em aberto = seller ainda pode/precisa agir
const SHOPEE_OPEN_STATUSES = ['REQUESTED', 'PROCESSING', 'JUDGING', 'SELLER_DISPUTE']

const SHOPEE_STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  REQUESTED:      { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  PROCESSING:     { color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  JUDGING:        { color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
  SELLER_DISPUTE: { color: '#c084fc', bg: 'rgba(192,132,252,0.1)' },
  ACCEPTED:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  REFUND_PAID:    { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  CLOSED:         { color: '#71717a', bg: 'rgba(161,161,170,0.1)' },
  CANCELLED:      { color: '#71717a', bg: 'rgba(161,161,170,0.1)' },
}

// códigos REAIS vistos nas 245 devoluções da Vazzo (consulta no DB)
const SHOPEE_REASON_KEYS = [
  'NOT_RECEIPT', 'WRONG_ITEM', 'ITEM_DAMAGED', 'ITEM_MISSING', 'DIFFERENT_DESCRIPTION',
  'CHANGE_MIND', 'FUNCTIONAL_DMG', 'FUNCTIONAL_DAMAGE', 'PHYSICAL_DAMAGE', 'DAMAGED_OTHERS',
  'BROKEN_PRODUCTS', 'SUSPICIOUS_PARCEL', 'OUTER_DAMAGED_PACKAGE', 'ITEM_FAKE', 'NOT_FIT',
  'OTHER', 'NONE',
]

function getShopeeStatusCfg(t: Translator, s?: string | null) {
  const cfg = SHOPEE_STATUS_COLOR[s ?? '']
  if (s && cfg) return { label: t(`reclamacoes.shopee.status.${s}`), ...cfg }
  return { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' }
}

function getShopeeReasonLabel(t: Translator, r: ShopeeReturn): string {
  const code = r.reason ?? ''
  if (SHOPEE_REASON_KEYS.includes(code)) return t(`reclamacoes.shopee.reason.${code}`)
  return code || t('reclamacoes.reasonFallback')
}

const brlFmt = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Helpers ───────────────────────────────────────────────────────────────────

const REASON_IDS = ['PNR', 'PDD', 'PNDA', 'WP']

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  opened:   { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  closed:   { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  resolved: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  appealed: { color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
}

const TYPE_IDS = ['mediations', 'return', 'returns', 'fulfillment', 'ml_case', 'cancel_sale', 'cancel_purchase', 'change']

const STAGE_IDS = ['claim', 'dispute', 'mediation']

const ROLE_COLOR: Record<string, string> = {
  complainant: '#60a5fa',
  respondent:  '#4ade80',
  mediator:    '#facc15',
  meli:        '#facc15',
}

function getStatusCfg(t: Translator, s?: string) {
  const color = STATUS_COLOR[s ?? '']
  if (color) return { label: t(`reclamacoes.status.${s}`), ...color }
  return { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' }
}

function getTypeLabel(t: Translator, type?: string): string {
  if (!type) return ''
  return TYPE_IDS.includes(type) ? t(`reclamacoes.type.${type}`) : type
}

function getStageLabel(t: Translator, stage?: string): string {
  if (!stage) return ''
  return STAGE_IDS.includes(stage) ? t(`reclamacoes.stage.${stage}`) : stage
}

function getRoleLabel(t: Translator, role?: string): { label: string; color: string } {
  const color = ROLE_COLOR[role ?? '']
  if (color) return { label: t(`reclamacoes.role.${role}`), color }
  return { label: role ?? '?', color: '#71717a' }
}

function getReasonLabel(t: Translator, claim: Claim): string {
  const id = claim.reason_id ?? claim.reason?.id ?? ''
  // Tenta match exato ou prefixo (PDD9549 → PDD)
  if (REASON_IDS.includes(id)) return t(`reclamacoes.reason.${id}`)
  const prefix = id.match(/^[A-Z]+/)?.[0]
  if (prefix && REASON_IDS.includes(prefix)) return t(`reclamacoes.reason.${prefix}`)
  return claim.reason_name ?? claim.reason?.label ?? id ?? t('reclamacoes.reasonFallback')
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(s?: string | null) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function dueDateColor(due?: string | null): string {
  if (!due) return '#71717a'
  const diff = new Date(due).getTime() - Date.now()
  if (diff <= 0)              return '#f87171'   // vencido
  if (diff < 24*60*60*1000)   return '#facc15'   // <24h
  if (diff < 72*60*60*1000)   return '#fb923c'   // <3d
  return '#a1a1aa'
}

// conta ML dona do claim (carimbada pelo backend; fallback no player respondent)
const claimSellerId = (c: Claim): number | null =>
  c.seller_id ?? (c.players ?? []).find(p => p.role === 'respondent')?.user_id ?? null

// chip do nome da conta/loja — identidade visível em card e drawer
function AccountChip({ name }: { name?: string | null }) {
  if (!name) return null
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
      style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
      <Store size={9} /> {name}
    </span>
  )
}

// ── Claim card ────────────────────────────────────────────────────────────────

function ClaimCard({ claim, accountName, onOpen }: { claim: Claim; accountName?: string | null; onOpen: () => void }) {
  const t = useTranslations('atendimento')
  const reasonLbl = getReasonLabel(t, claim)
  const stCfg     = getStatusCfg(t, claim.status)
  const buyer     = (claim.players ?? []).find(p => p.role === 'complainant')
  const typeLbl   = getTypeLabel(t, claim.type)
  const stageLbl  = getStageLabel(t, claim.stage)

  return (
    <button onClick={onOpen}
      className="text-left rounded-2xl p-4 space-y-3 transition-all hover:border-zinc-700"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-zinc-500">#{claim.id}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: stCfg.bg, color: stCfg.color }}>
            {stCfg.label}
          </span>
          <AccountChip name={accountName} />
        </div>
        <span className="text-[10px] text-zinc-600">{timeAgo(claim.last_updated ?? claim.date_created)}</span>
      </div>

      <p className="text-sm text-zinc-200 font-medium leading-tight">{reasonLbl}</p>

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-zinc-500">
        {typeLbl  && <span className="px-1.5 py-0.5 rounded bg-zinc-900">{typeLbl}</span>}
        {stageLbl && <span className="px-1.5 py-0.5 rounded bg-zinc-900">{stageLbl}</span>}
        {buyer && <span>{t('reclamacoes.buyer', { id: buyer.user_id })}</span>}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <span className="text-[10px] text-zinc-600">{fmtDate(claim.date_created)}</span>
        <span className="text-[10px] text-[#00E5FF] flex items-center gap-1">
          {t('reclamacoes.viewDetails')} <MessageSquare size={10} />
        </span>
      </div>
    </button>
  )
}

// ── Resolução ML (recomendação IA + executar ação real no ML) ───────────────

function MlResolutionSection({ claimId, sellerId, onActed }: { claimId: string | number; sellerId?: number; onActed: () => void }) {
  const t = useTranslations('atendimento')
  const [res,        setRes]        = useState<MlResolution>(null)
  const [loading,    setLoading]    = useState(true)
  const [confirming, setConfirming] = useState<MlResolutionAction | null>(null)
  const [working,    setWorking]    = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const qs = sellerId != null ? `?seller_id=${sellerId}` : ''
      const r = await fetch(`${BACKEND}/ml/claims/${claimId}/resolution${qs}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (r.ok) setRes(await r.json() as MlResolution)
    } catch { /* silent */ }
    setLoading(false)
  }, [claimId, sellerId])

  useEffect(() => { load() }, [load])

  const execute = async (act: MlResolutionAction) => {
    setWorking(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const r = await fetch(`${BACKEND}/ml/claims/${claimId}/action`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: act.action, seller_id: res?.seller_id ?? sellerId }),
      })
      if (!r.ok) {
        const txt = await r.text()
        let msg = txt.slice(0, 300)
        try { msg = JSON.parse(txt)?.message ?? msg } catch { /* texto cru */ }
        throw new Error(msg || `HTTP ${r.status}`)
      }
      setDone(true)
      setConfirming(null)
      setTimeout(onActed, 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  // só ações de DECISÃO (mensagens vão pela caixa de resposta abaixo)
  const decisionActions = (res?.actions ?? []).filter(a => !a.action.startsWith('send_message'))
  const rec = res?.recommendation ?? null

  if (loading) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.15)' }}>
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Sparkles size={13} className="text-[#00E5FF] animate-pulse" /> {t('reclamacoes.mlResolution.loading')}
        </p>
      </div>
    )
  }

  if (decisionActions.length === 0 && !rec) {
    return (
      <div className="rounded-xl p-4" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
        <p className="text-xs text-zinc-500">{t('reclamacoes.mlResolution.noActions')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.15)' }}>
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-[#00E5FF]" />
        <p className="text-xs font-semibold text-zinc-200">{t('reclamacoes.mlResolution.title')}</p>
        {rec && (
          <span className="text-[10px] text-zinc-500">
            {t('reclamacoes.playbook.confidence', { pct: Math.round(rec.confidence * 100) })}
          </span>
        )}
      </div>

      {rec && (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-300 leading-relaxed">{rec.rationale}</p>
          {rec.watch_out && (
            <p className="text-[11px] text-amber-300/90 flex items-start gap-1">
              <AlertCircle size={11} className="mt-0.5 flex-shrink-0" /> {rec.watch_out}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg p-3 text-xs"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}
      {done && (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle2 size={12} /> {t('reclamacoes.mlResolution.done')}
        </p>
      )}

      {!done && (confirming ? (() => {
        const danger = ML_ACTION_DANGER.has(confirming.action)
        const accent = danger ? '#f87171' : '#00E5FF'
        return (
          <div className="rounded-lg p-3 space-y-2"
            style={{ background: danger ? 'rgba(239,68,68,0.05)' : 'rgba(0,229,255,0.05)', border: `1px solid ${accent}33` }}>
            <p className="text-xs font-semibold text-zinc-200">{t('reclamacoes.mlResolution.confirmTitle')}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{mlActionConfirm(confirming.action, confirming.label)}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => execute(confirming)} disabled={working}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                style={{ background: accent, color: '#000' }}>
                {working ? t('reclamacoes.mlResolution.working') : t('reclamacoes.mlResolution.confirm')}
              </button>
              <button onClick={() => setConfirming(null)} disabled={working}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-700 text-zinc-400">
                {t('reclamacoes.mlResolution.cancel')}
              </button>
            </div>
          </div>
        )
      })() : (
        <div className="flex flex-col gap-1.5 pt-1">
          {decisionActions.map(a => {
            const isRec = rec?.recommended_action === a.action
            return (
              <button key={a.action} onClick={() => { setConfirming(a); setError('') }}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left"
                style={{
                  background: isRec ? 'rgba(74,222,128,0.10)' : 'rgba(255,255,255,0.03)',
                  border:     `1px solid ${isRec ? 'rgba(74,222,128,0.35)' : '#1e1e24'}`,
                  color:      isRec ? '#4ade80' : '#d4d4d8',
                }}>
                <span className="flex items-center gap-2">
                  {ML_ACTION_DANGER.has(a.action) ? <Scale size={13} /> : <CheckCircle2 size={13} />}
                  {a.label}
                </span>
                {isRec && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0"
                    style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                    <Sparkles size={9} /> {t('reclamacoes.mlResolution.bestOption')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function ClaimDrawer({ claim, accountName, onClose, onActed }: { claim: Claim; accountName?: string | null; onClose: () => void; onActed?: () => void }) {
  const t = useTranslations('atendimento')
  const [detail,   setDetail]   = useState<ClaimDetail>(null)
  const [messages, setMessages] = useState<ClaimMessage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [reply,    setReply]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  // conta ML dona do claim — direciona detalhe/mensagens/ações pra conta certa (multi-conta)
  const sellerId = claim.seller_id ?? (claim.players ?? []).find(p => p.role === 'respondent')?.user_id
  const sq = sellerId != null ? `?seller_id=${sellerId}` : ''

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }
    try {
      const [dRes, mRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/claims/${claim.id}/detail${sq}`, { headers: h }),
        fetch(`${BACKEND}/ml/claims/${claim.id}/messages${sq}`, { headers: h }),
      ])
      if (dRes.status === 'fulfilled' && dRes.value.ok) {
        const d = await dRes.value.json()
        setDetail(d as ClaimDetail)
      }
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const d = await mRes.value.json()
        setMessages(d?.messages ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [claim.id, sq])

  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!reply.trim() || reply.length < 5) {
      setError(t('reclamacoes.errors.tooShort'))
      return
    }
    setSending(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const h = { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
      const res = await fetch(`${BACKEND}/ml/claims/${claim.id}/messages`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ receiver_role: 'complainant', message: reply.trim(), seller_id: sellerId }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t.slice(0, 200) || `HTTP ${res.status}`)
      }
      setSent(true)
      setReply('')
      // Reload messages
      setTimeout(() => { setSent(false); load() }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reclamacoes.errors.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  const stCfg     = getStatusCfg(t, claim.status)
  const reasonLbl = getReasonLabel(t, claim)
  const typeLbl   = getTypeLabel(t, claim.type)
  const stageLbl  = getStageLabel(t, claim.stage)
  const mlUrl     = claim.resource_id
    ? `https://www.mercadolivre.com.br/vendas/${claim.resource_id}/detalhe`
    : null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40" />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[640px] bg-[#0a0a0c] border-l border-[#1e1e24] flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e1e24] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-500">#{claim.id}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: stCfg.bg, color: stCfg.color }}>
                {stCfg.label}
              </span>
              {typeLbl && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">{typeLbl}</span>}
              {stageLbl && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">{stageLbl}</span>}
              <AccountChip name={accountName} />
            </div>
            <p className="text-base font-semibold text-white">{reasonLbl}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {t('reclamacoes.openedUpdated', { opened: fmtDate(claim.date_created), updated: timeAgo(claim.last_updated) })}
            </p>
            {mlUrl && (
              <a href={mlUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#00E5FF] hover:underline mt-2">
                {t('reclamacoes.openSale')} <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <p className="text-xs text-zinc-600 text-center py-8">{t('reclamacoes.loading')}</p>}

          {!loading && detail && (detail.due_date || detail.action_responsible || detail.title || detail.description || detail.problem) && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
              {detail.title && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.detail.case')}</p>
                  <p className="text-sm text-white mt-1">{detail.title}</p>
                </div>
              )}
              {detail.problem && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.detail.problem')}</p>
                  <p className="text-sm text-zinc-300 mt-1">{detail.problem}</p>
                </div>
              )}
              {detail.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.detail.description')}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                    <Clock size={9} /> {t('reclamacoes.detail.deadline')}
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color: dueDateColor(detail.due_date) }}>
                    {fmtDate(detail.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.detail.responsible')}</p>
                  <p className="text-xs text-zinc-300 mt-1 capitalize">{detail.action_responsible ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resolução IA + ações reais no ML (só reclamações abertas) */}
          {!loading && (claim.status === 'opened' || !claim.status) && (
            <MlResolutionSection claimId={claim.id} sellerId={sellerId} onActed={onActed ?? load} />
          )}

          {/* Messages thread */}
          {!loading && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                {t('reclamacoes.messages', { count: messages.length })}
              </p>
              {messages.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">{t('reclamacoes.noMessages')}</p>
              ) : (
                messages.map((m, i) => {
                  const role = getRoleLabel(t, m.sender_role)
                  const text = m.message ?? m.text ?? ''
                  const date = m.date_created ?? m.date
                  return (
                    <div key={m.id ?? i} className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-semibold" style={{ color: role.color }}>
                          {role.label}
                        </span>
                        <span className="text-[10px] text-zinc-600">{timeAgo(date)}</span>
                        {m.stage && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500">{getStageLabel(t, m.stage)}</span>}
                      </div>
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{text}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments.map((a, j) => (
                            <a key={j} href={a.url ?? '#'} target="_blank" rel="noreferrer"
                              className="text-[10px] text-[#00E5FF] hover:underline px-2 py-0.5 rounded bg-[#00E5FF11]">
                              📎 {a.name ?? t('reclamacoes.attachment')}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Send reply (só se aberta) */}
        {(claim.status === 'opened' || !claim.status) && (
          <div className="p-4 border-t border-[#1e1e24] flex-shrink-0 space-y-2">
            <textarea
              value={reply}
              onChange={e => { setReply(e.target.value); setError('') }}
              placeholder={t('reclamacoes.replyPlaceholder')}
              maxLength={500}
              disabled={sending || sent}
              className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E5FF44] resize-y min-h-[80px] disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px]">
                {error && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={11} /> {error}
                  </span>
                )}
                {sent && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 size={11} /> {t('reclamacoes.sent')}
                  </span>
                )}
                <span className="text-zinc-600">{reply.length}/500</span>
              </div>
              <button onClick={send} disabled={sending || sent || !reply.trim() || reply.length < 5}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: sending || sent ? '#1e1e24' : 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)',
                  color:      sending || sent ? '#71717a' : '#000',
                }}>
                <Send size={13} />
                {sending ? t('reclamacoes.sending') : t('reclamacoes.reply')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Shopee return card ────────────────────────────────────────────────────────

function ShopeeReturnCard({ ret, shopName, onOpen }: { ret: ShopeeReturn; shopName: string; onOpen: () => void }) {
  const t = useTranslations('atendimento')
  const stCfg = getShopeeStatusCfg(t, ret.status)
  const reasonLbl = getShopeeReasonLabel(t, ret)
  const isOpen = SHOPEE_OPEN_STATUSES.includes(ret.status ?? '')

  return (
    <button onClick={onOpen}
      className="text-left rounded-2xl p-4 space-y-3 transition-all hover:border-zinc-700"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500">{ret.return_sn}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: stCfg.bg, color: stCfg.color }}>
            {stCfg.label}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">{timeAgo(ret.return_update_at ?? ret.return_create_at)}</span>
      </div>

      <p className="text-sm text-zinc-200 font-medium leading-tight">{reasonLbl}</p>
      {ret.text_reason && (
        <p className="text-xs text-zinc-500 leading-snug line-clamp-2">“{ret.text_reason}”</p>
      )}

      {/* selo da recomendação do playbook IA */}
      {isOpen && ret.playbook_action && PLAYBOOK_BADGE[ret.playbook_action] && (() => {
        const pb = PLAYBOOK_BADGE[ret.playbook_action]
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: pb.bg, color: pb.color, border: `1px solid ${pb.color}33` }}>
            <Sparkles size={9} /> {t(`reclamacoes.playbook.badge.${ret.playbook_action}`)}
          </span>
        )
      })()}

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-zinc-500">
        <span className="px-1.5 py-0.5 rounded bg-zinc-900">🏬 {shopName}</span>
        {ret.buyer_username && <span>{ret.buyer_username}</span>}
        <span className="font-semibold text-zinc-400">{brlFmt(ret.refund_amount)}</span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <span className="text-[10px]" style={{ color: isOpen ? dueDateColor(ret.due_date) : '#52525b' }}>
          {isOpen && ret.due_date
            ? t('reclamacoes.shopee.dueBy', { date: fmtDate(ret.due_date) })
            : fmtDate(ret.return_create_at)}
        </span>
        <span className="text-[10px] text-[#00E5FF] flex items-center gap-1">
          {t('reclamacoes.viewDetails')} <MessageSquare size={10} />
        </span>
      </div>
    </button>
  )
}

// ── Playbook IA (recomendação + ações reais na Shopee) ──────────────────────

function authHeaders(token: string | undefined): Record<string, string> {
  return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' }
}

function ShopeePlaybookSection({ ret, onActed }: { ret: ShopeeReturn; onActed: () => void }) {
  const t = useTranslations('atendimento')
  const [confirming,  setConfirming]  = useState<'accept' | 'accept_offer' | null>(null)
  const [disputing,   setDisputing]   = useState(false)
  const [reasons,     setReasons]     = useState<DisputeReason[]>([])
  const [reasonCode,  setReasonCode]  = useState<number | null>(null)
  const [disputeText, setDisputeText] = useState('')
  const [usePhotos,   setUsePhotos]   = useState(true)
  const [working,     setWorking]     = useState(false)
  const [loadingDoss, setLoadingDoss] = useState(false)
  const [error,       setError]       = useState('')
  const [done,        setDone]        = useState(false)

  const isOpen = SHOPEE_OPEN_STATUSES.includes(ret.status ?? '') && ret.status !== 'SELLER_DISPUTE'
  const action = ret.playbook_action
  const pb = action ? PLAYBOOK_BADGE[action] : null
  const negotiation = ret.playbook_meta?.negotiation
  const offerPending = negotiation?.negotiation_status === 'PENDING_RESPOND'

  const call = async (path: string, body?: unknown) => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const res = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: authHeaders(session?.access_token),
      body: body != null ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const txt = await res.text()
      let msg = txt.slice(0, 300)
      try { msg = JSON.parse(txt)?.message ?? msg } catch { /* texto cru */ }
      throw new Error(msg || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const execute = async (kind: 'accept' | 'accept_offer') => {
    setWorking(true)
    setError('')
    try {
      await call(`/shopee/returns-playbook/${ret.return_sn}/${kind === 'accept' ? 'accept' : 'accept-offer'}`)
      setDone(true)
      setConfirming(null)
      setTimeout(onActed, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  const openDispute = async () => {
    setDisputing(true)
    setLoadingDoss(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/returns-playbook/${ret.return_sn}/dossier`, {
        headers: authHeaders(session?.access_token),
      })
      if (!res.ok) throw new Error(t('reclamacoes.playbook.dossierFail'))
      const d = await res.json()
      const list: DisputeReason[] = d?.dispute_reasons ?? []
      setReasons(list)
      if (list.length) setReasonCode(list[0].dispute_reason)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingDoss(false)
    }
  }

  const submitDispute = async () => {
    if (reasonCode == null) return
    setWorking(true)
    setError('')
    try {
      await call(`/shopee/returns-playbook/${ret.return_sn}/dispute`, {
        dispute_reason: reasonCode,
        text:           disputeText.trim() || undefined,
        images:         usePhotos ? (ret.raw?.image ?? []).slice(0, 5) : undefined,
      })
      setDone(true)
      setDisputing(false)
      setTimeout(onActed, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.15)' }}>
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-[#00E5FF]" />
        <p className="text-xs font-semibold text-zinc-200">{t('reclamacoes.playbook.title')}</p>
        {action && pb && (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: pb.bg, color: pb.color }}>
            <pb.Icon size={9} /> {t(`reclamacoes.playbook.badge.${action}`)}
          </span>
        )}
        {ret.playbook_confidence != null && (
          <span className="text-[10px] text-zinc-500">
            {t('reclamacoes.playbook.confidence', { pct: Math.round(Number(ret.playbook_confidence) * 100) })}
          </span>
        )}
      </div>

      {ret.playbook_rationale
        ? <p className="text-xs text-zinc-400 leading-relaxed">{ret.playbook_rationale}</p>
        : <p className="text-xs text-zinc-600 italic">{t('reclamacoes.playbook.noRecommendation')}</p>}

      {offerPending && negotiation?.latest_offer_amount != null && (
        <p className="text-[11px] text-amber-300/90 flex items-center gap-1">
          <AlertCircle size={11} /> {t('reclamacoes.playbook.offerPending', { amount: brlFmt(negotiation.latest_offer_amount) })}
        </p>
      )}

      {ret.playbook_executed_at && (
        <p className="text-[11px] text-green-400 flex items-center gap-1">
          <ShieldCheck size={11} />
          {t('reclamacoes.playbook.executedAt', {
            action: t(`reclamacoes.playbook.badge.${(ret.playbook_executed_action ?? 'accept') as PlaybookAction}`),
            date:   fmtDate(ret.playbook_executed_at),
          })}
        </p>
      )}

      {error && (
        <div className="rounded-lg p-3 text-xs"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}
      {done && (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle2 size={12} /> {t('reclamacoes.playbook.done')}
        </p>
      )}

      {/* botões de ação — só devolução aberta e ainda não executada */}
      {isOpen && !ret.playbook_executed_at && !done && (
        confirming ? (
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-semibold text-zinc-200">{t('reclamacoes.playbook.confirmTitle')}</p>
            <p className="text-xs text-zinc-400">
              {confirming === 'accept'
                ? t('reclamacoes.playbook.confirmAccept', { amount: brlFmt(ret.refund_amount) })
                : t('reclamacoes.playbook.confirmAcceptOffer', { amount: brlFmt(negotiation?.latest_offer_amount ?? ret.refund_amount) })}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => execute(confirming)} disabled={working}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                style={{ background: '#f87171', color: '#000' }}>
                {working ? t('reclamacoes.playbook.working') : t('reclamacoes.playbook.confirm')}
              </button>
              <button onClick={() => setConfirming(null)} disabled={working}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-700 text-zinc-400">
                {t('reclamacoes.playbook.cancel')}
              </button>
            </div>
          </div>
        ) : disputing ? (
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'rgba(192,132,252,0.05)', border: '1px solid rgba(192,132,252,0.2)' }}>
            <p className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
              <Scale size={12} /> {t('reclamacoes.playbook.disputeTitle')}
            </p>
            {loadingDoss ? (
              <p className="text-xs text-zinc-500">{t('reclamacoes.playbook.loadingDossier')}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.playbook.disputeReason')}</p>
                  {reasons.map(r => (
                    <label key={r.dispute_reason} className="flex items-start gap-2 cursor-pointer rounded-lg p-2"
                      style={{ background: reasonCode === r.dispute_reason ? 'rgba(192,132,252,0.1)' : 'transparent' }}>
                      <input type="radio" name="disputeReason" className="mt-0.5"
                        checked={reasonCode === r.dispute_reason}
                        onChange={() => setReasonCode(r.dispute_reason)} />
                      <span className="flex-1">
                        <span className="text-xs text-zinc-200 font-semibold">
                          {t('reclamacoes.playbook.disputeReasonN', { code: r.dispute_reason })}
                        </span>
                        {r.dispute_requirement && (
                          <span className="block text-[10px] text-zinc-500 mt-0.5 whitespace-pre-wrap leading-snug">
                            {r.dispute_requirement}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{t('reclamacoes.playbook.disputeText')}</p>
                  <textarea value={disputeText} onChange={e => setDisputeText(e.target.value)}
                    placeholder={t('reclamacoes.playbook.disputeTextPh')} maxLength={500}
                    className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#c084fc44] resize-y min-h-[60px]" />
                </div>
                {(ret.raw?.image?.length ?? 0) > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-400">
                    <input type="checkbox" checked={usePhotos} onChange={e => setUsePhotos(e.target.checked)} />
                    {t('reclamacoes.playbook.disputeUsePhotos')} ({ret.raw?.image?.length})
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={submitDispute} disabled={working || reasonCode == null}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50"
                    style={{ background: '#c084fc', color: '#000' }}>
                    {working ? t('reclamacoes.playbook.working') : t('reclamacoes.playbook.disputeSubmit')}
                  </button>
                  <button onClick={() => setDisputing(false)} disabled={working}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-zinc-700 text-zinc-400">
                    {t('reclamacoes.playbook.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button onClick={() => setConfirming('accept')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
              <CheckCircle2 size={12} /> {t('reclamacoes.playbook.actions.accept')}
            </button>
            {offerPending && (
              <button onClick={() => setConfirming('accept_offer')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                <CheckCircle2 size={12} /> {t('reclamacoes.playbook.actions.acceptOffer')}
              </button>
            )}
            <button onClick={openDispute}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ background: 'rgba(192,132,252,0.12)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)' }}>
              <Scale size={12} /> {t('reclamacoes.playbook.actions.dispute')}
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ── Shopee return drawer ──────────────────────────────────────────────────────

function ShopeeReturnDrawer({ ret, shopName, onClose, onActed }: { ret: ShopeeReturn; shopName: string; onClose: () => void; onActed: () => void }) {
  const t = useTranslations('atendimento')
  const stCfg = getShopeeStatusCfg(t, ret.status)
  const reasonLbl = getShopeeReasonLabel(t, ret)
  const photos = ret.raw?.image ?? []
  const videos = ret.raw?.buyer_videos ?? []
  const items  = ret.raw?.item ?? []
  const sellerUrl = ret.order_sn ? `https://seller.shopee.com.br/portal/sale/${ret.order_sn}` : null

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-40" />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[640px] bg-[#0a0a0c] border-l border-[#1e1e24] flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e1e24] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-500">{ret.return_sn}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: stCfg.bg, color: stCfg.color }}>
                {stCfg.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">🏬 {shopName}</span>
              {ret.needs_logistics && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                  {t('reclamacoes.shopee.needsLogistics')}
                </span>
              )}
            </div>
            <p className="text-base font-semibold text-white">{reasonLbl}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {t('reclamacoes.openedUpdated', { opened: fmtDate(ret.return_create_at), updated: timeAgo(ret.return_update_at) })}
            </p>
            {sellerUrl && (
              <a href={sellerUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#00E5FF] hover:underline mt-2">
                {t('reclamacoes.shopee.openOrder', { order: ret.order_sn ?? '' })} <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Playbook IA — recomendação + ações */}
          <ShopeePlaybookSection ret={ret} onActed={onActed} />

          {/* O que o comprador disse */}
          {ret.text_reason && (
            <div className="rounded-xl p-4" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.buyerSaid')}</p>
              <p className="text-sm text-zinc-200 mt-2 leading-relaxed whitespace-pre-wrap">“{ret.text_reason}”</p>
              {ret.buyer_username && <p className="text-[11px] text-zinc-500 mt-2">— {ret.buyer_username}</p>}
            </div>
          )}

          {/* Valores + prazos */}
          <div className="rounded-xl p-4 grid grid-cols-2 gap-3" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.refund')}</p>
              <p className="text-base font-bold text-white mt-1">{brlFmt(ret.refund_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                <Clock size={9} /> {t('reclamacoes.detail.deadline')}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: dueDateColor(ret.due_date) }}>
                {fmtDate(ret.due_date)}
              </p>
            </div>
            {ret.tracking_number && (
              <div className="col-span-2 pt-2 border-t border-zinc-800">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.tracking')}</p>
                <p className="text-xs font-mono text-zinc-300 mt-1">{ret.tracking_number}</p>
              </div>
            )}
          </div>

          {/* Itens devolvidos */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.items')}</p>
              {items.map((it, i) => (
                <div key={it.item_id ?? i} className="rounded-lg p-3 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {it.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.images[0]} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{it.name ?? '—'}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {it.item_sku ? `SKU ${it.item_sku} · ` : ''}{it.amount ?? 1}× {brlFmt(it.item_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fotos do comprador */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.photos')}</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-square rounded-lg object-cover border border-zinc-800 hover:border-zinc-600 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Vídeos do comprador */}
          {videos.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('reclamacoes.shopee.videos')}</p>
              <div className="flex flex-wrap gap-2">
                {videos.map((v, i) => (
                  <a key={i} href={v.video_url ?? '#'} target="_blank" rel="noreferrer"
                    className="text-[11px] text-[#00E5FF] hover:underline px-2 py-1 rounded bg-[#00E5FF11]">
                    ▶ {t('reclamacoes.shopee.video')} {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReclamacoesPage() {
  const t = useTranslations('atendimento')
  const { connections } = useMlAccount()
  const [channel,  setChannel]  = useState<ChannelKey>('ml')
  const [claims,   setClaims]   = useState<Claim[]>([])
  const [returns,  setReturns]  = useState<ShopeeReturn[]>([])
  const [shops,    setShops]    = useState<Array<{ shop_id: string; nickname: string }>>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterKey>('opened')
  const [accountFilter, setAccountFilter] = useState<string>('all')  // 'all' | seller_id | shop_id (string)
  const [selected, setSelected] = useState<Claim | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<ShopeeReturn | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // troca de canal zera o filtro de conta (contas de ML ≠ lojas Shopee)
  useEffect(() => { setAccountFilter('all') }, [channel])

  // nome da conta ML (mesma identidade do resto do sistema — via /ml/connections)
  const mlAccountName = useCallback((id?: number | null) =>
    id == null ? null : (connections.find(c => c.seller_id === id)?.nickname ?? `Conta ${id}`), [connections])

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }
    try {
      const [mlRes, shRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/claims`, { headers: h }),
        fetch(`${BACKEND}/shopee/sync/returns`, { headers: h }),
      ])
      if (mlRes.status === 'fulfilled' && mlRes.value.ok) {
        const d = await mlRes.value.json()
        setClaims(d?.data ?? d ?? [])
      }
      if (shRes.status === 'fulfilled' && shRes.value.ok) {
        const d = await shRes.value.json()
        setReturns(d?.returns ?? [])
        setShops(d?.shops ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // roda o motor do playbook (gera/atualiza recomendações IA) e recarrega
  const analyzeAll = useCallback(async () => {
    setAnalyzing(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      await fetch(`${BACKEND}/shopee/returns-playbook/run?force=true`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      await load()
    } catch { /* silent */ }
    setAnalyzing(false)
  }, [load])

  const shopName = useCallback((shopId: string | null) =>
    shops.find(s => s.shop_id === shopId)?.nickname ?? 'Shopee', [shops])

  // opções do filtro de conta do canal atual (só contas que têm casos)
  const accountOptions: Array<{ id: string; name: string }> = (() => {
    if (channel === 'ml') {
      const ids = Array.from(new Set(claims.map(c => claimSellerId(c)).filter((x): x is number => x != null)))
      return ids.map(id => ({ id: String(id), name: mlAccountName(id) ?? `Conta ${id}` }))
    }
    const ids = Array.from(new Set(returns.map(r => r.shop_id).filter((x): x is string => x != null)))
    return ids.map(id => ({ id, name: shopName(id) }))
  })()

  // por conta selecionada
  const claimByAccount = (c: Claim) => accountFilter === 'all' || String(claimSellerId(c)) === accountFilter
  const returnByAccount = (r: ShopeeReturn) => accountFilter === 'all' || String(r.shop_id) === accountFilter

  const accountClaims  = claims.filter(claimByAccount)
  const accountReturns = returns.filter(returnByAccount)

  const filtered = accountClaims.filter(c => {
    if (filter === 'all')    return true
    if (filter === 'opened') return (c.status ?? 'opened') === 'opened'
    return (c.status ?? '') !== 'opened'
  })

  const filteredReturns = accountReturns.filter(r => {
    const isOpen = SHOPEE_OPEN_STATUSES.includes(r.status ?? '')
    if (filter === 'all')    return true
    if (filter === 'opened') return isOpen
    return !isOpen
  })

  const openCount   = channel === 'ml'
    ? accountClaims.filter(c => (c.status ?? 'opened') === 'opened').length
    : accountReturns.filter(r => SHOPEE_OPEN_STATUSES.includes(r.status ?? '')).length
  const totalCount  = channel === 'ml' ? accountClaims.length : accountReturns.length
  const closedCount = totalCount - openCount

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: 'var(--background)' }}>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">{t('reclamacoes.eyebrow')}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">{t('reclamacoes.pageTitle')}</h2>
          <p className="text-zinc-500 text-xs mt-1">{t('reclamacoes.pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {channel === 'shopee' && (
            <button onClick={analyzeAll} disabled={analyzing || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
              style={{ borderColor: 'rgba(0,229,255,0.3)', color: '#00E5FF', background: 'rgba(0,229,255,0.06)' }}>
              <Sparkles size={13} className={analyzing ? 'animate-pulse' : ''} />
              {analyzing ? t('reclamacoes.playbook.analyzing') : t('reclamacoes.playbook.analyzeAll')}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {t('reclamacoes.refresh')}
          </button>
        </div>
      </div>

      {/* Canal: Mercado Livre | Shopee */}
      <div className="flex items-center gap-1.5">
        {([
          { key: 'ml' as ChannelKey,     label: 'Mercado Livre', count: claims.length },
          { key: 'shopee' as ChannelKey, label: 'Shopee',        count: returns.length },
        ]).map(({ key, label, count }) => (
          <button key={key} onClick={() => setChannel(key)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: channel === key ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      channel === key ? '#00E5FF' : '#52525b',
              border:     `1px solid ${channel === key ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {label}
            {count > 0 && (
              <span className="text-[9px] px-1.5 rounded-full"
                style={{ background: channel === key ? 'rgba(0,229,255,0.15)' : '#1e1e24' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('reclamacoes.kpi.total'),   value: totalCount,  color: '#a1a1aa' },
          { label: t('reclamacoes.kpi.opened'),  value: openCount,   color: openCount > 0 ? '#f87171' : '#4ade80' },
          { label: t('reclamacoes.kpi.closed'),  value: closedCount, color: '#71717a' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {(['all', 'opened', 'closed'] as FilterKey[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      filter === f ? '#00E5FF' : '#52525b',
              border:     `1px solid ${filter === f ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {t(`reclamacoes.filter.${f}`)}
          </button>
        ))}
      </div>

      {/* Filtro por conta/loja — só quando há mais de uma */}
      {accountOptions.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 mr-1 flex items-center gap-1">
            <Store size={11} /> {t('reclamacoes.account')}:
          </span>
          {[{ id: 'all', name: t('reclamacoes.allAccounts') }, ...accountOptions].map(opt => (
            <button key={opt.id} onClick={() => setAccountFilter(opt.id)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: accountFilter === opt.id ? 'rgba(0,229,255,0.1)' : 'transparent',
                color:      accountFilter === opt.id ? '#00E5FF' : '#52525b',
                border:     `1px solid ${accountFilter === opt.id ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
              }}>
              {opt.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">{t('reclamacoes.loading')}</div>
      ) : channel === 'ml' ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-sm text-zinc-400">
              {filter === 'opened' ? t('reclamacoes.emptyOpened') : t('reclamacoes.empty')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(c => <ClaimCard key={c.id} claim={c}
              accountName={mlAccountName(claimSellerId(c))} onOpen={() => setSelected(c)} />)}
          </div>
        )
      ) : (
        filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-sm text-zinc-400">{t('reclamacoes.shopee.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredReturns.map(r => (
              <ShopeeReturnCard key={r.id} ret={r} shopName={shopName(r.shop_id)}
                onOpen={() => setSelectedReturn(r)} />
            ))}
          </div>
        )
      )}

      {!loading && channel === 'ml' && openCount > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.12)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-red-400" />
            <p className="text-xs font-semibold text-zinc-300">{t('reclamacoes.tips.title')}</p>
          </div>
          <ul className="space-y-1 pl-2">
            {[
              t('reclamacoes.tips.tip1'),
              t('reclamacoes.tips.tip2'),
              t('reclamacoes.tips.tip3'),
            ].map(tip => (
              <li key={tip} className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                <span className="text-zinc-700 mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && <ClaimDrawer claim={selected} accountName={mlAccountName(claimSellerId(selected))}
        onClose={() => setSelected(null)}
        onActed={() => { setSelected(null); load() }} />}
      {selectedReturn && (
        <ShopeeReturnDrawer ret={selectedReturn} shopName={shopName(selectedReturn.shop_id)}
          onClose={() => setSelectedReturn(null)}
          onActed={() => { setSelectedReturn(null); load() }} />
      )}
    </div>
  )
}
