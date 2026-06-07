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
  return {
    icons: { icon, shortcut: icon, apple: icon },
  }
}

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return children
}
