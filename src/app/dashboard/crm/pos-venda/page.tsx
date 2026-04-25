import { Heart } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Heart size={64} />}
      title="Pós-venda"
      description="Acompanhe satisfação, retenção e fidelização dos clientes após cada compra."
    />
  )
}
