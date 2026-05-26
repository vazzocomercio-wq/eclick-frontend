'use client'

/**
 * Tela de "análise rodando" — NÃO é spinner genérico: sequência narrativa de
 * passos com checkmark + barra de progresso + fatos rotativos dos papers.
 * Polla GET /public/audits/:id a cada 3s; quando status=done|failed redireciona
 * pro resultado.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { BACKEND, type PublicAuditStatus } from './auditResult'
import { ForceDarkTheme } from './ForceDarkTheme'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'

const STEPS = [
  'URL recebida e validada',
  'Conteúdo da página extraído',
  'Consultando o que a IA "enxerga"',
  'Avaliando as 8 dimensões de visibilidade',
  'Simulando seu ranking contra concorrentes',
  'Compilando seu resultado',
]

const FACTS = [
  'Sites de rank BAIXO se beneficiam MAIS de GEO: +115% pra quem estava em 5º lugar (KDD 2024).',
  'Encher de palavra-chave PIORA a visibilidade em IA — o oposto do velho SEO.',
  'Citar estatísticas e fontes pode aumentar sua citação pela IA em até +40%.',
  'A IA "pensa" em formato de pergunta — por isso FAQ é tão poderoso.',
  'Descrições com dados concretos são citadas muito mais que descrições genéricas.',
]

export function LoadingClient({ id }: { id: string }) {
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [factIdx, setFactIdx] = useState(0)
  const [platform, setPlatform] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const doneRef = useRef(false)

  // Polling do status
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND}/public/audits/${id}`)
        if (!r.ok) return
        const b = (await r.json()) as PublicAuditStatus
        if (!alive) return
        if (b.platform) setPlatform(b.platform)
        if ((b.status === 'done' || b.status === 'failed') && !doneRef.current) {
          doneRef.current = true
          setStepIdx(STEPS.length)
          setTimeout(() => router.replace(`/auditoria-gratis/resultado/${id}`), 650)
        }
      } catch { /* ignora, tenta de novo */ }
    }
    poll()
    const iv = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(iv) }
  }, [id, router])

  // Avanço narrativo dos passos (para no penúltimo até o status confirmar done)
  useEffect(() => {
    const iv = setInterval(() => {
      setStepIdx((i) => (doneRef.current ? STEPS.length : Math.min(i + 1, STEPS.length - 1)))
    }, 1300)
    return () => clearInterval(iv)
  }, [])

  // Fatos rotativos + cronômetro
  useEffect(() => {
    const f = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 8000)
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => { clearInterval(f); clearInterval(t) }
  }, [])

  const pct = doneRef.current ? 100 : Math.min(92, Math.round(((stepIdx + 1) / STEPS.length) * 92))

  return (
    <div style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: '.au-spin{animation:au-spin .8s linear infinite}@keyframes au-spin{to{transform:rotate(360deg)}}' }} />
      <div style={{ width: '100%', maxWidth: 540, background: '#121214', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 'clamp(24px,4vw,40px)' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, textAlign: 'center' }}>
          Analisando seu produto…
        </h1>
        {platform && (
          <p style={{ textAlign: 'center', color: '#71717a', fontSize: 13, margin: '8px 0 0' }}>
            Plataforma detectada: <span style={{ color: CYAN }}>{platformLabel(platform)}</span>
          </p>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0' }}>
          {STEPS.map((s, i) => {
            const done = i < stepIdx || doneRef.current
            const active = i === stepIdx && !doneRef.current
            return (
              <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', opacity: done || active ? 1 : 0.4, transition: 'opacity .3s' }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? `${GREEN}22` : active ? `${CYAN}18` : 'rgba(255,255,255,0.05)' }}>
                  {done ? <Check size={14} color={GREEN} /> : active ? <Loader2 size={13} color={CYAN} className="au-spin" /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: '#52525b' }} />}
                </span>
                <span style={{ fontSize: 14.5, color: done ? '#fafafa' : active ? '#e4e4e7' : '#a1a1aa' }}>{s}</span>
              </li>
            )
          })}
        </ul>

        <div style={{ marginTop: 22, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${CYAN}, ${GREEN})`, borderRadius: 999, transition: 'width .6s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#71717a' }}>
          <span>{pct}%</span>
          <span>⏱ {elapsed < 90 ? `~${Math.max(0, 70 - elapsed)}s restantes` : 'quase lá…'}</span>
        </div>

        <div style={{ marginTop: 26, padding: '16px 18px', borderRadius: 12, background: 'rgba(0,229,255,0.05)', border: `1px solid ${CYAN}22` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: CYAN, marginBottom: 6 }}>💡 SABIA?</div>
          <p style={{ fontSize: 13.5, color: '#d4d4d8', lineHeight: 1.55, margin: 0 }}>{FACTS[factIdx]}</p>
        </div>
      </div>
    </div>
  )
}

function platformLabel(p: string): string {
  const map: Record<string, string> = {
    mercadolivre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu', generic: 'Loja / site',
  }
  return map[p] ?? p
}
