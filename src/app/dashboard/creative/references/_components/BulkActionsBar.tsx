'use client'

/**
 * Floating bar fixed bottom-center. Aparece quando selectedCount > 0.
 * Apagar: confirm modal listando os nomes selecionados.
 * Curated não pode ser desativada/deletada — filtra antes de chamar handlers.
 */

import { Power, PowerOff, Trash2, X, Loader2 } from 'lucide-react'

export default function BulkActionsBar({
  count, curatedInSelection, busy,
  onActivate, onDeactivate, onDelete, onClear,
}: {
  count: number
  curatedInSelection: number
  busy: boolean
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null

  const editableCount = count - curatedInSelection

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-30 max-w-[95vw]">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl">
        <span className="text-sm font-medium text-zinc-100 whitespace-nowrap">
          {count} selecionada{count > 1 ? 's' : ''}
          {curatedInSelection > 0 && (
            <span className="ml-1.5 text-[10px] text-amber-300/80 font-normal">
              ({curatedInSelection} curada{curatedInSelection > 1 ? 's' : ''} ignorada{curatedInSelection > 1 ? 's' : ''})
            </span>
          )}
        </span>

        <div className="h-5 w-px bg-zinc-800" />

        <button
          type="button"
          onClick={onActivate}
          disabled={busy || editableCount === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
          Ativar
        </button>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={busy || editableCount === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <PowerOff size={12} />}
          Desativar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy || editableCount === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Apagar
        </button>

        <div className="h-5 w-px bg-zinc-800" />

        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X size={12} /> Limpar
        </button>
      </div>
    </div>
  )
}
