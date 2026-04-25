import { ShoppingCart } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<ShoppingCart size={64} />}
      title="Shopee Ads"
      description="Crie e gerencie campanhas patrocinadas na Shopee para ampliar o alcance dos seus anúncios."
    />
  )
}
