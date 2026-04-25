import { Sparkles } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Sparkles size={64} />}
      title="Conteúdo com IA"
      description="Geração automática de títulos, descrições e bullet points otimizados para cada marketplace com IA."
    />
  )
}
