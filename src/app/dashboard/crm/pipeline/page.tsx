import { Target } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Target size={64} />}
      title="Pipeline de Vendas"
      description="Gerencie oportunidades, acompanhe negociações e visualize seu funil de vendas em tempo real."
    />
  )
}
