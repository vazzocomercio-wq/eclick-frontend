import { MessageSquare } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default async function Page() {
  const t = await getTranslations('crm.whatsapp')
  return (
    <ComingSoonPage
      icon={<MessageSquare size={64} />}
      title={t('title')}
      description={t('description')}
    />
  )
}
