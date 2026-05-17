import { redirect } from 'next/navigation'

// O antigo Monitor de Concorrentes foi decomissionado no R1 do e-Click Radar IA
// (o backend `competitors` dependia de /items/{id}, endpoint que o ML fechou).
// Esta rota redireciona pro novo módulo — evita 404 em bookmarks antigos.
export default function ConcorrentesRedirect() {
  redirect('/dashboard/radar')
}
