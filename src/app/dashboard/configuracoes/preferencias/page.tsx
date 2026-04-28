'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
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

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'privacidade',  label: 'Privacidade',   icon: <Shield  size={14} /> },
  { key: 'notificacoes', label: 'Notificações',  icon: <Bell    size={14} /> },
  { key: 'aparencia',    label: 'Aparência',     icon: <Palette size={14} /> },
  { key: 'conta',        label: 'Conta',         icon: <User    size={14} /> },
]

export default function PreferenciasPage() {
  const [tab, setTab] = useState<TabKey>('privacidade')
  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <ToastViewport />
      <div>
        <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Configurações</p>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2">
          <Settings size={18} /> Preferências
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">Privacidade, notificações, aparência e dados da conta</p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: '#1e1e24' }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors"
              style={{
                color: active ? '#00E5FF' : '#a1a1aa',
                borderBottom: '2px solid ' + (active ? '#00E5FF' : 'transparent'),
                marginBottom: '-1px',
              }}>
              {t.icon}{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'privacidade'  && <PrivacidadeTab  />}
      {tab === 'notificacoes' && <PlaceholderTab title="Notificações" hint="Gatilhos de e-mail / Slack / WhatsApp ainda não implementados." />}
      {tab === 'aparencia'    && <PlaceholderTab title="Aparência"    hint="Tema dark/light, densidade da tabela, idioma." />}
      {tab === 'conta'        && <PlaceholderTab title="Conta"        hint="Email, senha, sessões ativas, exportar dados." />}
    </div>
  )
}

// ── Tab: Privacidade ─────────────────────────────────────────────────────────

function PrivacidadeTab() {
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
    toast({ tone: 'success', message: 'Preferência salva' })
  }, [setPref, toast])

  const sample = '12345678900'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Card 1 — Mascaramento em listagens */}
      <Card title="Mascaramento em listagens"
        description="Como CPF, telefone e email aparecem em tabelas (clientes, pedidos, etc). O dado completo continua disponível ao clicar no ícone do olho.">
        <Toggle
          icon={<IdCard size={12} />}
          label="Mascarar CPF/CNPJ"
          checked={maskCpf}
          onChange={v => setBool('mask_cpf', v)}
          preview={`${formatPii('cpf', sample, true)}  →  ${formatPii('cpf', sample, false)}`}
        />
        <Toggle
          icon={<Phone size={12} />}
          label="Mascarar telefone"
          checked={maskPhone}
          onChange={v => setBool('mask_phone', v)}
          preview={`${formatPii('phone', '5511912345678', true)}  →  ${formatPii('phone', '5511912345678', false)}`}
        />
        <Toggle
          icon={<Mail size={12} />}
          label="Mascarar email"
          checked={maskEmail}
          onChange={v => setBool('mask_email', v)}
          preview={`${formatPii('email', 'fulano@gmail.com', true)}  →  ${formatPii('email', 'fulano@gmail.com', false)}`}
        />
      </Card>

      {/* Card 2 — Exportações */}
      <Card title="Exportações"
        description="Como dados pessoais aparecem em CSV exportado. CSV é offline — geralmente útil em texto pleno, mas você pode forçar mascaramento aqui.">
        <Toggle
          icon={<FileDown size={12} />}
          label="Mascarar dados pessoais ao exportar CSV"
          checked={maskExport}
          onChange={v => setBool('mask_export', v)}
          preview={maskExport ? 'CSV terá CPFs/telefones/emails mascarados' : 'CSV terá CPFs/telefones/emails completos'}
        />
      </Card>

      {/* Card 3 — Sessão */}
      <Card title="Sessão de revelação"
        description="Quando você clica no olho, por quanto tempo o dado completo fica visível antes de mascarar de novo.">
        <SessionRow
          icon={<Clock size={12} />}
          label="Tempo de revelação automática"
          value={prefs.reveal_ms ?? '30000'}
          options={[
            { v: '15000', l: '15s' },
            { v: '30000', l: '30s (padrão)' },
            { v: '60000', l: '1min' },
            { v: '300000', l: '5min' },
          ]}
          onChange={(v) => { setPref('reveal_ms', v); toast({ tone: 'success', message: 'Preferência salva' }) }}
        />
      </Card>

      {/* Card 4 — Auditoria */}
      <Card title="Auditoria de revelações"
        description="Toda vez que você clica no olho pra ver um CPF/telefone/email completo, registramos aqui (LGPD).">
        <div className="space-y-1 max-h-[280px] overflow-y-auto -mx-1 px-1">
          {reveals.length === 0 ? (
            <p className="text-[11px] text-zinc-600 italic py-3 text-center flex items-center justify-center gap-1.5">
              <History size={12} /> Nenhuma revelação registrada ainda
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
        <button onClick={() => todoToast('Exportar log de auditoria')}
          className="mt-3 w-full text-[11px] px-2 py-1.5 rounded-lg font-semibold transition-colors hover:bg-zinc-800/70"
          style={{ background: '#0c0c10', color: '#a1a1aa', border: '1px solid #27272a' }}>
          Exportar log completo
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
