'use client'

/**
 * F1 (sessão 2026-05-14) — Upload de planilha de produtos.
 *
 * Fluxo:
 *   1. Usuário sobe .xlsx/.csv via dropzone
 *   2. Backend faz dry-run: parseia, mapeia colunas, conta criados vs skip
 *   3. UI mostra preview + summary
 *   4. Usuário clica "Confirmar importação" → backend executa commit
 *   5. Mostra relatório final + link pra /produtos com filtro de pendentes
 *
 * Produtos novos recebem tag 'cadastro_pendente' + catalog_status='incomplete'
 * automaticamente. SKUs já cadastrados são pulados silenciosamente.
 */

import { useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type DryRunResult = {
  headers:          string[]
  rows_count:       number
  column_mapping:   Record<string, string>
  missing_required: string[]
  preview: Array<{
    row:      number
    sku:      string
    name:     string
    would_be: 'created' | 'skipped' | 'error'
    reason?:  string
  }>
  summary: { would_create: number; would_skip: number; would_error: number }
}

type CommitResult = {
  batch_id:               string
  rows_total:             number
  rows_created:           number
  rows_skipped_existing:  number
  rows_errors:            number
  errors:                 Array<{ row: number; sku?: string; message: string }>
  column_mapping:         Record<string, string>
  preview_created:        Array<{ sku: string; name: string }>
}

type Batch = {
  id:                    string
  file_name:             string | null
  rows_total:            number
  rows_created:          number
  rows_skipped_existing: number
  rows_errors:           number
  status:                string
  created_at:            string
  finished_at:           string | null
  default_tag:           string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── main page ────────────────────────────────────────────────────────────────

export default function ImportarProdutosPage() {
  const t = useTranslations('produtos')
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [commit, setCommit] = useState<CommitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Batch[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // ── select file ───────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const f = files[0]
    const okExt = /\.(xlsx|xls|csv)$/i.test(f.name)
    if (!okExt) {
      setError(t('import.errorExt'))
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError(t('import.errorSize'))
      return
    }
    setFile(f)
    setError(null)
    setCommit(null)
    setLoading(true)

    try {
      const token = await getAuthToken()
      if (!token) throw new Error(t('import.sessionExpired'))
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch(`${BACKEND}/products/import/dry-run`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      setDryRun(body as DryRunResult)
    } catch (e) {
      setError((e as Error).message)
      setFile(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  // ── confirm commit ────────────────────────────────────────────────────────

  const handleCommit = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) throw new Error(t('import.sessionExpired'))
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BACKEND}/products/import`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      setCommit(body as CommitResult)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [file, t])

  // ── reset for new import ──────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setFile(null)
    setDryRun(null)
    setCommit(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── load history ─────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch(`${BACKEND}/products/import-batches?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => [])
      setHistory(Array.isArray(body) ? body : [])
    } catch { /* silent */ }
  }, [])

  // ── download template ────────────────────────────────────────────────────

  const downloadTemplate = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch(`${BACKEND}/products/import-template`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'eclick-produtos-template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(t('import.templateError', { msg: (e as Error).message }))
    }
  }, [t])

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a0c' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/dashboard/produtos" className="hover:text-zinc-300 transition-colors">{t('import.breadcrumbProducts')}</Link>
              <span>›</span>
              <span>{t('import.breadcrumbImport')}</span>
            </div>
            <h1 className="text-2xl font-bold">{t('import.title')}</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {t.rich('import.subtitle', {
                tag: (chunks) => <span className="text-cyan-400">{chunks}</span>,
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate}
              className="px-3 py-2 rounded-lg text-[13px] font-medium border transition-all hover:text-cyan-400 hover:border-cyan-500/40"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
              {t('import.downloadTemplate')}
            </button>
            <button onClick={() => { setHistoryOpen(true); loadHistory() }}
              className="px-3 py-2 rounded-lg text-[13px] font-medium border transition-all hover:text-cyan-400 hover:border-cyan-500/40"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
              {t('import.history')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
            style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Step 1: Dropzone (oculto se já tem dryRun ou commit) */}
        {!dryRun && !commit && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault(); setDragOver(false)
              void handleFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer p-12 text-center ${dragOver ? 'border-cyan-500 bg-cyan-500/5' : 'border-zinc-700 hover:border-zinc-500'}`}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => void handleFiles(e.target.files)} />

            <div className="text-5xl mb-3">📊</div>
            <div className="text-lg font-semibold mb-1">{t('import.dropTitle')}</div>
            <div className="text-sm text-zinc-400 mb-3">{t('import.dropSubtitle')}</div>
            <div className="text-xs text-zinc-600">
              {t.rich('import.requiredColumns', {
                col: (chunks) => <span className="text-zinc-400">{chunks}</span>,
              })}
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
                <div className="text-cyan-400 text-sm font-medium animate-pulse">{t('import.processing')}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Dry-run preview */}
        {dryRun && !commit && (
          <div className="space-y-5">
            <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{t('import.preview')}</div>
                  <div className="font-semibold mt-1">{file?.name}</div>
                </div>
                <button onClick={handleReset}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  {t('import.changeFile')}
                </button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <SummaryCard label={t('import.summary.rows')} value={dryRun.rows_count} />
                <SummaryCard label={t('import.summary.willCreate')} value={dryRun.summary.would_create} color="emerald" />
                <SummaryCard label={t('import.summary.alreadyExist')} value={dryRun.summary.would_skip} color="amber" />
                <SummaryCard label={t('import.summary.readErrors')} value={dryRun.summary.would_error} color={dryRun.summary.would_error > 0 ? 'red' : undefined} />
              </div>

              {/* Missing columns warning */}
              {dryRun.missing_required.length > 0 && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
                  style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
                  <div className="font-semibold mb-1">{t('import.missingColsTitle')}</div>
                  <div className="text-xs">
                    {t('import.missingColsText', { cols: dryRun.missing_required.join(', ') })}
                  </div>
                </div>
              )}

              {/* Column mapping */}
              <div className="mb-4">
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">{t('import.columnMapping')}</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dryRun.column_mapping).map(([header, mapped]) => (
                    <span key={header}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border"
                      style={{ background: 'rgba(0,229,255,0.05)', borderColor: 'rgba(0,229,255,0.2)' }}>
                      <span className="text-zinc-400">{header}</span>
                      <span className="text-zinc-600">→</span>
                      <span className="text-cyan-400 font-medium">{mapped}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              {dryRun.preview.length > 0 && (
                <div className="mb-5">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                    {t('import.previewRows', { count: dryRun.preview.length })}
                  </div>
                  <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #27272a' }}>
                    <table className="w-full text-sm">
                      <thead style={{ background: '#0d0d10' }}>
                        <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-left">{t('import.col.name')}</th>
                          <th className="px-3 py-2 text-right">{t('import.col.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRun.preview.map(p => (
                          <tr key={p.row} className="border-t" style={{ borderColor: '#27272a' }}>
                            <td className="px-3 py-2 text-zinc-500">{p.row}</td>
                            <td className="px-3 py-2 font-mono text-[12px]">{p.sku || '—'}</td>
                            <td className="px-3 py-2 max-w-md truncate">{p.name || '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <ActionPill kind={p.would_be} reason={p.reason} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="flex items-center justify-end gap-3">
                <button onClick={handleReset}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                  {t('import.cancel')}
                </button>
                <button onClick={() => void handleCommit()}
                  disabled={loading || dryRun.summary.would_create === 0 || dryRun.missing_required.length > 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)',
                    color: '#000',
                  }}>
                  {loading ? t('import.importing') : t('import.confirmImport', { count: dryRun.summary.would_create })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Commit result */}
        {commit && (
          <div className="space-y-5">
            <div className="rounded-2xl p-6 text-center" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-5xl mb-2">{commit.rows_errors > 0 ? '⚠️' : '✅'}</div>
              <div className="text-xl font-semibold mb-1">{t('import.doneTitle')}</div>
              <div className="text-sm text-zinc-400 mb-5">
                {commit.rows_created > 0 && (
                  <>
                    {t.rich('import.doneCreated', {
                      count: commit.rows_created,
                      v: (chunks) => <span className="text-emerald-400 font-medium">{chunks}</span>,
                    })}
                    {commit.rows_skipped_existing > 0 && ', '}
                  </>
                )}
                {commit.rows_skipped_existing > 0 && (
                  t.rich('import.doneSkipped', {
                    count: commit.rows_skipped_existing,
                    v: (chunks) => <span className="text-amber-400 font-medium">{chunks}</span>,
                  })
                )}
                {commit.rows_errors > 0 && (
                  <>, {t.rich('import.doneErrors', {
                    count: commit.rows_errors,
                    v: (chunks) => <span className="text-red-400 font-medium">{chunks}</span>,
                  })}</>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5 text-left">
                <SummaryCard label={t('import.summary.created')} value={commit.rows_created} color="emerald" />
                <SummaryCard label={t('import.summary.existed')} value={commit.rows_skipped_existing} color="amber" />
                <SummaryCard label={t('import.summary.errors')} value={commit.rows_errors} color={commit.rows_errors > 0 ? 'red' : undefined} />
              </div>

              {commit.errors.length > 0 && (
                <div className="text-left mb-5">
                  <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">{t('import.errorsTitle', { count: commit.errors.length })}</div>
                  <div className="rounded-lg max-h-48 overflow-y-auto"
                    style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
                    {commit.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs border-b last:border-b-0"
                        style={{ borderColor: '#27272a' }}>
                        <span className="text-zinc-500">{t('import.lineN', { row: e.row })}</span>
                        {e.sku && <span className="ml-2 text-zinc-400 font-mono">{e.sku}</span>}
                        <span className="ml-2 text-red-400">{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button onClick={handleReset}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                  {t('import.importAnother')}
                </button>
                <button onClick={() => router.push('/dashboard/produtos?quick_filter=cadastro_pendente')}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)',
                    color: '#000',
                  }}>
                  {t('import.viewPending')} →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History panel (slide-in) */}
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex" onClick={() => setHistoryOpen(false)}>
            <div className="flex-1 bg-black/60" />
            <div className="w-[420px] h-full overflow-y-auto p-6"
              style={{ background: '#0d0d10', borderLeft: '1px solid #27272a' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold">{t('import.historyTitle')}</div>
                <button onClick={() => setHistoryOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {history.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-8">{t('import.noImports')}</div>
              ) : (
                <div className="space-y-2">
                  {history.map(b => (
                    <div key={b.id} className="p-3 rounded-lg"
                      style={{ background: '#111114', border: '1px solid #27272a' }}>
                      <div className="text-sm font-medium truncate">{b.file_name || t('import.noName')}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(b.created_at)}</div>
                      <div className="flex gap-3 mt-2 text-[11px]">
                        <span className="text-emerald-400">+{b.rows_created}</span>
                        <span className="text-amber-400">{t('import.skippedCount', { count: b.rows_skipped_existing })}</span>
                        {b.rows_errors > 0 && <span className="text-red-400">{t('import.errorsCount', { count: b.rows_errors })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── components ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color?: 'emerald' | 'amber' | 'red' }) {
  const COLORS = {
    emerald: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', text: '#34d399' },
    amber:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
    red:     { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', text: '#f87171' },
  } as const
  const c = color ? COLORS[color] : { bg: '#0d0d10', border: '#27272a', text: '#e4e4e7' }
  return (
    <div className="p-3 rounded-lg" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: c.text }}>{value}</div>
    </div>
  )
}

function ActionPill({ kind, reason }: { kind: 'created' | 'skipped' | 'error'; reason?: string }) {
  const t = useTranslations('produtos')
  const cfg = {
    created: { bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
    skipped: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    error:   { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  }[kind]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }} title={reason}>
      {t(`import.actionPill.${kind}`)}
    </span>
  )
}
