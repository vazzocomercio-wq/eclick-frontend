import { UserCog } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<UserCog size={64} />}
      title="Equipe"
      description="Gerencie usuários, defina permissões por módulo e controle o acesso de cada membro da equipe."
    />
  )
}
