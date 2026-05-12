'use client'

/**
 * F6 Sprint 2 patch — Custom dropdown que substitui o <select> nativo
 * pros campos editáveis por org (ambient + product_type).
 *
 * Features:
 *   - Carrega opções do backend (defaults globais + org's customs)
 *   - Custom options aparecem com botão (···) → Editar / Apagar
 *   - Defaults têm badge sutil "padrão" e não são editáveis
 *   - Footer: "+ Adicionar nova…" abre mini-form inline com value+label
 *   - Refresh automático após criar/editar/apagar
 *   - Keyboard: Esc fecha
 *
 * Props:
 *   kind:     'ambient' | 'product_type'
 *   value:    valor atual (string ou '' pra "sem ambiente/tipo")
 *   onChange: callback ao selecionar
 *   placeholder: "Ambiente: todos", "Tipo: todos"
 *   allowEmpty: mostra opção "—" pra desselecionar (default true)
 *   disabled: bloqueia tudo
 *   className: container outer
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, X, Edit3, Trash2, Loader2, Check } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { TaxonomyKind, TaxonomyOption } from '@/components/creative/types'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'

export default function TaxonomySelect({
  kind, value, onChange,
  placeholder, allowEmpty = true, disabled, className,
}: {
  kind:         TaxonomyKind
  value:        string
  onChange:     (next: string) => void
  placeholder:  string
  allowEmpty?:  boolean
  disabled?:    boolean
  className?:   string
}) {
  const [options, setOptions] = useState<TaxonomyOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing]   = useState<TaxonomyOption | null>(null)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const confirmDialog = useConfirm()
  const alertDialog   = useAlert()

  // Carrega na montagem
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await CreativeApi.listTaxonomy(kind)
      setOptions(list)
    } catch (e) {
      await alertDialog({
        title:   'Falha ao carregar opções',
        message: (e as Error).message,
        variant: 'danger',
      })
    } finally {
      setLoading(false)
    }
  }, [kind, alertDialog])

  useEffect(() => { void load() }, [load])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setEditing(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setEditing(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const currentLabel = (() => {
    if (!value) return placeholder
    const found = options.find(o => o.value === value)
    return found?.label ?? value
  })()

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  // ── Create ────────────────────────────────────────────────────────────

  const handleCreated = async (created: TaxonomyOption) => {
    await load()
    setCreating(false)
    // Seleciona automaticamente a nova
    onChange(created.value)
    setOpen(false)
  }

  // ── Edit ──────────────────────────────────────────────────────────────

  const handleEdited = async (edited: TaxonomyOption) => {
    await load()
    setEditing(null)
    // Se o value mudou e era o selecionado, mantém a seleção
    if (value && value === edited.value) {
      onChange(edited.value)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────

  const handleDelete = async (opt: TaxonomyOption) => {
    const ok = await confirmDialog({
      title:        'Apagar opção',
      message:      `Apagar "${opt.label}"? References cadastradas com esse valor não serão apagadas, mas o campo ficará órfão.`,
      confirmLabel: 'Apagar',
      variant:      'danger',
    })
    if (!ok) return
    setBusyId(opt.id)
    try {
      await CreativeApi.deleteTaxonomy(opt.id)
      await load()
      // Se era o selecionado, limpa
      if (value === opt.value) onChange('')
    } catch (e) {
      await alertDialog({
        title:   'Falha ao apagar',
        message: (e as Error).message,
        variant: 'danger',
      })
    } finally {
      setBusyId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div ref={ref} className={['relative', className ?? ''].join(' ')}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={[
          'w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 border rounded-lg text-sm text-left transition-colors',
          open ? 'border-cyan-400' : 'border-zinc-800 hover:border-zinc-700',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          value ? 'text-zinc-200' : 'text-zinc-500',
        ].join(' ')}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={12} className={['shrink-0 text-zinc-500 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden max-h-[360px] flex flex-col">
          {loading && (
            <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-zinc-500">
              <Loader2 size={12} className="animate-spin" /> carregando…
            </div>
          )}

          {!loading && (
            <div className="overflow-y-auto flex-1">
              {/* Opção vazia */}
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => select('')}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                    !value ? 'bg-cyan-400/10 text-cyan-300' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300',
                  ].join(' ')}
                >
                  {!value && <Check size={11} className="text-cyan-400" />}
                  <span className="italic">{placeholder}</span>
                </button>
              )}

              {options.map(opt => (
                <OptionRow
                  key={opt.id}
                  opt={opt}
                  selected={value === opt.value}
                  busy={busyId === opt.id}
                  onSelect={() => select(opt.value)}
                  onEdit={() => setEditing(opt)}
                  onDelete={() => handleDelete(opt)}
                />
              ))}

              {options.length === 0 && (
                <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                  Nenhuma opção cadastrada
                </div>
              )}
            </div>
          )}

          {/* Footer: criar nova / inline form */}
          <div className="border-t border-zinc-800 bg-zinc-900/50">
            {creating ? (
              <CreateInlineForm
                kind={kind}
                onCancel={() => setCreating(false)}
                onCreated={handleCreated}
              />
            ) : editing ? (
              <EditInlineForm
                option={editing}
                onCancel={() => setEditing(null)}
                onSaved={handleEdited}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/10 transition-colors"
              >
                <Plus size={12} /> Adicionar nova opção…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function OptionRow({
  opt, selected, busy, onSelect, onEdit, onDelete,
}: {
  opt:       TaxonomyOption
  selected:  boolean
  busy:      boolean
  onSelect:  () => void
  onEdit:    () => void
  onDelete:  () => void
}) {
  return (
    <div
      className={[
        'group flex items-center gap-1 px-2 py-1.5 transition-colors',
        selected ? 'bg-cyan-400/10' : 'hover:bg-zinc-900',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        className={[
          'flex-1 flex items-center gap-2 text-xs text-left truncate',
          selected ? 'text-cyan-300' : 'text-zinc-200',
        ].join(' ')}
      >
        <span className="w-3 shrink-0">{selected && <Check size={11} className="text-cyan-400" />}</span>
        <span className="truncate">{opt.label}</span>
        {opt.is_default && (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 shrink-0">
            padrão
          </span>
        )}
      </button>

      {!opt.is_default && (
        <div className="flex items-center gap-0.5 shrink-0">
          {busy ? (
            <Loader2 size={10} className="animate-spin text-zinc-500 mx-1.5" />
          ) : (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEdit() }}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
                title="Editar"
              >
                <Edit3 size={10} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete() }}
                className="p-1 rounded text-zinc-500 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title="Apagar"
              >
                <Trash2 size={10} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CreateInlineForm({
  kind, onCancel, onCreated,
}: {
  kind:      TaxonomyKind
  onCancel:  () => void
  onCreated: (opt: TaxonomyOption) => void
}) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => { labelRef.current?.focus() }, [])

  // Auto-derive value snake_case do label conforme digita
  const onLabelChange = (v: string) => {
    setLabel(v)
    // Só atualiza value se user não editou manualmente
    if (value === '' || value === slugify(label)) {
      setValue(slugify(v))
    }
  }

  const submit = async () => {
    if (!label.trim()) { setError('Nome obrigatório'); return }
    if (!value.trim()) { setError('Chave obrigatória'); return }
    if (!/^[a-z0-9_]+$/.test(value)) { setError('Chave: só [a-z0-9_]'); return }
    setBusy(true)
    setError(null)
    try {
      const created = await CreativeApi.createTaxonomy({
        kind,
        value: value.trim(),
        label: label.trim(),
      })
      onCreated(created)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nova opção</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-500 hover:text-zinc-300"
          aria-label="Cancelar"
        >
          <X size={11} />
        </button>
      </div>
      <input
        ref={labelRef}
        type="text"
        value={label}
        onChange={e => onLabelChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Nome (ex: Área da piscina)"
        disabled={busy}
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="chave (auto)"
        disabled={busy}
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono text-zinc-300 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
      {error && (
        <p className="text-[10px] text-red-300">{error}</p>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-1.5 rounded text-[11px] text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !label.trim() || !value.trim()}
          className="flex-1 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-semibold disabled:opacity-50 disabled:hover:bg-cyan-400 transition-colors inline-flex items-center justify-center gap-1"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : null}
          Criar
        </button>
      </div>
    </div>
  )
}

function EditInlineForm({
  option, onCancel, onSaved,
}: {
  option:    TaxonomyOption
  onCancel:  () => void
  onSaved:   (opt: TaxonomyOption) => void
}) {
  const [label, setLabel] = useState(option.label)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])

  const submit = async () => {
    if (!label.trim()) { setError('Nome obrigatório'); return }
    if (label.trim() === option.label) { onCancel(); return }
    setBusy(true)
    setError(null)
    try {
      const updated = await CreativeApi.updateTaxonomy(option.id, { label: label.trim() })
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Editar "{option.label}"
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-500 hover:text-zinc-300"
          aria-label="Cancelar"
        >
          <X size={11} />
        </button>
      </div>
      <input
        ref={labelRef}
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        disabled={busy}
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 outline-none focus:border-cyan-400"
      />
      <p className="text-[10px] text-zinc-600 font-mono">chave: {option.value} (não editável)</p>
      {error && (
        <p className="text-[10px] text-red-300">{error}</p>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-1.5 rounded text-[11px] text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !label.trim()}
          className="flex-1 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-semibold disabled:opacity-50 disabled:hover:bg-cyan-400 transition-colors inline-flex items-center justify-center gap-1"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : null}
          Salvar
        </button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
