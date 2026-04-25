'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  User, Building2, Copy, CheckCircle2, LogOut, ShieldCheck,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgMember = {
  organization_id: string
  role: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded transition-colors" title="Copiar">
      {copied
        ? <CheckCircle2 size={12} className="text-green-400" />
        : <Copy size={12} className="text-zinc-600 hover:text-zinc-300" />
      }
    </button>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function InfoRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: '#1e1e24' }}>
      <span className="text-[11px] text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-zinc-200 font-medium">{value}</span>
        {copy && <CopyButton text={value} />}
      </div>
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = {
  owner:  'Proprietário',
  admin:  'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracoesGeralPage() {
  const [email,   setEmail]   = useState('')
  const [name,    setName]    = useState('')
  const [userId,  setUserId]  = useState('')
  const [member,  setMember]  = useState<OrgMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      setEmail(user.email ?? '')
      setName(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '')
      setUserId(user.id)
      sb.from('organization_members')
        .select('organization_id, role, created_at')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setMember(data); setLoading(false) })
    })
  }, [])

  async function signOut() {
    const sb = createClient()
    await sb.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      <div>
        <p className="text-zinc-500 text-xs">Configurações</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">Geral</h2>
        <p className="text-zinc-500 text-xs mt-1">Informações da sua conta e organização.</p>
      </div>

      {/* User */}
      <div className="rounded-2xl p-5 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2 mb-3">
          <User size={13} className="text-zinc-500" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Perfil</h3>
        </div>
        {loading ? (
          <p className="text-xs text-zinc-600">Carregando…</p>
        ) : (
          <>
            <InfoRow label="Nome"     value={name || '—'} />
            <InfoRow label="Email"    value={email || '—'} />
            <InfoRow label="User ID"  value={userId} copy />
            {member && (
              <InfoRow label="Função" value={ROLE_LABEL[member.role] ?? member.role} />
            )}
            {member && (
              <InfoRow label="Membro desde" value={fmtDate(member.created_at)} />
            )}
          </>
        )}
      </div>

      {/* Organization */}
      {member && (
        <div className="rounded-2xl p-5 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={13} className="text-zinc-500" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Organização</h3>
          </div>
          <InfoRow label="Org ID"    value={member.organization_id} copy />
          <InfoRow label="Plano"     value="Pro" />
        </div>
      )}

      {/* Security */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={13} className="text-zinc-500" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Segurança</h3>
        </div>
        <p className="text-[11px] text-zinc-500">
          Autenticação gerenciada via <strong className="text-zinc-300">Supabase Auth</strong>.
          Altere sua senha diretamente pelo link de redefinição enviado por e-mail.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}>
            <LogOut size={12} />
            Sair da conta
          </button>
        </div>
      </div>

      {/* Quick links to other settings */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Outras configurações</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Equipe',      href: '/dashboard/configuracoes/equipe' },
            { label: 'Integrações', href: '/dashboard/configuracoes/integracoes' },
            { label: 'Agregador',   href: '/dashboard/configuracoes/aggregator' },
            { label: 'IA',          href: '/dashboard/configuracoes/ia' },
          ].map(l => (
            <a key={l.href} href={l.href}
              className="flex items-center justify-center py-2.5 rounded-xl text-xs font-semibold transition-all text-center"
              style={{ background: 'rgba(255,255,255,0.03)', color: '#71717a', border: '1px solid #1e1e24' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e4e4e7'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#71717a'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
