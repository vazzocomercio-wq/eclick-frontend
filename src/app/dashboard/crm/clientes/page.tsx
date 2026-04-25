import { Users } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Users size={64} />}
      title="Clientes"
      description="Visão completa da base de clientes: histórico de compras, LTV, segmentação e muito mais."
    />
  )
}
