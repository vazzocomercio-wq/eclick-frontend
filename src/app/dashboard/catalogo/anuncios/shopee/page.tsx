import { getTranslations } from 'next-intl/server'
import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default async function Page() {
  const t = await getTranslations('catalogo')
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Shopee',
      abbr:        'SH',
      abbrBg:      'rgba(238,77,45,0.15)',
      abbrColor:   '#EE4D2D',
      description: t('shopee.description'),
      features: [
        t('shopee.feature1'),
        t('shopee.feature2'),
        t('shopee.feature3'),
        t('shopee.feature4'),
      ],
    }} />
  )
}
