import { ShoppingCart } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default async function Page() {
  const t = await getTranslations('ads')
  return (
    <ComingSoonPage
      icon={<ShoppingCart size={64} />}
      title={t('shopee.title')}
      description={t('shopee.description')}
    />
  )
}
