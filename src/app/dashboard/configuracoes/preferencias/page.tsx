'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Settings, Shield, Bell, Palette, User, Eye, Mail, Phone,
  IdCard, FileDown, History, Clock,
} from 'lucide-react'
import { ToastViewport, useToast, todoToast } from '@/hooks/useToast'
import { usePreferences } from '@/hooks/usePreferences'
import { formatPii } from '@/lib/format'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type TabKey = 'privacidade' | 'notificacoes' | 'aparencia' | 'conta'

const TABS: { key: TabKey; icon: React.ReactNode }[] = [
  { key: 'privacidade',  icon: <Shield  size={14} /> },
  { key: 'notificacoes', icon: <Bell    size={14} /> },
  { key: 'aparencia',    icon: <Palette size={14} /> },
  { key: 'conta',        icon: <User    size={14} /> },
]

export default function PreferenciasPage() {
  const t = useTranslations('configuracoes')
  const [tab, setTab] = useState<TabKey>('privacidade')
  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: 'var(--background)' }}>
      <ToastViewport />
      <div>
        <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">{t('preferencias.breadcrumb')}</p>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2">
          <Settings size={18} /> {t('preferencias.title')}
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">{t('preferencias.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: '#1e1e24' }}>
        {TABS.map(tb => {
          const active = tab === tb.key
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors"
              style={{
                color: active ? '#00E5FF' : '#a1a1aa',
                borderBottom: '2px solid ' + (active ? '#00E5FF' : 'transparent'),
                marginBottom: '-1px',
              }}>
              {tb.icon}{t(`preferencias.tab_${tb.key}` as 'preferencias.tab_privacidade')}
            </button>
          )
        })}
      </div>

      {tab === 'privacidade'  && <PrivacidadeTab  />}
      {tab === 'notificacoes' && <PlaceholderTab title={t('preferencias.tab_notificacoes')} hint={t('preferencias.placeholderNotificacoes')} />}
      {tab === 'aparencia'    && <PlaceholderTab title={t('preferencias.tab_aparencia')}    hint={t('preferencias.placeholderAparencia')} />}
      {tab === 'conta'        && <PlaceholderTab title={t('preferencias.tab_conta')}        hint={t('preferencias.placeholderConta')} />}
    </div>
  )
}

// ── Tab: Privacidade ─────────────────────────────────────────────────────────

function PrivacidadeTab() {
  const t = useTranslations('configuracoes')
  const { prefs, setPref, maskCpf, maskPhone, maskEmail, maskExport } = usePreferences()
  const toast = useToast()
  const supabase = useMemo(() => createClient(), [])

  // Card 4 — auditoria: lista últimas revelações
  const [reveals, setReveals] = useState<Array<{ field: string; customer_id: string | null; revealed_at: string }>>([])
  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch(`${BACKEND}/user-preferences/audit-reveal?limit=20`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const body = await res.json().catch(() => null) as Array<{ field: string; customer_id: string | null; revealed_at: string }> | null
        if (!canceled && body) setReveals(body)
      } catch {}
    })()
    return () => { canceled = true }
  }, [supabase])

  const setBool = useCallback((key: string, value: boolean) => {
    setPref(key, value ? 'true' : 'false')
    toast({ tone: 'success', message: t('preferencias.prefSaved') })
  }, [setPref, toast, t])

  const sample = '12345678900'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Card 1 — Mascaramento em listagens */}
      <Card title={t('preferencias.maskingTitle')}
        description={t('preferencias.maskingDesc')}>
        <Toggle
          icon={<IdCard size={12} />}
          label={t('preferencias.maskCpf')}
          checked={maskCpf}
          onChange={v => setBool('mask_cpf', v)}
          preview={`${formatPii('cpf', sample, true)}  →  ${formatPii('cpf', sample, false)}`}
        />
        <Toggle
          icon={<Phone size={12} />}
          label={t('preferencias.maskPhone')}
          checked={maskPhone}
          onChange={v => setBool('mask_phone', v)}
          preview={`${formatPii('phone', '5511912345678', true)}  →  ${formatPii('phone', '5511912345678', false)}`}
        />
        <Toggle
          icon={<Mail size={12} />}
          label={t('preferencias.maskEmail')}
          checked={maskEmail}
          onChange={v => setBool('mask_email', v)}
          preview={`${formatPii('email', 'fulano@gmail.com', true)}  →  ${formatPii('email', 'fulano@gmail.com', false)}`}
        />
      </Card>

      {/* Card 2 — Exportações */}
      <Card title={t('preferencias.exportTitle')}
        description={t('preferencias.exportDesc')}>
        <Toggle
          icon={<FileDown size={12} />}
          label={t('preferencias.maskExport')}
          checked={maskExport}
          onChange={v => setBool('mask_export', v)}
          preview={maskExport ? t('preferencias.exportPreviewMasked') : t('preferencias.exportPreviewFull')}
        />
      </Card>

      {/* Card 3 — Sessão */}
      <Card title={t('preferencias.sessionTitle')}
        description={t('preferencias.sessionDesc')}>
        <SessionRow
          icon={<Clock size={12} />}
          label={t('preferencias.revealTime')}
          value={prefs.reveal_ms ?? '30000'}
          options={[
            { v: '15000', l: '15s' },
            { v: '30000', l: t('preferencias.revealOption30Default') },
            { v: '60000', l: '1min' },
            { v: '300000', l: '5min' },
          ]}
          onChange={(v) => { setPref('reveal_ms', v); toast({ tone: 'success', message: t('preferencias.prefSaved') }) }}
        />
      </Card>

      {/* Card 4 — Auditoria */}
      <Card title={t('preferencias.auditTitle')}
        description={t('preferencias.auditDesc')}>
        <div className="space-y-1 max-h-[280px] overflow-y-auto -mx-1 px-1">
          {reveals.length === 0 ? (
            <p className="text-[11px] text-zinc-600 italic py-3 text-center flex items-center justify-center gap-1.5">
              <History size={12} /> {t('preferencias.noReveals')}
            </p>
          ) : reveals.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-1"
              style={{ borderTop: i > 0 ? '1px solid #1a1a1f' : undefined }}>
              <Eye size={10} className="text-zinc-600 shrink-0" />
              <span className="text-zinc-400 uppercase font-mono w-12 shrink-0">{r.field}</span>
              {r.customer_id && (
                <span className="text-zinc-600 font-mono truncate max-w-[100px]">{r.customer_id.slice(0, 8)}</span>
              )}
              <span className="text-zinc-500 ml-auto tabular-nums">
                {new Date(r.revealed_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
        <button onClick={() => todoToast(t('preferencias.exportAuditLogTodo'))}
          className="mt-3 w-full text-[11px] px-2 py-1.5 rounded-lg font-semibold transition-colors hover:bg-zinc-800/70"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          {t('preferencias.exportFullLog')}
        </button>
      </Card>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Card({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description && <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{description}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Toggle({ icon, label, preview, checked, onChange }: {
  icon?: React.ReactNode
  label: string
  preview?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="rounded-lg p-2.5"
      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-[12px] text-zinc-200">{label}</span>
        </div>
        <button onClick={() => onChange(!checked)}
          aria-pressed={checked}
          className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
          style={{ background: checked ? '#00E5FF' : '#27272a' }}>
          <span className="absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white transition-transform"
            style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
        </button>
      </div>
      {preview && (
        <p className="text-[10px] text-zinc-600 font-mono mt-1.5 ml-6 truncate">{preview}</p>
      )}
    </div>
  )
}

function SessionRow({ icon, label, value, options, onChange }: {
  icon?: React.ReactNode
  label: string
  value: string
  options: { v: string; l: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="rounded-lg p-2.5 flex items-center justify-between gap-2"
      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[12px] text-zinc-200">{label}</span>
      </div>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-[11px] bg-[#0c0c10] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function PlaceholderTab({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl p-8 flex flex-col items-center gap-2 text-center"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-zinc-300 font-semibold text-sm">{title}</p>
      <p className="text-[11px] text-zinc-600 max-w-md leading-snug">{hint}</p>
    </div>
  )
}
