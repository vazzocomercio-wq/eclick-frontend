/**
 * Layout das rotas da vitrine pública (/loja/[slug]/*).
 *
 * Único papel: definir o FAVICON por loja (ícone da aba) a partir de
 * `favicon_url` (ou, na falta, do `logo_url`). Escopo só nas rotas da loja —
 * NÃO afeta o favicon da plataforma e-Click (app/favicon.ico), que segue
 * valendo no dashboard e nas demais páginas.
 *
 * O `<link rel="icon">` explícito daqui sobrepõe o favicon.ico padrão nas
 * páginas da vitrine.
 */

import type { Metadata } from 'next'
import { getStore } from '@/lib/storefront/v3/data'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  const icon = store?.favicon_url || store?.logo_url
  if (!icon) return {}
  // Declara o ícone da loja nos tamanhos exatos da aba (16/32) + 'any'. Assim
  // o navegador prefere este em vez do /favicon.ico da e-Click (40x40), que
  // ganharia por proximidade de tamanho se o nosso não tivesse size.
  return {
    icons: {
      icon: [
        { url: icon, type: 'image/png', sizes: '32x32' },
        { url: icon, type: 'image/png', sizes: '16x16' },
        { url: icon, type: 'image/png', sizes: 'any' },
      ],
      shortcut: [{ url: icon }],
      apple:    [{ url: icon }],
    },
  }
}

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return children
}
