import { getTranslations } from 'next-intl/server'
import ChannelListingsPlaceholder from '@/components/ui/ChannelListingsPlaceholder'

export default async function Page() {
  const t = await getTranslations('catalogo')
  return (
    <ChannelListingsPlaceholder channel={{
      name:        'Amazon',
      abbr:        'AZ',
      abbrBg:      'rgba(255,153,0,0.15)',
      abbrColor:   '#FF9900',
      description: t('amazon.description'),
      features: [
        t('amazon.feature1'),
        t('amazon.feature2'),
        t('amazon.feature3'),
        t('amazon.feature4'),
      ],
    }} />
  )
}
