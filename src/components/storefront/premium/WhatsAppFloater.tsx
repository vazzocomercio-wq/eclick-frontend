'use client'

/**
 * Botao flutuante do WhatsApp na home da Loja Propria.
 *
 * Comportamento:
 *   - Loja SEM catalogo Meta vinculado → botao unico, link direto wa.me
 *     (mesmo comportamento do <WhatsAppButton> server component).
 *   - Loja COM catalogo Meta vinculado → menu compacto ao clicar com
 *     dois itens: "Conversar com a loja" + "Ver catalogo no WhatsApp".
 *
 *  Hospedado dentro do StorefrontHome (client component porque precisa
 *  controlar abertura do menu). Server components que so querem o link
 *  unico continuam usando <WhatsAppButton>.
 */

import { useState, useEffect } from 'react'
import { MessageCircle, ShoppingBag, X } from 'lucide-react'
import type { StorefrontStore } from '@/lib/storefront/data'
import { whatsappLink } from '@/lib/storefront/data'

export function WhatsAppFloater({ store, message }: {
  store:    StorefrontStore
  message?: string
}) {
  const [open, setOpen] = useState(false)
  if (!store.whatsapp_widget_enabled || !store.whatsapp_number) return null

  const chatHref    = whatsappLink(store.whatsapp_number, message)
  const catalogHref = store.whatsapp_catalog?.enabled ? store.whatsapp_catalog.link : null

  // ESC fecha o menu
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Sem catalogo → botao unico (comportamento legado)
  if (!catalogHref) {
    return (
      <a href={chatHref} target="_blank" rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-5 z-50 rounded-full p-3.5 sm:p-4 shadow-2xl transition-transform hover:scale-105"
        style={{ background: '#25D366', color: '#fff' }}>
        <WaIcon />
      </a>
    )
  }

  // Com catalogo → toggler + menu
  return (
    <>
      <button type="button" onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Fechar menu do WhatsApp' : 'Abrir menu do WhatsApp'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 rounded-full p-3.5 sm:p-4 shadow-2xl transition-transform hover:scale-105"
        style={{ background: '#25D366', color: '#fff' }}>
        {open ? <X size={24} /> : <WaIcon />}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent" />
          <div role="menu"
            className="fixed bottom-24 right-5 z-50 w-[240px] rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#ffffff' }}>
            <MenuItem
              href={chatHref}
              icon={<MessageCircle size={18} style={{ color: '#128C7E' }} />}
              title="Conversar com a loja"
              subtitle="Abre o WhatsApp"
            />
            <div style={{ borderTop: '1px solid #ececec' }} />
            <MenuItem
              href={catalogHref}
              icon={<ShoppingBag size={18} style={{ color: '#128C7E' }} />}
              title="Ver catálogo no WhatsApp"
              subtitle="Lista de produtos da loja"
            />
          </div>
        </>
      )}
    </>
  )
}

function MenuItem({ href, icon, title, subtitle }: {
  href:     string
  icon:     React.ReactNode
  title:    string
  subtitle: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-100"
      style={{ color: '#1c1b19' }}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px]" style={{ color: '#7a756c' }}>{subtitle}</p>
      </div>
    </a>
  )
}

function WaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
