'use client'

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import { AlertCircle, AlertTriangle, X, CheckCircle2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DialogVariant = 'default' | 'danger' | 'warning' | 'info'

export interface ConfirmOptions {
  title?:        string
  message:       string | ReactNode
  confirmLabel?: string   // default: "Confirmar"
  cancelLabel?:  string   // default: "Cancelar"
  variant?:      DialogVariant   // default: 'default'
}

export interface AlertOptions {
  title?:        string
  message:       string | ReactNode
  okLabel?:      string   // default: "Ok"
  variant?:      DialogVariant   // default: 'info'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
type AlertFn   = (opts: AlertOptions | string) => Promise<void>

interface DialogContextValue {
  confirm: ConfirmFn
  alert:   AlertFn
}

const DialogContext = createContext<DialogContextValue | null>(null)

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useConfirm(): ConfirmFn {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useConfirm must be used within DialogProvider')
  return ctx.confirm
}

export function useAlert(): AlertFn {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useAlert must be used within DialogProvider')
  return ctx.alert
}

// ── Variant styling ──────────────────────────────────────────────────────────

const VARIANT_META: Record<DialogVariant, { icon: typeof AlertCircle; color: string }> = {
  default: { icon: AlertCircle,   color: '#00E5FF' },
  danger:  { icon: AlertCircle,   color: '#f87171' },
  warning: { icon: AlertTriangle, color: '#f59e0b' },
  info:    { icon: CheckCircle2,  color: '#60a5fa' },
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface ConfirmState {
  kind: 'confirm'
  options: ConfirmOptions
  resolve: (v: boolean) => void
}
interface AlertState {
  kind: 'alert'
  options: AlertOptions
  resolve: () => void
}
type DialogState = ConfirmState | AlertState | null

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: 'confirm', options: opts, resolve })
    })
  }, [])

  const alert = useCallback<AlertFn>((optsOrMsg) => {
    const opts: AlertOptions = typeof optsOrMsg === 'string'
      ? { message: optsOrMsg }
      : optsOrMsg
    return new Promise<void>((resolve) => {
      setState({ kind: 'alert', options: opts, resolve })
    })
  }, [])

  function close() {
    if (!state) return
    if (state.kind === 'confirm') state.resolve(false)
    else                          state.resolve()
    setState(null)
  }

  function handleConfirm() {
    if (!state) return
    if (state.kind === 'confirm') state.resolve(true)
    else                          state.resolve()
    setState(null)
  }

  function handleCancel() {
    close()
  }

  // ESC fecha o modal (cancela)
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Enter')  handleConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <DialogModal state={state} onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </DialogContext.Provider>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function DialogModal({
  state, onConfirm, onCancel,
}: {
  state: NonNullable<DialogState>
  onConfirm: () => void
  onCancel:  () => void
}) {
  const variant = state.options.variant ?? (state.kind === 'confirm' ? 'default' : 'info')
  const meta = VARIANT_META[variant]
  const Icon = meta.icon

  const isConfirm = state.kind === 'confirm'
  const opts = state.options
  const confirmLabel = isConfirm ? (opts as ConfirmOptions).confirmLabel ?? 'Confirmar' : (opts as AlertOptions).okLabel ?? 'Ok'
  const cancelLabel  = isConfirm ? (opts as ConfirmOptions).cancelLabel  ?? 'Cancelar' : null

  // Cor do botão de confirmação ajustada por variant
  const confirmBg = variant === 'danger'
    ? 'rgba(248,113,113,0.12)'
    : variant === 'warning'
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(0,229,255,0.12)'
  const confirmFg = variant === 'danger' ? '#f87171'
    : variant === 'warning' ? '#f59e0b'
    : '#00E5FF'
  const confirmBorder = `1px solid ${confirmFg}55`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: '#111114', border: '1px solid #27272a', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}>
            <Icon size={18} style={{ color: meta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            {opts.title && (
              <h3 className="text-white font-semibold text-sm">{opts.title}</h3>
            )}
            <div className="text-sm text-zinc-300 mt-0.5 leading-relaxed break-words">
              {opts.message}
            </div>
          </div>
          <button onClick={onCancel}
            className="p-1 rounded-lg transition-colors shrink-0"
            style={{ color: '#71717a' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e4e4e7')}
            onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
            aria-label="Fechar">
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {cancelLabel && (
            <button onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              {cancelLabel}
            </button>
          )}
          <button onClick={onConfirm}
            autoFocus
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: confirmBg, color: confirmFg, border: confirmBorder }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
