/**
 * Landing pública "Auditoria GEO Grátis" (Sprint 1).
 *
 * Conteúdo server-rendered (bom pro GEO da própria página) com a ilha
 * interativa <CaptureForm/> (client). Sempre dark (<ForceDarkTheme/>).
 *
 * CTA da estratégia de conteúdo: "quer ver a nota GEO do seu anúncio?".
 * O resultado público (nota + 3 problemas + telas loading/resultado) é Sprint 2.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { CaptureForm } from './_components/CaptureForm'
import { ForceDarkTheme } from './_components/ForceDarkTheme'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'
const BG = '#09090b'
const CARD = '#121214'
const BORDER = 'rgba(255,255,255,0.08)'
const TXT = '#fafafa'
const MUT = '#a1a1aa'
const DIM = '#71717a'

export const metadata: Metadata = {
  title: 'Auditoria GEO Grátis — Descubra se a IA Enxerga seu Anúncio | e-Click',
  description:
    'Em 60 segundos, descubra como ChatGPT, Gemini e Perplexity enxergam seu anúncio ou loja. Auditoria gratuita baseada em pesquisa do KDD 2024 (Princeton) e E-GEO 2025 (Columbia + MIT).',
  alternates: { canonical: 'https://eclick.app.br/auditoria-gratis' },
  openGraph: {
    title: 'Seu produto está invisível pra IA? Descubra grátis em 60s',
    description:
      'Auditoria GEO gratuita: veja a nota de visibilidade do seu anúncio nos motores de IA e os 3 problemas mais críticos pra corrigir.',
    url: 'https://eclick.app.br/auditoria-gratis',
    siteName: 'e-Click',
    type: 'website',
    locale: 'pt_BR',
  },
  robots: { index: true, follow: true },
}

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'A auditoria é mesmo grátis?',
    a: 'Sim. Sem cartão, sem trial, sem pegadinha. Você cola a URL, recebe a nota e os 3 problemas mais críticos por email e WhatsApp.',
  },
  {
    q: 'Funciona com qualquer URL?',
    a: 'Funciona com URLs públicas: anúncios do Mercado Livre, Shopee, Amazon e páginas de produto de lojas próprias (Shopify, VTEX, Tray etc). Não funciona com páginas que exigem login.',
  },
  {
    q: 'Quanto tempo leva?',
    a: 'Entre 30 e 90 segundos. Nossa IA analisa a página em 8 dimensões, então depende do tamanho do conteúdo.',
  },
  {
    q: 'Vocês vão me ligar?',
    a: 'A gente manda o resultado por email e WhatsApp. Se você quiser conversar, é você quem pede. Sem call de vendas automática.',
  },
  {
    q: 'O que tem por trás dessa nota?',
    a: 'Um modelo proprietário baseado em 2 papers acadêmicos (KDD 2024 e E-GEO 2025) que avalia 8 dimensões: clareza, dados, estrutura, autoridade, intenção, factualidade, acessibilidade a bots e citações.',
  },
  {
    q: 'Posso confiar nos dados que envio?',
    a: 'Sim. Só usamos a URL pra rodar a análise. Email, nome e WhatsApp ficam no nosso CRM (LGPD) e você pode pedir exclusão a qualquer momento.',
  },
  {
    q: 'E depois? Vocês vendem algo?',
    a: 'A e-Click tem um SaaS de Inteligência Comercial que inclui o módulo completo de GEO (reescrita automática do anúncio, simulador de ranking, monitoramento contínuo). Se quiser conhecer, você pede. A auditoria pública é educativa — sem obrigação.',
  },
]

export default function AuditoriaGratisPage() {
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'e-Click — Auditoria GEO',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Auditoria gratuita de visibilidade (GEO) de anúncios e lojas nos motores de IA generativa (ChatGPT, Gemini, Perplexity).',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
    provider: { '@type': 'Organization', name: 'e-Click', url: 'https://eclick.app.br' },
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <div className="geo-page" style={{ background: BG, color: TXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />

      {/* ── Header minimal ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1180, margin: '0 auto', padding: '20px 20px',
      }}>
        <Image
          src="/ai-visibility-logo.png"
          alt="e-Click — IA Visibility OS"
          width={150}
          height={60}
          priority
          style={{ height: 44, width: 'auto', display: 'block' }}
        />
        <Link href="/login" style={{ fontSize: 14, color: MUT, textDecoration: 'none' }} className="au-link">
          Entrar
        </Link>
      </header>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 56px' }}>
        <div className="au-hero">
          <div className="au-reveal">
            <span style={{
              display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em',
              color: CYAN, background: 'rgba(0,229,255,0.08)', border: `1px solid ${CYAN}44`,
              borderRadius: 999, padding: '6px 14px', marginBottom: 24,
            }}>
              GRÁTIS · 60 SEGUNDOS
            </span>
            <h1 style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 900, lineHeight: 1.04,
              letterSpacing: '-0.03em', margin: 0,
            }}>
              Seu produto está <span style={{ color: CYAN }}>invisível</span> pra ChatGPT, Gemini e Perplexity?
            </h1>
            <p style={{ fontSize: 'clamp(1rem, 1.6vw, 1.18rem)', color: MUT, lineHeight: 1.6, margin: '22px 0 0', maxWidth: 540 }}>
              Descubra agora, em 60 segundos, como a IA enxerga seu anúncio do Mercado Livre ou
              sua loja online. Auditoria gratuita baseada em pesquisa do KDD 2024 (Princeton),
              E-GEO 2025 (Columbia + MIT).
            </p>
            <div style={{ display: 'flex', gap: 24, marginTop: 30, flexWrap: 'wrap' }}>
              {[
                ['8', 'dimensões analisadas'],
                ['0-100', 'nota de visibilidade'],
                ['3', 'problemas críticos'],
              ].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: TXT, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{n}</div>
                  <div style={{ fontSize: 12.5, color: DIM }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="au-reveal" style={{ animationDelay: '0.12s' }}>
            <CaptureForm />
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <Section title="Como funciona" subtitle="Três passos. Sem cadastro, sem custo.">
        <div className="au-grid-3">
          {[
            ['1', 'Você cola a URL', 'Anúncio do Mercado Livre, Shopee, Amazon ou sua loja própria. Funciona com qualquer link público.'],
            ['2', 'Nossa IA analisa em 8 dimensões', 'Título, descrição, dados estruturados, FAQ, atributos, avaliações, acesso de bots e profundidade do conteúdo.'],
            ['3', 'Você vê a nota e o que arrumar', 'Pontuação de 0 a 100 + os 3 erros mais críticos pra corrigir. Enviamos por email e WhatsApp.'],
          ].map(([n, t, d]) => (
            <div key={n} className="au-card" style={cardStyle}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 900, fontSize: 18, color: CYAN,
                background: 'rgba(0,229,255,0.08)', border: `1px solid ${CYAN}33`, marginBottom: 16,
              }}>{n}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{t}</h3>
              <p style={{ fontSize: 14.5, color: MUT, lineHeight: 1.6, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Prova (educacional, honesto — sem estatística não-verificada) ──
          TODO(Silvio): quando a varredura do catálogo / ImpactTracker fechar
          (após 11/06), inserir aqui os números REAIS do piloto Vazzo
          (ex.: nota média medida). NÃO inventar estatística. */}
      <Section>
        <div style={{
          background: 'linear-gradient(160deg, rgba(0,229,255,0.05), rgba(18,18,20,0.4))',
          border: `1px solid ${BORDER}`, borderRadius: 20, padding: 'clamp(28px, 4vw, 48px)',
        }}>
          <div className="au-grid-2" style={{ alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'clamp(1.7rem, 3.4vw, 2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                A maioria dos anúncios brasileiros é <span style={{ color: CYAN }}>invisível</span> pra IA.
              </h2>
              <p style={{ fontSize: 16, color: MUT, lineHeight: 1.65, margin: '18px 0 0' }}>
                Eles foram escritos para o algoritmo de busca do marketplace — não para o ChatGPT.
                Quando o comprador pergunta à IA <em>“qual o melhor X pra Y?”</em>, quem não tem
                dados concretos, contexto de uso e estrutura simplesmente não é citado.
              </p>
              <p style={{ fontSize: 16, color: MUT, lineHeight: 1.65, margin: '14px 0 0' }}>
                A boa notícia: dá pra medir — e dá pra corrigir.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', color: DIM, textTransform: 'uppercase', marginBottom: 14 }}>
                A escala da Nota GEO
              </div>
              {[
                ['0 – 40', 'Invisível pra IA', '#EF4444'],
                ['41 – 70', 'Aparece, mas não no topo', '#F59E0B'],
                ['71 – 100', 'Entre os mais bem posicionados', GREEN],
              ].map(([range, label, color]) => (
                <div key={range} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 15, color,
                    minWidth: 78,
                  }}>{range}</span>
                  <span style={{ height: 8, flex: 1, borderRadius: 999, background: color, opacity: 0.85 }} />
                  <span style={{ fontSize: 13.5, color: MUT, minWidth: 0 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Ciência ── */}
      <Section title="Baseado em ciência, não em achismo" subtitle="Dois papers acadêmicos sustentam o modelo de pontuação.">
        <div className="au-grid-2">
          {[
            {
              tag: 'KDD 2024 · Princeton',
              title: 'GEO: Generative Engine Optimization',
              quote: '“Citar fontes, adicionar estatísticas e melhorar a fluência aumentam a visibilidade em IA em até +40%.”',
            },
            {
              tag: 'E-GEO 2025 · Columbia + MIT',
              title: 'A Testbed for GEO in E-Commerce',
              quote: '“Existe uma ‘receita universal’ que faz a IA recomendar seu produto: intenção, diferenciais, avaliações e factualidade.”',
            },
          ].map((p) => (
            <div key={p.title} className="au-card" style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: CYAN, marginBottom: 10 }}>{p.tag}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 14px', letterSpacing: '-0.01em' }}>{p.title}</h3>
              <p style={{ fontSize: 15, color: MUT, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{p.quote}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section title="Perguntas frequentes">
        <div style={{ maxWidth: 760 }}>
          {FAQS.map((f) => (
            <details key={f.q} className="au-faq au-card" style={{ ...cardStyle, marginBottom: 12, padding: '0' }}>
              <summary style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '18px 20px', fontSize: 15.5, fontWeight: 600, color: TXT,
              }}>
                {f.q}
                <span style={{ color: CYAN, fontSize: 20, fontWeight: 400 }} className="au-faq-plus">+</span>
              </summary>
              <p style={{ padding: '0 20px 20px', margin: 0, fontSize: 14.5, color: MUT, lineHeight: 1.65 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, marginTop: 24 }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: DIM }}>
            e-Click · Inteligência Comercial · Transformamos vendas em processos, processos em resultados.
          </span>
          <span style={{ fontSize: 13, color: DIM }}>© {new Date().getFullYear()} e-Click</span>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 20px' }}>
      {title && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 15.5, color: MUT, margin: '8px 0 0' }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: '22px',
}

const CSS = `
.au-spin { animation: au-spin 0.8s linear infinite; }
@keyframes au-spin { to { transform: rotate(360deg); } }
.au-two-col { display: grid; grid-template-columns: 1fr; gap: 0 14px; }
@media (min-width: 560px) { .au-two-col { grid-template-columns: 1fr 1fr; } }
.au-hero { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
@media (min-width: 960px) { .au-hero { grid-template-columns: 1.05fr 0.95fr; gap: 56px; } }
.au-grid-3 { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 800px) { .au-grid-3 { grid-template-columns: repeat(3, 1fr); } }
.au-grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 760px) { .au-grid-2 { grid-template-columns: 1fr 1fr; } }
.au-reveal { opacity: 0; transform: translateY(14px); animation: au-reveal 0.6s ease-out forwards; }
@keyframes au-reveal { to { opacity: 1; transform: none; } }
.au-card { transition: transform .2s ease, border-color .2s ease; }
.au-card:hover { transform: translateY(-2px); border-color: rgba(0,229,255,0.4) !important; }
.au-faq summary { cursor: pointer; list-style: none; }
.au-faq summary::-webkit-details-marker { display: none; }
.au-faq[open] .au-faq-plus { transform: rotate(45deg); }
.au-faq-plus { transition: transform .2s ease; display: inline-block; }
.au-link:hover { color: #00E5FF; }
@media (prefers-reduced-motion: reduce) {
  .au-reveal { animation: none; opacity: 1; transform: none; }
  .au-spin { animation: none; }
  .au-card:hover { transform: none; }
}
`
