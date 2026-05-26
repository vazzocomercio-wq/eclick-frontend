'use client'

/**
 * Descadastro (LGPD). Botão de confirmação (POST) — não auto-descadastra em
 * prefetch de scanners de email (que fazem GET). Chama /public/audits/unsubscribe.
 */
import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { BACKEND } from './auditResult'
import { ForceDarkTheme } from './ForceDarkTheme'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'

export function UnsubClient({ aid }: { aid: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function confirm() {
    if (!aid) { setState('error'); return }
    setState('loading')
    try {
      const r = await fetch(`${BACKEND}/public/audits/unsubscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: aid }),
      })
      setState(r.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  return (
    <div style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: '.au-spin{animation:au-spin .8s linear infinite}@keyframes au-spin{to{transform:rotate(360deg)}}' }} />
      <div style={{ width: '100%', maxWidth: 460, background: '#121214', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 'clamp(24px,4vw,36px)', textAlign: 'center' }}>
        {state === 'done' ? (
          <>
            <CheckCircle2 size={40} color={GREEN} style={{ margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Pronto, você foi removido</h1>
            <p style={{ color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, margin: '12px 0 0' }}>
              Você não receberá mais nossos emails e mensagens da Auditoria GEO. Sentiremos sua falta!
            </p>
          </>
        ) : state === 'error' ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Não foi possível concluir</h1>
            <p style={{ color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, margin: '12px 0 18px' }}>
              Tente de novo, ou escreva pra <a href="mailto:privacidade@eclick.app.br" style={{ color: CYAN }}>privacidade@eclick.app.br</a> que removemos manualmente.
            </p>
            <button onClick={confirm} style={btn}>Tentar de novo</button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Descadastrar dos emails</h1>
            <p style={{ color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, margin: '12px 0 20px' }}>
              Confirma que não quer mais receber emails e mensagens da Auditoria GEO da e-Click?
            </p>
            <button onClick={confirm} disabled={state === 'loading'} style={btn}>
              {state === 'loading'
                ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Loader2 size={16} className="au-spin" /> Removendo…</span>)
                : 'Confirmar descadastro'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  background: CYAN, color: '#04141a', border: 'none', borderRadius: 12,
  padding: '13px 24px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
}
