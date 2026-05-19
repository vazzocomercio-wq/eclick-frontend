'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, Upload, FileSpreadsheet, AlertCircle, CheckCircle2,
  Loader2, X, Download, ChevronRight, AlertTriangle,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface ParsedRow {
  supplier_sku: string
  master_sku?: string
  product_sku?: string
  product_name?: string
  unit_cost: number
  packaging_cost?: number
  handling_cost?: number
  stock?: number
  lead_time_days?: number
  moq?: number
  _row_num: number
  _error?: string
}

interface PartnerInfo {
  id: string
  supplier_id: string
  suppliers: { id: string; name: string }
}

interface ImportResult {
  sync_log_id: string
  processed: number
  created: number
  updated: number
  failed: number
  cost_changes: number
  validation_errors: Array<{ row: number; supplier_sku: string; error: string }>
}

const HEADER_ALIASES: Record<keyof Omit<ParsedRow, '_row_num' | '_error'>, string[]> = {
  supplier_sku:    ['supplier_sku', 'sku do parceiro', 'sku parceiro', 'sku fornecedor', 'sku_parceiro'],
  master_sku:      ['master_sku', 'sku master', 'master', 'gtin', 'ean'],
  product_sku:     ['product_sku', 'sku', 'sku produto', 'sku catalogo', 'sku_produto'],
  product_name:    ['product_name', 'produto', 'nome', 'descricao', 'descrição'],
  unit_cost:       ['unit_cost', 'custo', 'cost', 'preco', 'preço', 'valor', 'custo unitario', 'custo unitário'],
  packaging_cost:  ['packaging_cost', 'embalagem', 'cust embalagem', 'custo embalagem'],
  handling_cost:   ['handling_cost', 'manuseio', 'handling'],
  stock:           ['stock', 'estoque', 'qtd', 'quantidade', 'qty'],
  lead_time_days:  ['lead_time', 'lead time', 'prazo', 'lt', 'lead_time_days', 'dias'],
  moq:             ['moq', 'pedido minimo', 'pedido mínimo', 'min', 'minimo', 'mínimo'],
}

const REQUIRED: (keyof typeof HEADER_ALIASES)[] = ['supplier_sku', 'unit_cost']

export default function ImportPage() {
  const t = useTranslations('dropship.import')
  const params = useParams()
  const router = useRouter()
  const profileId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [partner, setPartner] = useState<PartnerInfo | null>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [missingHeaders, setMissingHeaders] = useState<string[]>([])
  const [parseErr, setParseErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [submitErr, setSubmitErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  // Load partner info
  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/dropship/partners/${profileId}`, { headers })
        if (res.ok) setPartner(await res.json())
      } catch { /* ignore */ }
    })()
  }, [profileId, getHeaders])

  async function handleFile(f: File) {
    setFile(f)
    setParsing(true); setParseErr(''); setParsed(null); setMissingHeaders([])
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error(t('errors.noValidSheet'))
      const sheet = wb.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (json.length === 0) throw new Error(t('errors.emptySheet'))

      // Identifica headers
      const sourceHeaders = Object.keys(json[0])
      const fieldToHeader: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {}
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        const found = findHeader(sourceHeaders, aliases)
        if (found) fieldToHeader[field as keyof typeof HEADER_ALIASES] = found
      }

      const missing = REQUIRED.filter(r => !fieldToHeader[r])
      setMissingHeaders(missing.map(m => m.replace('_', ' ')))
      if (missing.length > 0) {
        throw new Error(`${t('errors.missingColumns')}: ${missing.join(', ')}`)
      }

      // Parse rows
      const rows: ParsedRow[] = json.map((r, idx) => {
        const get = (field: keyof typeof HEADER_ALIASES) => {
          const h = fieldToHeader[field]
          return h ? r[h] : undefined
        }
        const supplierSku = String(get('supplier_sku') ?? '').trim()
        const cost = parseNumber(get('unit_cost'))

        const row: ParsedRow = {
          supplier_sku: supplierSku,
          master_sku: String(get('master_sku') ?? '').trim() || undefined,
          product_sku: String(get('product_sku') ?? '').trim() || undefined,
          product_name: String(get('product_name') ?? '').trim() || undefined,
          unit_cost: cost ?? 0,
          packaging_cost: parseNumber(get('packaging_cost')) ?? 0,
          handling_cost: parseNumber(get('handling_cost')) ?? 0,
          stock: parseNumber(get('stock')) ?? 0,
          lead_time_days: parseNumber(get('lead_time_days')),
          moq: parseNumber(get('moq')) ?? 1,
          _row_num: idx + 2,  // +2 = header row + 1-indexed
        }

        if (!supplierSku) row._error = t('rowError.emptySku')
        else if (cost == null || cost < 0) row._error = t('rowError.invalidCost')
        else if (!row.master_sku && !row.product_sku) row._error = t('rowError.missingMatch')

        return row
      })

      setParsed(rows)
      setStep(2)
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : t('errors.parseFailed'))
    } finally { setParsing(false) }
  }

  async function handleSubmit() {
    if (!parsed || !partner) return
    setSubmitting(true); setSubmitErr(''); setResult(null)
    try {
      const headers = await getHeaders()
      const validRows = parsed.filter(r => !r._error).map(r => ({
        supplier_sku: r.supplier_sku,
        master_sku: r.master_sku ?? null,
        product_sku: r.product_sku ?? null,
        product_name: r.product_name ?? null,
        unit_cost: r.unit_cost,
        packaging_cost: r.packaging_cost ?? 0,
        handling_cost: r.handling_cost ?? 0,
        stock: r.stock ?? 0,
        lead_time_days: r.lead_time_days ?? null,
        moq: r.moq ?? 1,
      }))
      const res = await fetch(`${BACKEND}/dropship/partner-products/bulk-import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          supplier_id: partner.supplier_id,
          source_file_name: file?.name ?? null,
          rows: validRows,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
      setStep(3)
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : t('errors.importFailed'))
    } finally { setSubmitting(false) }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['supplier_sku', 'master_sku', 'product_sku', 'product_name', 'unit_cost', 'packaging_cost', 'handling_cost', 'stock', 'lead_time_days', 'moq'],
      ['ABC-001', 'GTIN-12345', 'SKU-001', t('templateExampleProduct'), 50.00, 1.50, 0.80, 100, 1, 1],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, t('templateSheetName'))
    XLSX.writeFile(wb, 'modelo-catalogo-dropship.xlsx')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/dropship/partners/${profileId}/products`} className="text-zinc-500 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {partner?.suppliers?.name ?? t('loading')} · {t('subtitle')}
          </p>
        </div>
      </div>

      {/* progress steps */}
      <div className="flex items-center gap-2 mb-8 max-w-md">
        <StepDot num={1} label={t('step.upload')} active={step === 1} done={step > 1} />
        <div className="flex-1 h-0.5" style={{ background: step > 1 ? '#00E5FF' : '#27272a' }} />
        <StepDot num={2} label={t('step.preview')} active={step === 2} done={step > 2} />
        <div className="flex-1 h-0.5" style={{ background: step > 2 ? '#00E5FF' : '#27272a' }} />
        <StepDot num={3} label={t('step.result')} active={step === 3} done={false} />
      </div>

      {/* STEP 1 — UPLOAD */}
      {step === 1 && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl p-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-sm text-zinc-300 mb-3">
              {t.rich('howItWorks', {
                strong: (chunks) => <strong className="text-white">{chunks}</strong>,
                code: (chunks) => <code className="text-cyan-400">{chunks}</code>,
              })}
            </p>
            <p className="text-xs text-zinc-500 mb-4">
              {t('acceptedColumns')}
              <br />{t.rich('requiredColumns', { strong: (chunks) => <strong>{chunks}</strong> })}
              <br />{t.rich('optionalColumns', { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>

            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
            >
              <Download size={12} />
              {t('downloadTemplate')}
            </button>
          </div>

          {/* dropzone */}
          <label
            className="rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors"
            style={{
              background: '#0f0f12',
              border: '2px dashed #27272a',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              className="hidden"
              disabled={parsing}
            />
            {parsing ? (
              <>
                <Loader2 size={32} className="animate-spin" style={{ color: '#00E5FF' }} />
                <p className="text-sm text-zinc-300">{t('processingFile')}</p>
              </>
            ) : (
              <>
                <Upload size={32} className="text-zinc-500" />
                <p className="text-sm text-zinc-300">{t('clickToSelect')}</p>
                <p className="text-xs text-zinc-500">{t('fileHint')}</p>
              </>
            )}
          </label>

          {parseErr && (
            <div className="rounded-lg p-3 text-sm" style={{
              background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <AlertCircle size={14} className="inline mr-2" />
              {parseErr}
              {missingHeaders.length > 0 && (
                <p className="text-xs mt-2 text-zinc-400">
                  {t('renameColumnsHint')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — PREVIEW */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          {/* summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label={t('kpi.total')} value={parsed.length} />
            <Kpi label={t('kpi.valid')} value={parsed.filter(r => !r._error).length} accent="#22c55e" />
            <Kpi label={t('kpi.withError')} value={parsed.filter(r => r._error).length} accent={parsed.some(r => r._error) ? '#f87171' : undefined} />
            <Kpi label={t('kpi.file')} value={file?.name ?? '—'} small />
          </div>

          {parsed.some(r => r._error) && (
            <div className="rounded-lg p-3 text-sm" style={{
              background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
            }}>
              <AlertTriangle size={14} className="inline mr-2" />
              {t('errorRowsSkipped')}
            </div>
          )}

          {/* table preview (first 30 rows) */}
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
                  {['#', 'supplier_sku', 'master_sku', 'product_sku', 'unit_cost', 'pack', 'hand', 'stock', 'lead', 'moq', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 30).map((r) => (
                  <tr key={r._row_num} style={{
                    borderBottom: '1px solid #1a1a1f',
                    background: r._error ? 'rgba(239,68,68,0.05)' : 'transparent',
                  }}>
                    <td className="px-3 py-1.5 text-zinc-500">{r._row_num}</td>
                    <td className="px-3 py-1.5 text-zinc-300 font-mono">{r.supplier_sku}</td>
                    <td className="px-3 py-1.5 text-zinc-400 font-mono">{r.master_sku ?? '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-400 font-mono">{r.product_sku ?? '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{fmtBrl(r.unit_cost)}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{r.packaging_cost ? fmtBrl(r.packaging_cost) : '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{r.handling_cost ? fmtBrl(r.handling_cost) : '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{r.stock ?? 0}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{r.lead_time_days ?? '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{r.moq ?? 1}</td>
                    <td className="px-3 py-1.5">
                      {r._error ? (
                        <span className="text-xs" style={{ color: '#f87171' }} title={r._error}>
                          ⚠ {r._error}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 30 && (
              <p className="px-3 py-2 text-xs text-zinc-500" style={{ background: '#0d0d10' }}>
                {t('moreRows', { count: parsed.length - 30 })}
              </p>
            )}
          </div>

          {submitErr && (
            <div className="rounded-lg p-3 text-sm" style={{
              background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <AlertCircle size={14} className="inline mr-2" />
              {submitErr}
            </div>
          )}

          {/* actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { setStep(1); setParsed(null); setFile(null); setParseErr('') }}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white"
              style={{ border: '1px solid #27272a' }}
            >
              <ArrowLeft size={14} className="inline mr-1" />
              {t('changeFile')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || parsed.filter(r => !r._error).length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg"
              style={{ background: '#00E5FF', color: '#09090b', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {submitting ? t('importing') : t('importRows', { count: parsed.filter(r => !r._error).length })}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — RESULT */}
      {step === 3 && result && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl p-6 flex items-center gap-4" style={{
            background: result.failed === 0 ? 'rgba(34,197,94,0.05)' : 'rgba(252,211,77,0.05)',
            border: result.failed === 0 ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(252,211,77,0.2)',
          }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
              background: result.failed === 0 ? 'rgba(34,197,94,0.10)' : 'rgba(252,211,77,0.10)',
            }}>
              {result.failed === 0
                ? <CheckCircle2 size={24} style={{ color: '#22c55e' }} />
                : <AlertTriangle size={24} style={{ color: '#fcd34d' }} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {result.failed === 0 ? t('result.completed') : t('result.partial')}
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                {t('result.synced', { count: result.created + result.updated })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label={t('kpi.processed')} value={result.processed} />
            <Kpi label={t('kpi.created')} value={result.created} accent="#22c55e" />
            <Kpi label={t('kpi.updated')} value={result.updated} accent="#fcd34d" />
            <Kpi label={t('kpi.failures')} value={result.failed} accent={result.failed > 0 ? '#f87171' : undefined} />
          </div>

          {result.cost_changes > 0 && (
            <div className="rounded-lg p-3 text-sm" style={{
              background: 'rgba(0,229,255,0.05)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)',
            }}>
              {t('costChanges', { count: result.cost_changes })}
            </div>
          )}

          {result.validation_errors.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
              <p className="px-4 py-2 text-xs font-medium text-zinc-400" style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
                {t('errorsHeading', { count: result.validation_errors.length })}
              </p>
              <table className="w-full text-xs">
                <tbody>
                  {result.validation_errors.slice(0, 50).map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1a1a1f' }}>
                      <td className="px-3 py-1.5 text-zinc-500 w-12">L{e.row}</td>
                      <td className="px-3 py-1.5 text-zinc-300 font-mono">{e.supplier_sku}</td>
                      <td className="px-3 py-1.5" style={{ color: '#f87171' }}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.validation_errors.length > 50 && (
                <p className="px-3 py-2 text-xs text-zinc-500" style={{ background: '#0d0d10' }}>
                  {t('moreErrors', { count: result.validation_errors.length - 50 })}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => router.push(`/dashboard/dropship/partners/${profileId}/products`)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ background: '#00E5FF', color: '#09090b' }}
            >
              {t('viewCatalog')}
              <ChevronRight size={14} className="inline ml-1" />
            </button>
            <Link
              href={`/dashboard/dropship/sync-logs?supplier_id=${partner?.supplier_id ?? ''}`}
              className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white"
              style={{ border: '1px solid #27272a' }}
            >
              <FileSpreadsheet size={14} className="inline mr-1" />
              {t('viewLog')}
            </Link>
            <button
              onClick={() => { setStep(1); setParsed(null); setFile(null); setResult(null) }}
              className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white"
              style={{ border: '1px solid #27272a' }}
            >
              {t('importAnother')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function StepDot({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{
        background: done ? '#00E5FF' : active ? 'rgba(0,229,255,0.10)' : '#1a1a1f',
        color: done ? '#09090b' : active ? '#00E5FF' : '#71717a',
        border: active ? '1px solid #00E5FF' : '1px solid #27272a',
      }}>
        {done ? '✓' : num}
      </div>
      <span className="text-xs font-medium" style={{ color: active ? '#fff' : done ? '#a1a1aa' : '#52525b' }}>
        {label}
      </span>
    </div>
  )
}

function Kpi({ label, value, accent, small }: { label: string; value: string | number; accent?: string; small?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={small ? 'text-sm font-medium truncate' : 'text-2xl font-semibold'} style={{ color: accent ?? '#fff' }}>
        {value}
      </p>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function findHeader(headers: string[], aliases: string[]): string | null {
  const norm = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[%()_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const normalizedHeaders = headers.map(h => ({ raw: h, norm: norm(h) }))
  for (const a of aliases) {
    const target = norm(a)
    for (const h of normalizedHeaders) {
      if (h.norm === target) return h.raw
    }
  }
  // fuzzy partial match
  for (const a of aliases) {
    const target = norm(a)
    for (const h of normalizedHeaders) {
      if (h.norm.includes(target) || target.includes(h.norm)) return h.raw
    }
  }
  return null
}

function parseNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const cleaned = v
      .replace(/r\$\s*/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')   // separador milhares
      .replace(',', '.')    // decimal
      .replace(/[^\d.\-]/g, '')
    const n = parseFloat(cleaned)
    return isFinite(n) ? n : undefined
  }
  return undefined
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
