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
import { createPortal } from 'react-dom'
import { ChevronDown, Plus, X, Edit3, Trash2, Loader2, Check, EyeOff, RotateCcw } from 'lucide-react'
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
  const [showHidden, setShowHidden] = useState(false)
  /**
   * Position calculada pra renderizar o dropdown em PORTAL no document.body.
   * Necessário porque o componente é usado dentro de containers com overflow:auto
   * (drawer de ref), o que clipparia um dropdown absolute relativo ao container.
   */
  const [pos, setPos] = useState<{
    top:       number
    left:      number
    width:     number
    maxHeight: number
    direction: 'down' | 'up'
  } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmDialog = useConfirm()
  const alertDialog   = useAlert()

  /**
   * Recalcula posição absoluta do dropdown na viewport.
   * Decide direção (up/down) baseado em espaço disponível.
   */
  const recalcPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vh = window.innerHeight
    const spaceBelow = vh - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const desired = 360

    let direction: 'down' | 'up'
    let maxHeight: number
    let top: number

    if (spaceBelow >= desired) {
      direction = 'down'
      maxHeight = Math.min(desired, spaceBelow)
      top = rect.bottom + 4
    } else if (spaceAbove > spaceBelow) {
      direction = 'up'
      maxHeight = Math.min(desired, spaceAbove)
      top = rect.top - maxHeight - 4
    } else {
      direction = 'down'
      maxHeight = Math.max(180, spaceBelow)
      top = rect.bottom + 4
    }

    setPos({
      top,
      left:  rect.left,
      width: rect.width,
      maxHeight,
      direction,
    })
  }, [])

  // Recalcula ao abrir + listeners de resize/scroll
  useEffect(() => {
    if (!open) return
    recalcPosition()
    const onAny = () => recalcPosition()
    window.addEventListener('resize', onAny)
    window.addEventListener('scroll', onAny, true) // capture = pega qualquer ancestral scrollando
    return () => {
      window.removeEventListener('resize', onAny)
      window.removeEventListener('scroll', onAny, true)
    }
  }, [open, recalcPosition])

  // Carrega na montagem
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await CreativeApi.listTaxonomy(kind, { include_hidden: showHidden })
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
  }, [kind, alertDialog, showHidden])

  useEffect(() => { void load() }, [load])

  const portalRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora (considera ref do trigger E portal do dropdown)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      const inTrigger = ref.current?.contains(target)
      const inPortal  = portalRef.current?.contains(target)
      if (!inTrigger && !inPortal) {
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

  // ── Delete / Hide ─────────────────────────────────────────────────────
  //
  // - Custom da org (org_id preenchido, !is_default) → DELETE real
  // - Default global (org_id=null, is_default=true) → HIDE (soft, reversível)

  const handleDelete = async (opt: TaxonomyOption) => {
    if (opt.is_default) {
      // Hide (reversível)
      const ok = await confirmDialog({
        title:        'Ocultar opção',
        message:      `Ocultar "${opt.label}" da sua organização? Não vai ser apagada do sistema — você pode reativar depois ativando "Mostrar ocultas".`,
        confirmLabel: 'Ocultar',
        variant:      'warning',
      })
      if (!ok) return
      setBusyId(opt.id)
      try {
        await CreativeApi.hideTaxonomy(opt.id)
        await load()
        if (value === opt.value) onChange('')
      } catch (e) {
        await alertDialog({
          title:   'Falha ao ocultar',
          message: (e as Error).message,
          variant: 'danger',
        })
      } finally {
        setBusyId(null)
      }
      return
    }
    // Custom da org → DELETE real
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

  const handleUnhide = async (opt: TaxonomyOption) => {
    setBusyId(opt.id)
    try {
      await CreativeApi.unhideTaxonomy(opt.id)
      await load()
    } catch (e) {
      await alertDialog({
        title:   'Falha ao reativar',
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
        ref={triggerRef}
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

      {open && !disabled && pos && typeof window !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[60] rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col"
          style={{
            top:       `${pos.top}px`,
            left:      `${pos.left}px`,
            width:     `${pos.width}px`,
            maxHeight: `${pos.maxHeight}px`,
          }}
        >
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
                  onUnhide={() => handleUnhide(opt)}
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
                existingOptions={options}
                onCancel={() => setCreating(false)}
                onCreated={handleCreated}
              />
            ) : editing ? (
              <EditInlineForm
                option={editing}
                existingOptions={options}
                onCancel={() => setEditing(null)}
                onSaved={handleEdited}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/10 transition-colors border-b border-zinc-800"
                >
                  <Plus size={12} /> Adicionar nova opção…
                </button>
                <label className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={showHidden}
                    onChange={e => setShowHidden(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  Mostrar ocultas
                </label>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function OptionRow({
  opt, selected, busy, onSelect, onEdit, onDelete, onUnhide,
}: {
  opt:       TaxonomyOption
  selected:  boolean
  busy:      boolean
  onSelect:  () => void
  onEdit:    () => void
  onDelete:  () => void
  onUnhide:  () => void
}) {
  const isHidden = opt.hidden === true

  return (
    <div
      className={[
        'group flex items-center gap-1 px-2 py-1.5 transition-colors',
        selected ? 'bg-cyan-400/10' : 'hover:bg-zinc-900',
        isHidden ? 'opacity-50' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={isHidden ? undefined : onSelect}
        disabled={isHidden}
        className={[
          'flex-1 flex items-center gap-2 text-xs text-left truncate',
          selected ? 'text-cyan-300' : 'text-zinc-200',
          isHidden ? 'line-through cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span className="w-3 shrink-0">{selected && <Check size={11} className="text-cyan-400" />}</span>
        <span className="truncate">{opt.label}</span>
        {opt.is_default && (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 shrink-0">
            padrão
          </span>
        )}
        {isHidden && (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
            oculta
          </span>
        )}
      </button>

      <div className="flex items-center gap-0.5 shrink-0">
        {busy ? (
          <Loader2 size={10} className="animate-spin text-zinc-500 mx-1.5" />
        ) : isHidden ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUnhide() }}
            className="p-1 rounded text-cyan-400 hover:text-cyan-200 hover:bg-cyan-400/10 transition-all"
            title="Reativar"
          >
            <RotateCcw size={10} />
          </button>
        ) : (
          <>
            {!opt.is_default && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEdit() }}
                className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
                title="Editar"
              >
                <Edit3 size={10} />
              </button>
            )}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete() }}
              className={[
                'p-1 rounded opacity-0 group-hover:opacity-100 transition-all',
                opt.is_default
                  ? 'text-zinc-500 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-zinc-500 hover:text-red-300 hover:bg-red-500/10',
              ].join(' ')}
              title={opt.is_default ? 'Ocultar (reversível)' : 'Apagar'}
            >
              {opt.is_default ? <EyeOff size={10} /> : <Trash2 size={10} />}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CreateInlineForm({
  kind, existingOptions, onCancel, onCreated,
}: {
  kind:            TaxonomyKind
  existingOptions: TaxonomyOption[]
  onCancel:        () => void
  onCreated:       (opt: TaxonomyOption) => void
}) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [linkedPosition, setLinkedPosition] = useState<number | null>(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => { labelRef.current?.focus() }, [])

  // Auto-derive value snake_case do label conforme digita
  const onLabelChange = (v: string) => {
    setLabel(v)
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
        linked_position: kind === 'ambient' ? linkedPosition : null,
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
      {kind === 'ambient' && (
        <PositionLinkSelect
          value={linkedPosition}
          onChange={setLinkedPosition}
          existingOptions={existingOptions}
          excludeId={null}
          disabled={busy}
        />
      )}
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
  option, existingOptions, onCancel, onSaved,
}: {
  option:          TaxonomyOption
  existingOptions: TaxonomyOption[]
  onCancel:        () => void
  onSaved:         (opt: TaxonomyOption) => void
}) {
  const [label, setLabel] = useState(option.label)
  const [linkedPosition, setLinkedPosition] = useState<number | null>(option.linked_position)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])

  const submit = async () => {
    if (!label.trim()) { setError('Nome obrigatório'); return }
    const labelChanged    = label.trim() !== option.label
    const positionChanged = linkedPosition !== option.linked_position
    if (!labelChanged && !positionChanged) { onCancel(); return }
    setBusy(true)
    setError(null)
    try {
      const patch: { label?: string; linked_position?: number | null } = {}
      if (labelChanged)    patch.label = label.trim()
      if (positionChanged) patch.linked_position = linkedPosition
      const updated = await CreativeApi.updateTaxonomy(option.id, patch)
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
      {option.kind === 'ambient' && (
        <PositionLinkSelect
          value={linkedPosition}
          onChange={setLinkedPosition}
          existingOptions={existingOptions}
          excludeId={option.id}
          disabled={busy}
        />
      )}
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

/**
 * Sub-componente: select de "Linkar à posição: [— sem link, 1, 2, ..., 11]".
 * Mostra ao lado de cada posição o ambient que já está nela (se houver),
 * pra user não escolher conflito sem perceber. Se escolher posição ocupada,
 * backend retorna 409 — frontend não bloqueia client-side (só avisa).
 */
function PositionLinkSelect({
  value, onChange, existingOptions, excludeId, disabled,
}: {
  value:           number | null
  onChange:        (v: number | null) => void
  existingOptions: TaxonomyOption[]
  excludeId:       string | null
  disabled?:       boolean
}) {
  // Map de position → label do ambient que ocupa (excluindo o próprio em edit)
  // Só considera ambient (defaults globais não têm linked_position).
  const positionOwner = new Map<number, string>()
  for (const opt of existingOptions) {
    if (opt.kind !== 'ambient') continue
    if (opt.id === excludeId)   continue
    if (opt.linked_position != null) positionOwner.set(opt.linked_position, opt.label)
  }

  const conflictLabel = value != null ? positionOwner.get(value) : undefined

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Linkar à posição
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 outline-none focus:border-cyan-400 disabled:opacity-50"
      >
        <option value="">— sem link (só metadado)</option>
        {Array.from({ length: 11 }, (_, i) => i + 1).map(p => {
          const owner = positionOwner.get(p)
          return (
            <option key={p} value={p}>
              Posição {p}{owner ? ` — ocupada por "${owner}"` : ' — livre'}
            </option>
          )
        })}
      </select>
      {conflictLabel && (
        <p className="text-[10px] text-amber-300">
          ⚠ Posição {value} já tem "{conflictLabel}". Salvar vai falhar — desvincule essa outra primeiro.
        </p>
      )}
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
