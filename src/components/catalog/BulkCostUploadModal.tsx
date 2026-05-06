'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import {
  Upload, X, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Download, Info,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ParsedRow {
  sku:             string
  cost_price?:     number
  tax_percentage?: number
  tax_on_freight?: boolean
  // pra UI
  _row_num: number
  _error?:  string
}

interface BulkResult {
  updated:         number
  not_found:       number
  errors:          number
  not_found_skus:  string[]
  error_details:   Array<{ sku: string; reason: string }>
}

/** Modal pra upload de planilha XLSX/CSV com colunas:
 *  - SKU                — ID do produto no catálogo
 *  - PREÇO (CMV)        — custo unitário (cost_price)
 *  - IMPOSTO (%)        — % de imposto (tax_percentage, 0-100)
 *
 *  Aceita variações de header (case-insensitive, com/sem acento).
 *  Faz match por SKU exato (case-insensitive). Rows sem match aparecem
 *  na lista "não encontrados" no resultado. */
export default function BulkCostUploadModal({
  onClose, onSaved,
}: {
  onClose:  () => void
  onSaved?: () => void
}) {
  const [file, setFile]       = useState<File | null>(null)
  const [parsed, setParsed]   = useState<ParsedRow[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseErr, setParseErr] = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)
  const [result, setResult]   = useState<BulkResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Parse helpers ──────────────────────────────────────────────────────

  /** Identifica a coluna olhando vários aliases (case-insensitive). */
  const findHeader = (headers: string[], aliases: string[]): string | null => {
    const norm = (s: string) => s
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[%()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    for (const a of aliases) {
      const targetNorm = norm(a)
      for (const h of headers) {
        if (norm(h) === targetNorm) return h
        if (norm(h).includes(targetNorm)) return h
      }
    }
    return null
  }

  /** Converte string com formato BR (R$, vírgula decimal) ou número direto. */
  const parseNumber = (v: unknown): number | undefined => {
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

  async function handleFile(f: File) {
    setFile(f)
    setParsing(true); setParseErr(null); setParsed(null); setResult(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error('Arquivo sem planilha válida')
      const sheet = wb.Sheets[sheetName]
      // Lê como matriz de objetos usando 1ª linha como header
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (json.length === 0) throw new Error('Planilha vazia (precisa de header + ≥1 linha)')

      const headers = Object.keys(json[0])
      const skuHeader  = findHeader(headers, ['sku', 'codigo', 'código'])
      const costHeader = findHeader(headers, ['preco cmv', 'preço cmv', 'cmv', 'custo', 'cost', 'cost_price', 'preco custo', 'preço custo'])
      const taxHeader  = findHeader(headers, ['imposto', 'tax', 'tax_percentage', 'imposto pct', 'imposto %'])

      if (!skuHeader) {
        throw new Error(`Coluna SKU não encontrada. Headers detectados: ${headers.join(', ')}`)
      }
      if (!costHeader && !taxHeader) {
        throw new Error('Pelo menos 1 coluna obrigatória: PREÇO (CMV) ou IMPOSTO (%)')
      }

      const rows: ParsedRow[] = []
      json.forEach((row, i) => {
        const sku = String(row[skuHeader] ?? '').trim()
        if (!sku) {
          rows.push({ sku: '', _row_num: i + 2, _error: 'SKU vazio' })
          return
        }
        const cost = costHeader ? parseNumber(row[costHeader]) : undefined
        const tax  = taxHeader  ? parseNumber(row[taxHeader])  : undefined

        const parsedRow: ParsedRow = { sku, _row_num: i + 2 }
        if (cost !== undefined) {
          if (cost < 0) {
            parsedRow._error = `CMV inválido: ${cost}`
          } else {
            parsedRow.cost_price = cost
          }
        }
        if (tax !== undefined) {
          if (tax < 0 || tax > 100) {
            parsedRow._error = (parsedRow._error ? `${parsedRow._error}; ` : '') + `Imposto inválido (0-100): ${tax}`
          } else {
            parsedRow.tax_percentage = tax
          }
        }
        rows.push(parsedRow)
      })

      setParsed(rows)
    } catch (e) {
      setParseErr((e as Error).message)
      setParsed(null)
    } finally {
      setParsing(false)
    }
  }

  async function applyUpdates() {
    if (!parsed) return
    const validRows = parsed.filter(r => r.sku && !r._error)
    if (validRows.length === 0) {
      setError('Nenhuma linha válida pra aplicar')
      return
    }
    setBusy(true); setError(null); setResult(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) throw new Error('Não autenticado')

      const res = await fetch(`${BACKEND}/products/bulk-update-costs`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:    `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rows: validRows.map(r => ({
            sku:            r.sku,
            cost_price:     r.cost_price,
            tax_percentage: r.tax_percentage,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`)
      setResult(data as BulkResult)
      if (onSaved) onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['SKU', 'PREÇO (CMV)', 'IMPOSTO (%)'],
      ['ABC-123', 35.50, 7.0],
      ['XYZ-789', 12.90, 7.0],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Atualização de Custo')
    XLSX.writeFile(wb, 'template-bulk-cost-update.xlsx')
  }

  // ── UI ────────────────────────────────────────────────────────────────

  const validCount = parsed?.filter(r => r.sku && !r._error).length ?? 0
  const errorCount = parsed?.filter(r => r._error || !r.sku).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-zinc-100 text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-cyan-400" />
              Atualizar Custos em Massa
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Suba uma planilha pra atualizar CMV e Imposto de vários produtos do catálogo (matched por SKU).
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Instruções + template */}
          {!result && (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-zinc-300 space-y-1.5">
                  <p>Formato esperado (XLSX, XLS ou CSV):</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-zinc-400">
                    <li><strong>SKU</strong> — código do produto (obrigatório)</li>
                    <li><strong>PREÇO (CMV)</strong> — custo unitário em R$ (opcional)</li>
                    <li><strong>IMPOSTO (%)</strong> — percentual 0-100 (opcional)</li>
                  </ul>
                  <p className="text-zinc-500">
                    Aceita vírgula decimal e R$ no formato BR. Match de SKU é case-insensitive.
                    Apenas produtos do catálogo são afetados (não anúncios).
                  </p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                <Download size={11} /> Baixar planilha modelo
              </button>
            </div>
          )}

          {/* Dropzone / file picker */}
          {!parsed && !result && (
            <label
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              onDragOver={e => e.preventDefault()}
              className="block rounded-lg border-2 border-dashed border-zinc-700 hover:border-cyan-400/60 bg-zinc-900/40 p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
              {parsing ? (
                <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> processando…
                </div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-zinc-500" />
                  <p className="text-sm text-zinc-300 mt-2">Arraste a planilha ou clique pra selecionar</p>
                  <p className="text-[10px] text-zinc-500 mt-1">XLSX, XLS, CSV (max 1000 linhas)</p>
                </>
              )}
            </label>
          )}

          {parseErr && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao ler planilha</p>
                <p className="text-[11px] text-red-300/80 mt-1">{parseErr}</p>
              </div>
            </div>
          )}

          {/* Preview parsed */}
          {parsed && !result && (
            <>
              <div className="flex items-center justify-between text-xs">
                <p className="text-zinc-300">
                  <strong className="text-zinc-100">{file?.name}</strong> — {parsed.length} linhas
                </p>
                <div className="flex gap-2">
                  <span className="text-emerald-300">✓ {validCount} válidas</span>
                  {errorCount > 0 && <span className="text-red-300">⚠ {errorCount} inválidas</span>}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-zinc-900 text-zinc-500 text-[10px] uppercase">
                    <tr>
                      <th className="text-left px-3 py-1.5">#</th>
                      <th className="text-left px-3 py-1.5">SKU</th>
                      <th className="text-right px-3 py-1.5">CMV (R$)</th>
                      <th className="text-right px-3 py-1.5">Imposto (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {parsed.slice(0, 100).map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-400/[0.05]' : 'hover:bg-zinc-900/60'}>
                        <td className="px-3 py-1 text-zinc-500 font-mono">{r._row_num}</td>
                        <td className="px-3 py-1 text-zinc-200 font-mono">{r.sku || <em className="text-red-300">(vazio)</em>}</td>
                        <td className="px-3 py-1 text-right text-zinc-300">{r.cost_price?.toFixed(2) ?? '—'}</td>
                        <td className="px-3 py-1 text-right text-zinc-300">{r.tax_percentage?.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                    {parsed.length > 100 && (
                      <tr><td colSpan={4} className="px-3 py-1.5 text-center text-zinc-500 italic">
                        + {parsed.length - 100} linhas (preview limitado)
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-300 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setParsed(null); setFile(null); if (inputRef.current) inputRef.current.value = '' }}
                  disabled={busy}
                  className="px-3 py-1.5 rounded text-xs text-zinc-300 border border-zinc-800 hover:border-zinc-700 disabled:opacity-50"
                >
                  Trocar arquivo
                </button>
                <button
                  onClick={applyUpdates}
                  disabled={busy || validCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-semibold"
                >
                  {busy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {busy ? 'Aplicando…' : `Aplicar em ${validCount} produtos`}
                </button>
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] p-3 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <div className="flex-1">
                  <p className="text-sm text-zinc-100 font-medium">
                    {result.updated} produtos atualizados
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {result.not_found > 0 && `${result.not_found} SKUs não encontrados · `}
                    {result.errors > 0    && `${result.errors} erros`}
                    {result.not_found === 0 && result.errors === 0 && 'Tudo certo!'}
                  </p>
                </div>
              </div>

              {result.not_found_skus.length > 0 && (
                <details className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                  <summary className="text-[11px] text-amber-300 cursor-pointer">
                    SKUs não encontrados ({result.not_found_skus.length}{result.not_found > result.not_found_skus.length ? `+ outros ${result.not_found - result.not_found_skus.length}` : ''})
                  </summary>
                  <p className="mt-2 text-[10px] text-zinc-400 font-mono leading-relaxed">
                    {result.not_found_skus.join(' · ')}
                  </p>
                </details>
              )}

              {result.error_details.length > 0 && (
                <details className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                  <summary className="text-[11px] text-red-300 cursor-pointer">
                    Erros ({result.error_details.length})
                  </summary>
                  <ul className="mt-2 text-[10px] text-zinc-400 space-y-0.5">
                    {result.error_details.map((e, i) => (
                      <li key={i}>
                        <span className="font-mono text-zinc-300">{e.sku}</span>: {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-800">
                <button
                  onClick={() => { setResult(null); setParsed(null); setFile(null); if (inputRef.current) inputRef.current.value = '' }}
                  className="px-3 py-1.5 rounded text-xs text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                >
                  Subir outra
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
