import type { ReactNode } from 'react'

export type Align = 'left' | 'right' | 'center'

export type Column<T> = {
  key:        string
  label:      string
  sortable?:  boolean
  align?:     Align
  width?:     string
  className?: string
  render?:    (row: T) => ReactNode
}

export type RowAction<T = unknown> = {
  key:      string
  label:    string
  icon?:    ReactNode
  /** Tone hint — danger flips the label red; warn = amber. */
  tone?:    'default' | 'danger' | 'warn' | 'success'
  /** When true, action shows but is greyed-out (e.g. provider not configured). */
  disabled?: boolean
  /** Free-form hint tooltip when disabled. */
  disabledHint?: string
  onClick:  (row: T) => void
}

export type BulkAction<T = unknown> = {
  key:    string
  label:  string
  icon?:  ReactNode
  tone?:  'default' | 'danger' | 'warn' | 'success'
  /** Receives the array of selected rows. */
  onClick: (rows: T[]) => void
}

export type QuickFilterOption = { value: string; label: string; count?: number }
export type QuickFilter = {
  label:    string
  value:    string
  options:  QuickFilterOption[]
  onChange: (value: string) => void
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null

export type PanelSection = {
  title: string
  /** Either a list of items OR a free-form node. */
  items?: Array<{
    label:    string
    value?:   ReactNode
    icon?:    ReactNode
    onClick?: () => void
    disabled?: boolean
    badge?:   string | number
    tone?:    'default' | 'danger' | 'warn' | 'success' | 'accent'
  }>
  node?: ReactNode
}

export type EmptyStateProps = {
  icon?:        ReactNode
  title:        string
  description?: string
  cta?:         { label: string; onClick: () => void }
}

export type DataTableProps<T> = {
  /** Header */
  title:       string
  breadcrumb?: string[]
  quickFilter?: QuickFilter
  /** Optional left of the Incluir button (e.g. extra header CTAs) */
  headerExtras?: ReactNode
  onIncluir?:   () => void
  incluirLabel?: string

  /** Toolbar */
  search?: {
    value:        string
    placeholder?: string
    onChange:     (v: string) => void
    debounce?:    number
  }
  dateRange?: {
    from:     string
    to:       string
    onChange: (from: string, to: string) => void
  }
  /** Free-form filter node (chips, drawers, etc.) shown after search/date. */
  filters?: ReactNode
  /** Shown right of filters — a "Limpar" or extra toolbar actions */
  toolbarExtras?: ReactNode

  /** Data */
  columns:     Column<T>[]
  data:        T[]
  totalCount:  number
  loading?:    boolean
  getRowId:    (row: T) => string
  onRowClick?: (row: T) => void

  /** Sorting (controlled) */
  sort?:     SortState
  onSortChange?: (s: SortState) => void

  /** Pagination */
  pagination: {
    page:             number
    perPage:          number
    onPageChange:     (page: number) => void
    onPerPageChange:  (perPage: number) => void
  }
  perPageOptions?: number[]

  /** Selection */
  selection?: {
    mode:      'multi' | 'single'
    selected:  string[]
    onChange:  (ids: string[]) => void
  }
  bulkActions?: BulkAction<T>[]

  /** Row-level actions (kebab menu) */
  rowActions?: (row: T) => RowAction<T>[]

  /** Right panel (collapsible on tablet/mobile via bottom sheet). */
  rightPanel?: { title?: string; sections: PanelSection[] }

  /** States */
  emptyState?: EmptyStateProps
}
