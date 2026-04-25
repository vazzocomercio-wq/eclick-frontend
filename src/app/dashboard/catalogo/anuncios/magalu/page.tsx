import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default function Page() {
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Magalu',
      abbr:        'MG',
      abbrBg:      'rgba(0,134,255,0.15)',
      abbrColor:   '#0086FF',
      description: 'Publique e gerencie anúncios no Magazine Luiza Marketplace.',
      features: [
        'Cadastro e atualização de produtos via API do Magalu Marketplace.',
        'Sincronização de estoque e preços com o catálogo interno.',
        'Gestão de pedidos e rastreamento de envios.',
        'Relatórios de vendas e performance por SKU.',
      ],
    }} />
  )
}
