import { Megaphone } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Megaphone size={64} />}
      title="ML Ads"
      description="Gerencie e otimize campanhas de Product Ads no Mercado Livre diretamente da plataforma."
    />
  )
}
