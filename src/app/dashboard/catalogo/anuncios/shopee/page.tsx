import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default function Page() {
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Shopee',
      abbr:        'SH',
      abbrBg:      'rgba(238,77,45,0.15)',
      abbrColor:   '#EE4D2D',
      description: 'Sincronize anúncios, pedidos e estoque com a Shopee.',
      features: [
        'Importação e criação de anúncios via Shopee Open Platform API.',
        'Sincronização automática de estoque entre Shopee e catálogo interno.',
        'Gestão de pedidos, logística e vouchers do vendedor.',
        'Relatórios de performance e avaliações de compradores.',
      ],
    }} />
  )
}
