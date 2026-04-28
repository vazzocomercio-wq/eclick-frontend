'use client'

import {
  useState, useEffect, useRef, useMemo, useCallback,
  type ReactNode,
} from 'react'
import {
  Search, Plus, ChevronDown, ChevronUp, MoreHorizontal,
  ChevronLeft, ChevronRight, X, ChevronsLeft, ChevronsRight,
  Info, PanelRightOpen, PanelRightClose,
} from 'lucide-react'
import type {
  DataTableProps, Column, RowAction, PanelSection, SortState,
} from './types'
import { ensurePulseStyles, pulseClass } from '../ui/pulsing-button'

const COL_BG    = '#111114'
const COL_BORDER = '#1e1e24'
const ROW_HOVER = '#161618'

// ── Utility hooks ─────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onOutside])
  return ref
}

// ── Quick filter dropdown ─────────────────────────────────────────────────────

function QuickFilterMenu({ qf }: {
  qf: NonNullable<DataTableProps<unknown>['quickFilter']>
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const current = qf.options.find(o => o.value === qf.value) ?? qf.options[0]
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
        style={{ background: COL_BG, color: '#e4e4e7', border: `1px solid ${COL_BORDER}` }}>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{qf.label}</span>
        <span>{current?.label ?? '—'}</span>
        <ChevronDown size={12} className="text-zinc-500" />
      </button>
      {open && (
        <div className="absolute mt-1 z-30 right-0 min-w-[200px] rounded-xl py-1 shadow-xl"
          style={{ background: COL_BG, border: `1px solid ${COL_BORDER}` }}>
          {qf.options.map(opt => (
            <button key={opt.value}
              onClick={() => { qf.onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] hover:bg-zinc-900/60"
              style={{ color: opt.value === qf.value ? '#00E5FF' : '#d4d4d8' }}>
              <span>{opt.label}</span>
              {opt.count != null && (
                <span className="text-[10px] tabular-nums text-zinc-500">{opt.count.toLocaleString('pt-BR')}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Row kebab menu ────────────────────────────────────────────────────────────

function RowMenu<T>({ row, actions }: { row: T; actions: RowAction<T>[] }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  if (actions.length === 0) return null
  return (
    <div className="relative" ref={ref}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute z-40 right-0 mt-1 min-w-[220px] rounded-xl py-1 shadow-2xl"
          style={{ background: COL_BG, border: `1px solid ${COL_BORDER}` }}>
          {actions.map(a => {
            const tone =
              a.tone === 'danger'  ? '#f87171' :
              a.tone === 'warn'    ? '#facc15' :
              a.tone === 'success' ? '#4ade80' : '#e4e4e7'
            return (
              <button key={a.key}
                disabled={a.disabled}
                title={a.disabled ? a.disabledHint : undefined}
                onClick={(e) => { e.stopPropagation(); if (!a.disabled) { a.onClick(row); setOpen(false) } }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-zinc-900/70"
                style={{ color: tone }}>
                {a.icon && <span className="shrink-0 w-4 flex items-center justify-center">{a.icon}</span>}
                <span>{a.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({ panel, onClose, isMobile }: {
  panel: { title?: string; sections: PanelSection[] }
  onClose: () => void
  isMobile: boolean
}) {
  return (
    <aside
      className={[
        isMobile
          ? 'fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-2xl'
          : 'w-[280px] shrink-0 self-start sticky top-4 rounded-2xl overflow-hidden',
      ].join(' ')}
      style={{ background: COL_BG, border: `1px solid ${COL_BORDER}` }}>
      <header className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${COL_BORDER}` }}>
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
          {panel.title ?? 'Painel'}
        </span>
        {isMobile && (
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800/70 text-zinc-400">
            <X size={14} />
          </button>
        )}
      </header>
      <div className="p-3 space-y-4">
        {panel.sections.map((s, i) => (
          <PanelSectionView key={i} section={s} />
        ))}
      </div>
    </aside>
  )
}

function PanelSectionView({ section }: { section: PanelSection }) {
  useEffect(ensurePulseStyles, [])
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">
        {section.title}
      </div>
      {section.node}
      {section.items && (
        <div className="space-y-1">
          {section.items.map((it, idx) => {
            const tone =
              it.tone === 'danger'  ? '#f87171' :
              it.tone === 'warn'    ? '#facc15' :
              it.tone === 'success' ? '#4ade80' :
              it.tone === 'accent'  ? '#00E5FF' : '#d4d4d8'
            const Wrapper: React.ElementType = it.onClick ? 'button' : 'div'
            const baseCls =
              'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[12px] disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-zinc-800/70 transition-opacity'
            const pulse = pulseClass(!!it.loading)
            return (
              <Wrapper
                key={idx}
                {...(it.onClick
                  ? {
                      onClick: it.onClick,
                      disabled: it.disabled || it.loading,
                      'aria-busy': it.loading || undefined,
                      className: `${baseCls} ${pulse}`,
                    }
                  : {
                      className:
                        'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[12px]',
                    })}
                style={{ color: tone }}>
                <span className="flex items-center gap-2">
                  {it.icon && <span className="shrink-0">{it.icon}</span>}
                  <span className="text-left">{it.label}</span>
                  {it.badge != null && (
                    <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded"
                      style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
                      {typeof it.badge === 'number' ? it.badge.toLocaleString('pt-BR') : it.badge}
                    </span>
                  )}
                </span>
                {it.value != null && (
                  <span className="text-[11px] tabular-nums text-zinc-300">{it.value}</span>
                )}
              </Wrapper>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    title, breadcrumb, quickFilter, headerExtras, onIncluir, incluirLabel = 'Incluir',
    search, dateRange, filters, toolbarExtras,
    columns, data, totalCount, loading, getRowId, onRowClick,
    sort, onSortChange,
    pagination, perPageOptions = [10, 25, 50, 100],
    selection, bulkActions = [], rowActions, rightPanel, emptyState,
  } = props

  // ── Search debounce ─────────────────────────────────────────────────────────
  const [searchLocal, setSearchLocal] = useState(search?.value ?? '')
  useEffect(() => { setSearchLocal(search?.value ?? '') }, [search?.value])
  const debounced = useDebounced(searchLocal, search?.debounce ?? 400)
  useEffect(() => {
    if (search && debounced !== search.value) search.onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // ── Selection ───────────────────────────────────────────────────────────────
  const selectedIds = selection?.selected ?? []
  const allOnPage = useMemo(() => data.map(r => getRowId(r)), [data, getRowId])
  const allChecked = allOnPage.length > 0 && allOnPage.every(id => selectedIds.includes(id))
  const someChecked = allOnPage.some(id => selectedIds.includes(id)) && !allChecked

  const toggleAll = useCallback(() => {
    if (!selection) return
    if (allChecked) {
      selection.onChange(selectedIds.filter(id => !allOnPage.includes(id)))
    } else {
      selection.onChange([...new Set([...selectedIds, ...allOnPage])])
    }
  }, [allChecked, allOnPage, selectedIds, selection])

  const toggleOne = useCallback((id: string) => {
    if (!selection) return
    if (selection.mode === 'single') {
      selection.onChange(selectedIds.includes(id) ? [] : [id])
      return
    }
    selection.onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id],
    )
  }, [selection, selectedIds])

  const selectedRows = useMemo(
    () => data.filter(r => selectedIds.includes(getRowId(r))),
    [data, selectedIds, getRowId],
  )

  // ── Pagination ──────────────────────────────────────────────────────────────
  const { page, perPage, onPageChange, onPerPageChange } = pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
  const from = totalCount === 0 ? 0 : (page - 1) * perPage + 1
  const to   = Math.min(totalCount, page * perPage)

  // ── Sort header click ───────────────────────────────────────────────────────
  const headerSort = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return
    if (sort?.key === col.key) {
      onSortChange(sort.dir === 'asc' ? { key: col.key, dir: 'desc' } : null)
    } else {
      onSortChange({ key: col.key, dir: 'asc' })
    }
  }

  // ── Right-panel responsive open state ───────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {breadcrumb && breadcrumb.length > 0 && (
            <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">
              {breadcrumb.join(' / ')}
            </p>
          )}
          <h1 className="text-white text-xl font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {quickFilter && <QuickFilterMenu qf={quickFilter} />}
          {headerExtras}
          {rightPanel && isMobile && (
            <button onClick={() => setPanelOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
              style={{ background: COL_BG, color: '#a1a1aa', border: `1px solid ${COL_BORDER}` }}>
              {panelOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              Painel
            </button>
          )}
          {onIncluir && (
            <button onClick={onIncluir}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(90deg,#00E5FF 0%,#3b82f6 100%)',
                color: '#000',
                boxShadow: '0 0 18px rgba(0,229,255,0.20)',
              }}>
              <Plus size={14} /> {incluirLabel}
            </button>
          )}
        </div>
      </div>

      {/* Bulk-action banner */}
      {selection && selectedIds.length > 0 && (
        <div className="rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap"
          style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.30)', color: '#00E5FF' }}>
          <span className="text-[12px] font-semibold">
            {selectedIds.length.toLocaleString('pt-BR')} selecionado{selectedIds.length === 1 ? '' : 's'}
          </span>
          <span className="text-zinc-500">·</span>
          <button onClick={() => selection.onChange([])}
            className="text-[11px] text-zinc-400 hover:text-zinc-200">Limpar</button>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {bulkActions.map(b => {
              const tone =
                b.tone === 'danger'  ? '#f87171' :
                b.tone === 'warn'    ? '#facc15' :
                b.tone === 'success' ? '#4ade80' : '#00E5FF'
              return (
                <button key={b.key}
                  onClick={() => b.onClick(selectedRows)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold hover:bg-zinc-900/50"
                  style={{ color: tone, border: `1px solid ${tone}40`, background: '#0c0c10' }}>
                  {b.icon}
                  {b.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className={rightPanel && !isMobile ? 'flex gap-4 items-start' : ''}>
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          {(search || dateRange || filters || toolbarExtras) && (
            <div className="rounded-2xl p-3 flex items-center gap-2 flex-wrap"
              style={{ background: COL_BG, border: `1px solid ${COL_BORDER}` }}>
              {search && (
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input value={searchLocal} onChange={e => setSearchLocal(e.target.value)}
                    placeholder={search.placeholder ?? 'Buscar...'}
                    className="w-full pl-9 pr-3 py-2 text-[12px] rounded-lg bg-[#0c0c10] border border-[#27272a] text-zinc-200 outline-none focus:border-[#00E5FF]" />
                </div>
              )}
              {dateRange && (
                <div className="flex items-center gap-1">
                  <input type="date" value={dateRange.from}
                    onChange={e => dateRange.onChange(e.target.value, dateRange.to)}
                    className="px-2 py-2 text-[12px] rounded-lg bg-[#0c0c10] border border-[#27272a] text-zinc-200" />
                  <span className="text-zinc-500 text-[11px]">→</span>
                  <input type="date" value={dateRange.to}
                    onChange={e => dateRange.onChange(dateRange.from, e.target.value)}
                    className="px-2 py-2 text-[12px] rounded-lg bg-[#0c0c10] border border-[#27272a] text-zinc-200" />
                </div>
              )}
              {filters}
              <div className="ml-auto flex items-center gap-2">{toolbarExtras}</div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: COL_BG, border: `1px solid ${COL_BORDER}` }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                    style={{ borderBottom: `1px solid ${COL_BORDER}` }}>
                    {selection && (
                      <th className="px-3 py-2 w-8">
                        {selection.mode === 'multi' && (
                          <input type="checkbox" checked={allChecked}
                            ref={el => { if (el) el.indeterminate = someChecked }}
                            onChange={toggleAll}
                            className="accent-cyan-400 cursor-pointer" />
                        )}
                      </th>
                    )}
                    {columns.map(c => (
                      <th key={c.key}
                        className={['px-3 py-2 font-semibold whitespace-nowrap',
                          c.align === 'right'  ? 'text-right'  : '',
                          c.align === 'center' ? 'text-center' : '',
                          c.sortable ? 'cursor-pointer select-none' : '',
                          c.className ?? '',
                        ].join(' ')}
                        style={c.width ? { width: c.width } : undefined}
                        onClick={() => headerSort(c)}>
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          {c.sortable && sort?.key === c.key && (
                            sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                          )}
                        </span>
                      </th>
                    ))}
                    {rowActions && <th className="px-3 py-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0)}
                      className="px-3 py-12 text-center text-[12px] text-zinc-600">Carregando…</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan={columns.length + (selection ? 1 : 0) + (rowActions ? 1 : 0)}
                      className="px-3 py-12">
                      <EmptyView empty={emptyState} />
                    </td></tr>
                  ) : data.map(row => {
                    const id = getRowId(row)
                    const isSel = selectedIds.includes(id)
                    return (
                      <tr key={id}
                        onClick={() => onRowClick?.(row)}
                        className={[
                          'transition-colors',
                          onRowClick ? 'cursor-pointer' : '',
                          isSel ? 'bg-cyan-500/5' : 'hover:bg-[#161618]',
                        ].join(' ')}
                        style={isSel ? { borderLeft: '2px solid #00E5FF' } : { borderLeft: '2px solid transparent' }}>
                        {selection && (
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSel}
                              onChange={() => toggleOne(id)}
                              className="accent-cyan-400 cursor-pointer" />
                          </td>
                        )}
                        {columns.map(c => (
                          <td key={c.key}
                            className={['px-3 py-2.5 text-[12px] text-zinc-200',
                              c.align === 'right'  ? 'text-right'  : '',
                              c.align === 'center' ? 'text-center' : '',
                              c.className ?? '',
                            ].join(' ')}>
                            {c.render ? c.render(row) : asString(row, c.key)}
                          </td>
                        ))}
                        {rowActions && (
                          <td className="px-3 py-2.5 w-8" onClick={e => e.stopPropagation()}>
                            <RowMenu row={row} actions={rowActions(row)} />
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 flex-wrap"
              style={{ borderTop: `1px solid ${COL_BORDER}` }}>
              <div className="text-[11px] text-zinc-500 tabular-nums">
                {totalCount === 0
                  ? 'Sem registros'
                  : `${from.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${totalCount.toLocaleString('pt-BR')}`}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <label className="flex items-center gap-1.5">
                  <span>Por página</span>
                  <select value={perPage} onChange={e => onPerPageChange(Number(e.target.value))}
                    className="bg-[#0c0c10] border border-[#27272a] text-zinc-200 rounded px-1.5 py-1">
                    {perPageOptions.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <Pager page={page} totalPages={totalPages} onPageChange={onPageChange} />
              </div>
            </div>
          </div>
        </div>

        {rightPanel && (!isMobile || panelOpen) && (
          <RightPanel panel={rightPanel} onClose={() => setPanelOpen(false)} isMobile={isMobile} />
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function asString<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key]
  if (v == null) return <span className="text-zinc-700">—</span>
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function EmptyView({ empty }: { empty?: DataTableProps<unknown>['emptyState'] }) {
  return (
    <div className="flex flex-col items-center gap-2 text-zinc-500">
      <span className="opacity-50">{empty?.icon ?? <Info size={24} />}</span>
      <p className="text-[13px] font-semibold text-zinc-400">{empty?.title ?? 'Nenhum registro'}</p>
      {empty?.description && <p className="text-[11px] max-w-md text-center">{empty.description}</p>}
      {empty?.cta && (
        <button onClick={empty.cta.onClick}
          className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: '#00E5FF', color: '#000' }}>
          {empty.cta.label}
        </button>
      )}
    </div>
  )
}

function Pager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const go = (p: number) => onPageChange(Math.min(Math.max(p, 1), totalPages))
  const btn = (children: ReactNode, p: number, disabled?: boolean) => (
    <button onClick={() => go(p)} disabled={disabled}
      className="w-7 h-7 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 disabled:opacity-30 disabled:cursor-not-allowed">
      {children}
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      {btn(<ChevronsLeft size={14} />, 1,            page === 1)}
      {btn(<ChevronLeft  size={14} />, page - 1,     page === 1)}
      <span className="text-[11px] tabular-nums px-2 text-zinc-300">
        {page} / {totalPages}
      </span>
      {btn(<ChevronRight  size={14} />, page + 1,    page === totalPages)}
      {btn(<ChevronsRight size={14} />, totalPages,  page === totalPages)}
    </div>
  )
}
