import { TrendingUp } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<TrendingUp size={64} />}
      title="Performance de Ads"
      description="Dashboard unificado de performance para todas as suas campanhas de anúncios pagos nos marketplaces."
    />
  )
}
