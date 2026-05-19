import { getTranslations } from 'next-intl/server'
import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default async function Page() {
  const t = await getTranslations('catalogo')
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Magalu',
      abbr:        'MG',
      abbrBg:      'rgba(0,134,255,0.15)',
      abbrColor:   '#0086FF',
      description: t('magalu.description'),
      features: [
        t('magalu.feature1'),
        t('magalu.feature2'),
        t('magalu.feature3'),
        t('magalu.feature4'),
      ],
    }} />
  )
}
