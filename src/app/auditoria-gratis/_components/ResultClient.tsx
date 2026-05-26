'use client'

/**
 * Tela de RESULTADO da Auditoria GEO — a peça que viraliza no print.
 * Busca GET /public/audits/:id; renderiza gauge animado + 8 dimensões +
 * top-3 problemas (SEM a reescrita — produto pago) + mini rank sim + CTA.
 * Estados: running (volta pro loading), failed/skipped (mensagem gentil), done.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Share2, ArrowRight, Loader2 } from 'lucide-react'
import { BACKEND, BAND_COLOR, bandLabel, type PublicAuditResult, type PublicAuditStatus } from './auditResult'
import { ForceDarkTheme } from './ForceDarkTheme'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'
const DEMO_URL = 'https://eclick.app.br' // TODO: trocar pelo link real de demo/Calendly

export function ResultClient({ id }: { id: string }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'done' | 'failed' | 'error'>('loading')
  const [result, setResult] = useState<PublicAuditResult | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch(`${BACKEND}/public/audits/${id}`)
        if (!r.ok) { if (alive) setState('error'); return }
        const b = (await r.json()) as PublicAuditStatus
        if (!alive) return
        if (b.status === 'running') { router.replace(`/auditoria-gratis/loading/${id}`); return }
        if (b.status === 'failed' || !b.result) { setState('failed'); return }
        setResult(b.result); setState('done')
      } catch { if (alive) setState('error') }
    })()
    return () => { alive = false }
  }, [id, router])

  if (state === 'loading') return <Centered><Loader2 size={26} color={CYAN} className="au-spin" /> <span style={{ marginLeft: 10 }}>Carregando seu resultado…</span></Centered>
  if (state === 'error') return <Centered>Não encontramos essa auditoria. <Link href="/auditoria-gratis" style={{ color: CYAN, marginLeft: 6 }}>Fazer uma nova →</Link></Centered>
  if (state === 'failed' || !result) return <FailedView />
  if (result.skipped) return <SkippedView reason={result.skipped.reason} />

  return <DoneView result={result} id={id} />
}

function DoneView({ result, id }: { result: PublicAuditResult; id: string }) {
  const color = BAND_COLOR[result.band]
  return (
    <Shell>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em' }}>e<span style={{ color: CYAN }}>-</span>Click</span>
        <ShareButton />
      </div>

      <p style={{ color: '#a1a1aa', fontSize: 15, margin: '0 0 18px' }}>Aqui está o que a IA enxerga do seu produto:</p>

      {/* Gauge */}
      <div style={card({ textAlign: 'center', padding: 'clamp(28px,4vw,40px)' })}>
        <Gauge score={result.score} color={color} />
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color }}>{bandLabel(result.band)}</div>
        <p style={{ fontSize: 'clamp(1.1rem,2.4vw,1.5rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: '14px auto 0', maxWidth: 520, lineHeight: 1.25 }}>
          {result.headline}
        </p>
      </div>

      {/* Dimensões */}
      <SectionTitle>Como a IA vê seu produto (8 dimensões)</SectionTitle>
      <div style={card({})}>
        {result.dimensions.map((d) => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: BAND_COLOR[d.status], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: '#e4e4e7' }}>{d.label}</span>
            <span style={{ width: 90, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ display: 'block', height: '100%', width: `${d.score}%`, background: BAND_COLOR[d.status] }} />
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, color: BAND_COLOR[d.status], minWidth: 52, textAlign: 'right' }}>{d.score}/100</span>
          </div>
        ))}
      </div>

      {/* Top 3 problemas */}
      {result.topProblems.length > 0 && (
        <>
          <SectionTitle>Os {result.topProblems.length} problemas mais críticos</SectionTitle>
          <div style={{ display: 'grid', gap: 12 }}>
            {result.topProblems.map((p) => (
              <div key={p.rank} style={card({ display: 'flex', gap: 16, alignItems: 'flex-start' })}>
                <span style={{ fontSize: 38, fontWeight: 900, color: CYAN, lineHeight: 1, fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{p.rank}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{p.title}</h3>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: GREEN, background: `${GREEN}1a`, border: `1px solid ${GREEN}44`, borderRadius: 999, padding: '2px 9px' }}>{p.gain}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, margin: '8px 0 0' }}>{p.why}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Mini rank simulator */}
      {result.rankSimulation && (
        <>
          <SectionTitle>Como a IA te compara aos concorrentes</SectionTitle>
          <div style={card({})}>
            <div style={{ fontSize: 12.5, color: '#71717a', marginBottom: 6 }}>Pergunta testada:</div>
            <p style={{ fontSize: 15, color: '#e4e4e7', fontStyle: 'italic', margin: '0 0 16px' }}>“{result.rankSimulation.query}”</p>
            {result.rankSimulation.your_rank != null ? (
              <p style={{ fontSize: 15, color: '#fafafa', margin: 0 }}>
                Numa busca típica do seu segmento, seu produto apareceu em torno do{' '}
                <strong style={{ color: CYAN }}>{result.rankSimulation.your_rank}º lugar</strong>{' '}
                entre {result.rankSimulation.candidate_count} opções.
              </p>
            ) : (
              <p style={{ fontSize: 15, color: '#fafafa', margin: 0 }}>
                <strong style={{ color: '#EF4444' }}>Seu produto não apareceu</strong> entre as primeiras opções que a IA citaria.
              </p>
            )}
          </div>
        </>
      )}

      {/* CTA */}
      <div style={card({ marginTop: 24, background: 'linear-gradient(160deg, rgba(0,229,255,0.06), rgba(18,18,20,0.5))', textAlign: 'center', padding: 'clamp(26px,4vw,40px)' })}>
        <h2 style={{ fontSize: 'clamp(1.3rem,3vw,1.9rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
          Quer que a gente conserte isso pra você?
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '18px auto 0', maxWidth: 420, textAlign: 'left', display: 'grid', gap: 8 }}>
          {[
            'Mede a nota GEO de TODOS os seus anúncios',
            'Reescreve com IA e publica direto no Mercado Livre',
            'Simula o ranking ANTES de publicar',
            'Prova o impacto em vendas em 30 dias',
          ].map((t) => (
            <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14.5, color: '#d4d4d8' }}>
              <span style={{ color: GREEN, fontWeight: 800 }}>✓</span> {t}
            </li>
          ))}
        </ul>
        <DemoCTA id={id} />
        <p style={{ fontSize: 13, color: '#71717a', margin: '16px 0 0' }}>
          Também enviamos sua auditoria detalhada no seu email e WhatsApp. Ou{' '}
          <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" style={{ color: CYAN }}>conheça o e-Click</a>.
        </p>
      </div>

      <p style={{ fontSize: 11.5, color: '#52525b', textAlign: 'center', margin: '24px 0 0' }}>
        Análise baseada em pesquisa do KDD 2024 (Princeton) e E-GEO 2025 (Columbia + MIT).
      </p>
    </Shell>
  )
}

function Gauge({ score, color }: { score: number; color: string }) {
  const [mounted, setMounted] = useState(false)
  const [n, setN] = useState(0)
  const R = 76, C = 2 * Math.PI * R
  useEffect(() => {
    setMounted(true)
    const dur = 1100, start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      setN(Math.round(k * score))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score])
  const offset = mounted ? C * (1 - score / 100) : C
  return (
    <div style={{ position: 'relative', width: 188, height: 188, margin: '0 auto' }}>
      <svg width="188" height="188" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="94" cy="94" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle cx="94" cy="94" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 52, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', lineHeight: 1 }}>{n}</span>
        <span style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>/100 · Nota GEO</span>
      </div>
    </div>
  )
}

function DemoCTA({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'queued'>('idle')
  async function go() {
    setState('loading')
    try {
      const r = await fetch(`${BACKEND}/public/audits/request-demo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit_id: id }),
      })
      const b = await r.json().catch(() => null) as { proposed?: boolean } | null
      setState(b?.proposed ? 'sent' : 'queued')
    } catch { setState('queued') }
  }
  if (state === 'sent') {
    return (
      <p style={{ marginTop: 22, fontSize: 15, color: GREEN, fontWeight: 600, lineHeight: 1.6 }}>
        ✅ Pronto! Te enviamos <strong>3 horários no seu WhatsApp</strong> agora — é só responder com o número que prefere.
      </p>
    )
  }
  if (state === 'queued') {
    return (
      <p style={{ marginTop: 22, fontSize: 15, color: GREEN, fontWeight: 600, lineHeight: 1.6 }}>
        ✅ Recebido! Nosso time vai entrar em contato pra agendar sua demo.
      </p>
    )
  }
  return (
    <button onClick={go} disabled={state === 'loading'} className="submit-glow"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24, background: CYAN, color: '#04141a', border: 'none', borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 800, cursor: state === 'loading' ? 'wait' : 'pointer' }}>
      {state === 'loading'
        ? (<><Loader2 size={18} className="au-spin" /> Enviando…</>)
        : (<>Agendar demo — recebo os horários no WhatsApp <ArrowRight size={18} /></>)}
    </button>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)
  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = 'Acabei de medir a visibilidade do meu produto na IA com a Auditoria GEO da e-Click.'
    try {
      if (navigator.share) { await navigator.share({ title: 'Auditoria GEO', text, url }); return }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { /* cancelado */ }
  }
  return (
    <button onClick={onShare} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '8px 14px', fontSize: 13.5, cursor: 'pointer' }}>
      <Share2 size={15} /> {copied ? 'Link copiado!' : 'Compartilhar'}
    </button>
  )
}

function FailedView() {
  return (
    <Shell>
      <div style={card({ textAlign: 'center', padding: 40 })}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Não conseguimos concluir a análise</h2>
        <p style={{ color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, margin: '12px auto 0', maxWidth: 440 }}>
          Pode ter sido um link temporariamente fora do ar. Tente de novo em instantes — é rápido.
        </p>
        <Link href="/auditoria-gratis" style={ctaLink}>Fazer nova auditoria <ArrowRight size={17} /></Link>
      </div>
    </Shell>
  )
}

function SkippedView({ reason }: { reason: string }) {
  return (
    <Shell>
      <div style={card({ textAlign: 'center', padding: 40 })}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Não conseguimos ler essa página automaticamente</h2>
        <p style={{ color: '#a1a1aa', fontSize: 15, lineHeight: 1.6, margin: '12px auto 0', maxWidth: 460 }}>
          Algumas páginas bloqueiam leitura automática ou exigem login. Tente o link público direto do
          seu anúncio ou da página de produto. {reason ? <span style={{ color: '#52525b' }}>({reason})</span> : null}
        </p>
        <Link href="/auditoria-gratis" style={ctaLink}>Tentar outro link <ArrowRight size={17} /></Link>
      </div>
    </Shell>
  )
}

// ── primitivos ──────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: '.au-spin{animation:au-spin .8s linear infinite}@keyframes au-spin{to{transform:rotate(360deg)}}' }} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(20px,4vw,40px) 20px 64px' }}>{children}</div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#09090b', color: '#a1a1aa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: '.au-spin{animation:au-spin .8s linear infinite}@keyframes au-spin{to{transform:rotate(360deg)}}' }} />
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717a', margin: '32px 0 14px' }}>{children}</h2>
}

function card(extra: React.CSSProperties): React.CSSProperties {
  return { background: '#121214', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 22, ...extra }
}

const ctaLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22,
  background: CYAN, color: '#04141a', borderRadius: 12, padding: '13px 24px',
  fontSize: 15, fontWeight: 800, textDecoration: 'none',
}
