'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Drawer slide-in lateral pra mostrar o OrderCard expandido quando
 * usuário clica numa linha da PedidosTable.
 *
 * Recebe `children` em vez de importar OrderCard — assim o componente
 * pesado fica em page.tsx (zero extração) e o drawer é só uma casca
 * presentational. O caller passa `<OrderCard order={selected} ... />`
 * como children quando `open === true`. */
export function OrderDetailDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open:     boolean
  onClose:  () => void
  /** Texto curto no header (ex: `Pedido #2000016171699136`). */
  title?:   string
  children: ReactNode
}) {
  // ESC fecha
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  // Bloqueia scroll do body enquanto drawer aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[150]">
      {/* Backdrop — click fora fecha. Fade-in via opacity. */}
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-150"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      />

      {/* Panel — slide-in da direita. 720px desktop, 90vw mobile. */}
      <aside
        onClick={e => e.stopPropagation()}
        className="absolute top-0 right-0 bottom-0 flex flex-col"
        style={{
          width: '720px',
          maxWidth: '90vw',
          background: '#0c0c10',
          borderLeft: '1px solid #1e1e24',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.5)',
          animation: 'eclick-drawer-slide 180ms ease-out',
        }}>
        <header className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid #1e1e24', background: '#111114' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Detalhes do pedido</p>
            {title && <p className="text-sm font-mono text-zinc-200 truncate">{title}</p>}
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Fechar (Esc)">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>

      <style>{`
        @keyframes eclick-drawer-slide {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
