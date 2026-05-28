/**
 * F17-A · Signup público está fechado.
 * Redireciona pra /solicitar-acesso (form de pedido de acesso).
 *
 * Mantemos /register no roteador pra preservar links antigos
 * (campanhas, e-mails, prints) — sem quebrar UX, só redireciona.
 */
import { redirect } from 'next/navigation'

export default function RegisterPage() {
  redirect('/solicitar-acesso')
}
