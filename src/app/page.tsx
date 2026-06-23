/**
 * Homepage pública institucional da e-Click (eclick.app.br/).
 *
 * Visitante anônimo vê esta landing; usuário logado é redirecionado pro
 * /dashboard pelo middleware (pathname === '/'). Server-rendered (bom pro
 * GEO/SEO da própria página) + sempre dark (<ForceDarkTheme/>).
 *
 * Também serve como "URL do site" oficial em revisões de apps de terceiros
 * (TikTok/Meta), que exigem uma página pública — não um login.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ShoppingBag, LineChart, Megaphone, Boxes, Bot } from 'lucide-react'
import { ForceDarkTheme } from './auditoria-gratis/_components/ForceDarkTheme'

const CYAN = '#00E5FF'
const GREEN = '#4ADE80'
const BG = '#09090b'
const CARD = '#121214'
const BORDER = 'rgba(255,255,255,0.08)'
const TXT = '#fafafa'
const MUT = '#a1a1aa'
const DIM = '#71717a'

export const metadata: Metadata = {
  title: 'e-Click — Inteligência Comercial movida a IA para marketplaces',
  description:
    'Plataforma de inteligência comercial para quem vende em marketplaces: pedidos, estoque e NF-e multicanal (Mercado Livre, Shopee, TikTok Shop, loja própria), criação e publicação de conteúdo com IA, gestão de anúncios e resultado financeiro vivo — em um só lugar.',
  alternates: { canonical: 'https://eclick.app.br' },
  openGraph: {
    title: 'e-Click — Inteligência Comercial movida a IA',
    description:
      'Transformamos vendas em processos, processos em resultados. Pedidos, estoque, NF-e, conteúdo com IA e anúncios — multicanal, num só lugar.',
    url: 'https://eclick.app.br',
    siteName: 'e-Click',
    type: 'website',
    locale: 'pt_BR',
  },
  robots: { index: true, follow: true },
}

const PILARES: Array<{ icon: typeof ShoppingBag; titulo: string; texto: string }> = [
  {
    icon: ShoppingBag,
    titulo: 'Venda em todos os canais',
    texto:
      'Pedidos, estoque e NF-e de Mercado Livre, Shopee, TikTok Shop e loja própria centralizados. Um catálogo mestre que sincroniza preço e estoque pra cada canal.',
  },
  {
    icon: Sparkles,
    titulo: 'Conteúdo e anúncios com IA',
    texto:
      'Crie reels, posts e anúncios dos seus produtos com IA e publique direto no TikTok e nas plataformas. Otimização contínua de campanhas que aprende com o resultado.',
  },
  {
    icon: LineChart,
    titulo: 'Resultado no controle',
    texto:
      'DRE viva por canal e por produto, margem real (comissão, frete e taxas de cada plataforma) e radar do que vale a pena comprar. Decisão baseada em dado, não em achismo.',
  },
]

const RECURSOS: Array<{ icon: typeof Bot; titulo: string; texto: string }> = [
  { icon: Bot, titulo: 'Atendimento e CRM com IA', texto: 'Funil, inbox e copiloto que respondem e organizam o relacionamento com o cliente.' },
  { icon: Boxes, titulo: 'Estoque e expedição', texto: 'Ledger de estoque íntegro, dropship e fulfillment com baixa automática a cada venda.' },
  { icon: Megaphone, titulo: 'Mídia que se otimiza', texto: 'Motor de anúncios multi-plataforma que sugere e aplica ajustes com aprovação humana.' },
]

const PLATAFORMAS = ['Mercado Livre', 'Shopee', 'TikTok Shop', 'Loja própria']

export default function HomePage() {
  return (
    <div style={{ background: BG, color: TXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ForceDarkTheme />

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 20, background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" aria-label="e-Click" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="e-Click — Inteligência Comercial" style={{ height: 30, width: 'auto', mixBlendMode: 'screen' }} />
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 14 }}>
            <Link href="/blog" style={{ color: MUT, textDecoration: 'none' }}>Blog</Link>
            <Link href="/auditoria-gratis" style={{ color: MUT, textDecoration: 'none' }}>Auditoria GEO</Link>
            <Link
              href="/login"
              style={{ color: BG, background: CYAN, fontWeight: 700, padding: '8px 16px', borderRadius: 9, textDecoration: 'none' }}
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(620px 320px at 50% -10%, ${CYAN}1f, transparent 70%)`,
          }}
        />
        <div style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', padding: '84px 20px 64px', textAlign: 'center' }}>
          <p style={{ color: CYAN, fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 18px' }}>
            Inteligência Comercial movida a IA
          </p>
          <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '0 auto', maxWidth: 920 }}>
            Transformamos vendas em processos,<br />
            <span style={{ color: CYAN }}>processos em resultados.</span>
          </h1>
          <p style={{ color: MUT, fontSize: 'clamp(1rem, 2.2vw, 1.2rem)', lineHeight: 1.6, margin: '22px auto 0', maxWidth: 680 }}>
            A e-Click reúne pedidos, estoque, NF-e, conteúdo com IA, anúncios e resultado financeiro de
            todos os seus canais de venda — Mercado Livre, Shopee, TikTok Shop e loja própria — em uma só plataforma.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', margin: '34px 0 0' }}>
            <Link href="/solicitar-acesso" style={{ background: CYAN, color: BG, fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 11, textDecoration: 'none' }}>
              Solicitar acesso
            </Link>
            <Link href="/login" style={{ border: `1px solid ${BORDER}`, color: TXT, fontWeight: 600, fontSize: 15, padding: '13px 26px', borderRadius: 11, textDecoration: 'none' }}>
              Entrar na plataforma
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', margin: '40px 0 0' }}>
            {PLATAFORMAS.map((p) => (
              <span key={p} style={{ color: DIM, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 20px 8px' }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {PILARES.map(({ icon: Icon, titulo, texto }) => (
            <article key={titulo} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '26px 24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${CYAN}14`, border: `1px solid ${CYAN}33`, marginBottom: 16 }}>
                <Icon size={22} color={CYAN} strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 8px' }}>{titulo}</h2>
              <p style={{ color: MUT, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Faixa de destaque — conteúdo/IA (relevante p/ publicação no TikTok) */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: `linear-gradient(180deg, ${CARD}, #0d0d10)`, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 'clamp(28px, 5vw, 48px)', display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', alignItems: 'center' }}>
          <div>
            <p style={{ color: GREEN, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Conteúdo + IA
            </p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px' }}>
              Crie reels e posts dos seus produtos com IA e publique no TikTok
            </h2>
            <p style={{ color: MUT, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
              A partir do seu catálogo, a e-Click gera roteiro, arte e legenda com IA e publica direto nas suas
              contas — economizando horas de produção e mantendo a presença ativa nos canais que mais vendem.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
                <Icon size={18} color={CYAN} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 2px' }}>{titulo}</p>
                  <p style={{ color: DIM, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '8px 20px 72px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 10px' }}>
          Pronto pra colocar sua operação no piloto inteligente?
        </h2>
        <p style={{ color: MUT, fontSize: 16, margin: '0 auto 26px', maxWidth: 560 }}>
          Comece pela auditoria gratuita de visibilidade ou solicite acesso à plataforma.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auditoria-gratis" style={{ background: CYAN, color: BG, fontWeight: 700, fontSize: 15, padding: '13px 26px', borderRadius: 11, textDecoration: 'none' }}>
            Auditoria GEO grátis
          </Link>
          <Link href="/solicitar-acesso" style={{ border: `1px solid ${BORDER}`, color: TXT, fontWeight: 600, fontSize: 15, padding: '13px 26px', borderRadius: 11, textDecoration: 'none' }}>
            Solicitar acesso
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: DIM, fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
            © {2026} e-Click · Vazzo Comércio LTDA · CNPJ 29.049.890/0001-08
          </p>
          <nav style={{ display: 'flex', gap: 18, fontSize: 13 }}>
            <Link href="/privacidade" style={{ color: MUT, textDecoration: 'none' }}>Política de Privacidade</Link>
            <Link href="/termos" style={{ color: MUT, textDecoration: 'none' }}>Termos de Serviço</Link>
            <Link href="/blog" style={{ color: MUT, textDecoration: 'none' }}>Blog</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
