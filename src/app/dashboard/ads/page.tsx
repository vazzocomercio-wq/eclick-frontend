import { redirect } from 'next/navigation'
// Ads landing page → vai pra Mercado Livre (página principal do módulo).
// /ads/performance virou tela secundária (vendas/tráfego), acessível pelo Sidebar.
export default function Page() {
  redirect('/dashboard/ads/mercadolivre')
}
