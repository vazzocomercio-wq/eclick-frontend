import { MessageSquare } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<MessageSquare size={64} />}
      title="WhatsApp"
      description="Integração com WhatsApp Business para atendimento, notificações de pedido e campanhas de reativação."
    />
  )
}
