'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Sparkles, CheckCircle2, Circle, ArrowRight } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ChannelRow { id: string; channel_type: string; status: string }
interface ManagerRow { id: string; verified: boolean; status: string }
interface HubConfig   { enabled: boolean }

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T | null> {
  const token = await getToken()
  if (!token) return null
  const res = await fetch(`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return res.json()
}

interface State {
  hasWhatsapp:    boolean
  hasManager:     boolean
  hubEnabled:     boolean
  loaded:         boolean
}

/**
 * Banner de onboarding mostrado quando o Intelligence Hub não está
 * 100% configurado. Cobre 3 pré-requisitos:
 *
 *   1. WhatsApp conectado (canal ativo) — pré-requisito pra envio
 *   2. 1+ gestor cadastrado e verificado
 *   3. Hub ativado (alert_hub_config.enabled = true)
 *
 * Aparece em /alertas, /relatorios e /configuracoes. Some quando todos
 * os 3 itens estão ok. Cada item tem CTA pra próxima ação.
 */
export default function OnboardingBanner() {
  const [state, setState] = useState<State>({
    hasWhatsapp: false, hasManager: false, hubEnabled: false, loaded: false,
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [channels, managers, hub] = await Promise.all([
        api<ChannelRow[]>('/channels'),
        api<ManagerRow[]>('/alert-managers'),
        api<HubConfig>('/alert-hub/config'),
      ])

      if (cancelled) return

      const hasWhatsapp = (channels ?? []).some(c => c.channel_type === 'whatsapp_free' && c.status === 'active')
      const hasManager  = (managers ?? []).some(m => m.verified && m.status === 'active')
      const hubEnabled  = hub?.enabled ?? false

      setState({ hasWhatsapp, hasManager, hubEnabled, loaded: true })
    })()

    return () => { cancelled = true }
  }, [])

  if (!state.loaded) return null
  if (state.hasWhatsapp && state.hasManager && state.hubEnabled) return null

  const steps = [
    {
      done:   state.hasWhatsapp,
      title:  'Conectar WhatsApp',
      sub:    'Canal pelo qual os alertas são enviados',
      href:   '/dashboard/canais',
      cta:    'Conectar canal',
    },
    {
      done:   state.hasManager,
      title:  'Cadastrar pelo menos 1 gestor',
      sub:    'Quem vai receber os alertas no WhatsApp',
      href:   '/dashboard/inteligencia/gestores',
      cta:    'Cadastrar gestor',
    },
    {
      done:   state.hubEnabled,
      title:  'Ativar o Intelligence Hub',
      sub:    'Liga os analyzers e cria as 7 regras default',
      href:   '/dashboard/inteligencia/configuracoes',
      cta:    'Ir pra configurações',
    },
  ]

  const completedCount = steps.filter(s => s.done).length

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(167,139,250,0.06) 100%)',
        border: '1px solid rgba(0,229,255,0.2)',
      }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Sparkles size={16} style={{ color: '#00E5FF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">Configure o Intelligence Hub</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {completedCount}/{steps.length} passos completos · termine pra começar a receber alertas inteligentes via WhatsApp
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{
              background: s.done ? 'rgba(74,222,128,0.05)' : '#18181b',
              border: `1px solid ${s.done ? 'rgba(74,222,128,0.15)' : '#27272a'}`,
            }}>
            {s.done
              ? <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
              : <Circle size={16} style={{ color: '#71717a', flexShrink: 0 }} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: s.done ? '#a1a1aa' : '#fff' }}>
                {i + 1}. {s.title}
              </p>
              <p className="text-[10px] text-zinc-500">{s.sub}</p>
            </div>
            {!s.done && (
              <Link href={s.href}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
                {s.cta}
                <ArrowRight size={11} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
