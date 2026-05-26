import type { Metadata } from 'next'
import Link from 'next/link'
import { ForceDarkTheme } from './_components/ForceDarkTheme'
import { C, BLOG_CSS, SITE_URL } from './_components/tokens'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Blog · Inteligência Comercial em IA | e-Click',
    template: '%s | Blog e-Click',
  },
  description:
    'Análises, frameworks e experimentos sobre GEO (Otimização para Mecanismos Generativos). Baseados em pesquisa acadêmica e em dados reais de operação.',
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" style={{ background: C.BG, color: C.TXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />

      {/* Header minimal (mesma linha da landing /auditoria-gratis) */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1180, margin: '0 auto', padding: '20px 20px',
      }}>
        <Link href="/blog" style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', color: C.TXT }}>
            e<span style={{ color: C.CYAN }}>-</span>Click
          </span>
          <span style={{ fontSize: 11, color: C.DIM, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Blog
          </span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/auditoria-gratis" className="bl-link" style={{ fontSize: 14, fontWeight: 600, color: C.CYAN }}>
            Auditar meu anúncio →
          </Link>
        </nav>
      </header>

      {children}

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.BORDER}`, marginTop: 48 }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', padding: '28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: C.DIM }}>
            e-Click · Inteligência Comercial · Conteúdo sobre GEO baseado em ciência e operação real.
          </span>
          <span style={{ fontSize: 13, color: C.DIM }}>© {new Date().getFullYear()} e-Click</span>
        </div>
      </footer>
    </div>
  )
}
