import { Plug } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Plug size={64} />}
      title="Integrações"
      description="Conecte novos canais, ERPs, sistemas de pagamento e ferramentas externas ao e-Click Suite."
    />
  )
}
