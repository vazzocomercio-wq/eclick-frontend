import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default function Page() {
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Amazon',
      abbr:        'AZ',
      abbrBg:      'rgba(255,153,0,0.15)',
      abbrColor:   '#FF9900',
      description: 'Gerencie anúncios e pedidos via Amazon Seller Central SP-API.',
      features: [
        'Importação de listings do Seller Central para o catálogo eClick.',
        'Sincronização de estoque e preços em tempo real via SP-API.',
        'Relatórios de vendas, Buy Box e performance por ASIN.',
        'Gestão de FBA e FBM direto do painel.',
      ],
    }} />
  )
}
