import { CheckSquare } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<CheckSquare size={64} />}
      title="Tarefas"
      description="Gestão de tarefas e projetos internos: cadastro de produtos, fotos, conteúdo e checklists de operação."
    />
  )
}
