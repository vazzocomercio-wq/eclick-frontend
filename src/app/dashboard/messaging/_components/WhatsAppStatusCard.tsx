'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { CheckCircle2, AlertCircle, RefreshCw, Send, Smartphone, Battery } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Status = {
  provider:  'zapi' | 'none' | string
  connected: boolean
  phone?:    string | null
  battery?:  number | null
  signal?:   number | null
  message?:  string
}

type Props = {
  onToast: (msg: string, type?: 'success' | 'error') => void
}

function fmtPhone(p?: string | null): string {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length < 10) return p
  const cc = d.length > 11 ? d.slice(0, 2) : '55'
  const rest = d.length > 11 ? d.slice(2) : d
  return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`
}

function relTime(iso: number): string {
  const s = Math.floor((Date.now() - iso) / 1000)
  if (s < 60) return `há ${s}s`
  if (s < 3600) return `há ${Math.floor(s / 60)}min`
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`
  return `há ${Math.floor(s / 86400)}d`
}

export function WhatsAppStatusCard({ onToast }: Props) {
  const [status, setStatus]     = useState<Status | null>(null)
  const [loading, setLoading]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [lastCheck, setLastCheck] = useState<number | null>(null)
  const [testPhone, setTestPhone] = useState('')

  const headers = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const h = await headers()
      const res = await fetch(`${BACKEND}/whatsapp/status`, { headers: h })
      const body = (await res.json().catch(() => null)) as Status | null
      if (body) setStatus(body)
      setLastCheck(Date.now())
    } catch {
      onToast('Falha ao consultar status', 'error')
    } finally {
      setLoading(false)
    }
  }, [headers, onToast])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const sendTest = useCallback(async () => {
    const phone = testPhone.replace(/\D/g, '')
    if (phone.length < 10) {
      onToast('Informe um número com DDD', 'error')
      return
    }
    setTesting(true)
    try {
      const h = await headers()
      const res = await fetch(`${BACKEND}/whatsapp/test`, {
        method: 'POST', headers: h, body: JSON.stringify({ phone }),
      })
      const body = (await res.json().catch(() => null)) as { success?: boolean; messageId?: string; error?: string } | null
      if (res.ok && body?.success) {
        onToast(`Teste enviado — id ${body.messageId ?? '?'}`, 'success')
      } else {
        onToast(body?.error ?? 'Falha ao enviar teste', 'error')
      }
    } catch {
      onToast('Erro de rede no envio de teste', 'error')
    } finally {
      setTesting(false)
    }
  }, [testPhone, headers, onToast])

  const connected = status?.connected === true
  const provider  = status?.provider ?? 'none'

  return (
    <div className="rounded-2xl p-4"
      style={{ background: '#111114', border: `1px solid ${connected ? 'rgba(74,222,128,0.30)' : 'rgba(248,113,113,0.30)'}` }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: connected ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)' }}>
            {connected
              ? <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
              : <AlertCircle  size={18} style={{ color: '#f87171' }} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-widest"
                style={{ color: connected ? '#4ade80' : '#f87171' }}>
                {connected ? '● Conectado' : '○ Desconectado'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                via {provider === 'zapi' ? 'Z-API' : provider}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-zinc-300 text-[12px] inline-flex items-center gap-1.5">
                <Smartphone size={11} className="text-zinc-500" />
                {fmtPhone(status?.phone)}
              </span>
              {typeof status?.battery === 'number' && (
                <span className="text-zinc-400 text-[11px] inline-flex items-center gap-1">
                  <Battery size={11} className="text-zinc-500" />
                  {status.battery}%
                </span>
              )}
              {lastCheck && (
                <span className="text-zinc-600 text-[10px]">checado {relTime(lastCheck)}</span>
              )}
            </div>
            {!connected && status?.message && (
              <p className="text-[11px] text-zinc-500 mt-1">{status.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchStatus} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border border-zinc-800 text-zinc-300 hover:bg-zinc-900/50 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Verificar conexão
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap"
        style={{ borderTop: '1px solid #1e1e24' }}>
        <span className="text-[11px] text-zinc-500 shrink-0">Enviar teste:</span>
        <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
          placeholder="5571999998050"
          className="flex-1 min-w-[180px] px-3 py-1.5 text-[12px] rounded-lg bg-[#0c0c10] border border-[#27272a] text-zinc-200 outline-none focus:border-[#00E5FF]" />
        <button onClick={sendTest} disabled={testing || !connected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-40"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
          <Send size={11} className={testing ? 'animate-pulse' : ''} />
          {testing ? 'Enviando…' : 'Enviar mensagem teste'}
        </button>
      </div>
    </div>
  )
}
