import { redirect } from 'next/navigation'

// /configuracoes/canais foi unificado em /configuracoes/integracoes#marketplaces.
// Mantido como redirect server-side pra preservar bookmarks e links antigos.
export default function CanaisRedirect(): never {
  redirect('/dashboard/configuracoes/integracoes#marketplaces')
}
