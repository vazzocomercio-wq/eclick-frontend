import { Image } from 'lucide-react'
import ComingSoonPage from '@/components/ui/ComingSoonPage'

export default function Page() {
  return (
    <ComingSoonPage
      icon={<Image size={64} />}
      title="Biblioteca de Mídias"
      description="Centralize fotos, vídeos e arquivos dos seus produtos. Organize por categoria e reutilize em todos os canais."
    />
  )
}
