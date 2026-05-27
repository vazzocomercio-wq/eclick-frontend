import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ForceDarkTheme } from './_components/ForceDarkTheme'
import { C, BLOG_CSS, SITE_URL } from './_components/tokens'
import { BLOG_FONT_CLASSNAMES, fontCssVar } from './_fonts/registry'
import { getSiteSettings } from './lib/queries'

/**
 * Fonte de display do blog — catálogo em _fonts/registry.ts. A família PADRÃO
 * é escolhida no Estúdio do Active (siteSettings.blogDisplayFont) e aplicada
 * aqui via a var CSS --font-display (que os títulos consomem; ver BLOG_CSS).
 * Cada post pode sobrescrever a var no seu próprio layout.
 */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Blog · Inteligência Comercial em IA | e-Click',
    template: '%s | Blog e-Click',
  },
  description:
    'Análises, frameworks e experimentos sobre GEO (Otimização para Mecanismos Generativos). Baseados em pesquisa acadêmica e em dados reais de operação.',
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  let defaultFont: string | undefined
  try {
    const settings = await getSiteSettings()
    defaultFont = settings?.blogDisplayFont
  } catch {
    // sem siteSettings ainda → cai no default do catálogo (Clash Display)
  }
  const containerStyle: CSSProperties = {
    background: C.BG,
    color: C.TXT,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    ['--font-display' as string]: fontCssVar(defaultFont),
  }
  return (
    <div id="top" className={BLOG_FONT_CLASSNAMES} style={containerStyle}>
      <ForceDarkTheme />
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />

      {/* Header minimal (mesma linha da landing /auditoria-gratis) */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1180, margin: '0 auto', padding: '20px 20px',
      }}>
        <Link href="/blog" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} aria-label="e-Click Blog">
          <Image
            src="/blog-logo.png"
            alt="e-Click Blog"
            width={500}
            height={200}
            priority
            style={{ height: 64, width: 'auto' }}
          />
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
