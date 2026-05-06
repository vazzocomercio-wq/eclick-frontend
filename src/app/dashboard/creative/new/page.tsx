'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Sparkles, Check, Loader2, AlertTriangle, Plus, X } from 'lucide-react'
import CreativeProductUpload from '@/components/creative/CreativeProductUpload'
import ProductAnalysisCard from '@/components/creative/ProductAnalysisCard'
import BriefingConfigurator, {
  DEFAULT_BRIEFING,
  briefingFormToApiBody,
  type BriefingFormState,
} from '@/components/creative/BriefingConfigurator'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeProduct } from '@/components/creative/types'

type Step = 1 | 2 | 3
type UploadResult = { storage_path: string; signed_url: string; preview_url: string }

interface BasicForm {
  name:     string
  category: string
  brand:    string
}

interface DetailsForm {
  color:           string
  material:        string
  width:           string
  height:          string
  depth:           string
  weight:          string
  target_audience: string
  differentials:   string[]
  sku:             string
  ean:             string
}

const EMPTY_DETAILS: DetailsForm = {
  color: '', material: '',
  width: '', height: '', depth: '', weight: '',
  target_audience: '',
  differentials:   [],
  sku: '', ean: '',
}

export default function CreativeNewPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Step 1 ──
  const [upload, setUpload]     = useState<UploadResult | null>(null)
  const [basic, setBasic]       = useState<BasicForm>({ name: '', category: '', brand: '' })

  // ── Step 2 ──
  const [product, setProduct]   = useState<CreativeProduct | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [details, setDetails]   = useState<DetailsForm>(EMPTY_DETAILS)
  const [diffInput, setDiffInput] = useState('')

  // ── Step 3 ──
  const [briefing, setBriefing] = useState<BriefingFormState>(DEFAULT_BRIEFING)

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1 → Step 2: cria produto + dispara análise IA em background
  // ──────────────────────────────────────────────────────────────────────────
  async function goStep1to2() {
    setError(null)
    if (!upload) { setError('Faça upload da imagem do produto.'); return }
    if (!basic.name.trim())     { setError('Informe o nome do produto.'); return }
    if (!basic.category.trim()) { setError('Informe a categoria.'); return }

    setSubmitting(true)
    try {
      const created = await CreativeApi.createProduct({
        name:                    basic.name,
        category:                basic.category,
        brand:                   basic.brand || undefined,
        main_image_url:          upload.signed_url,
        main_image_storage_path: upload.storage_path,
      })
      setProduct(created)
      setStep(2)

      // Dispara análise IA em background — UI mostra loader
      setAnalyzing(true)
      setAnalysisError(null)
      try {
        const analyzed = await CreativeApi.analyzeProduct(created.id)
        setProduct(analyzed)
        // Pré-preenche details com o que a IA detectou (apenas se vazio)
        setDetails(prev => ({
          ...prev,
          color:    prev.color    || (analyzed.ai_analysis.detected_color    ?? ''),
          material: prev.material || (analyzed.ai_analysis.detected_material ?? ''),
        }))
      } catch (e: unknown) {
        setAnalysisError((e as Error).message)
      } finally {
        setAnalyzing(false)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2 → Step 3: PATCH com detalhes adicionais
  // ──────────────────────────────────────────────────────────────────────────
  async function goStep2to3() {
    setError(null)
    if (!product) { setError('Erro: produto perdido. Volte ao passo 1.'); return }

    setSubmitting(true)
    try {
      const dimensions: Record<string, string> = {}
      if (details.width)  dimensions.largura      = details.width
      if (details.height) dimensions.altura       = details.height
      if (details.depth)  dimensions.profundidade = details.depth
      if (details.weight) dimensions.peso         = details.weight

      const updated = await CreativeApi.updateProduct(product.id, {
        color:           details.color           || undefined,
        material:        details.material        || undefined,
        target_audience: details.target_audience || undefined,
        differentials:   details.differentials.length > 0 ? details.differentials : undefined,
        dimensions:      Object.keys(dimensions).length > 0 ? dimensions : undefined,
        sku:             details.sku             || undefined,
        ean:             details.ean             || undefined,
      })
      setProduct(updated)
      setStep(3)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3 → Submit: cria briefing + gera listing + redireciona
  // ──────────────────────────────────────────────────────────────────────────
  async function submitFinal() {
    setError(null)
    if (!product) { setError('Erro: produto perdido. Volte ao passo 1.'); return }

    setSubmitting(true)
    try {
      const briefingRow = await CreativeApi.createBriefing(product.id, briefingFormToApiBody(briefing))
      const listing = await CreativeApi.generateListing(product.id, briefingRow.id)
      router.push(`/dashboard/creative/${product.id}/listing/${listing.id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Differentials chips
  // ──────────────────────────────────────────────────────────────────────────
  function addDifferential() {
    const v = diffInput.trim()
    if (!v) return
    if (details.differentials.includes(v)) { setDiffInput(''); return }
    setDetails(d => ({ ...d, differentials: [...d.differentials, v] }))
    setDiffInput('')
  }
  function removeDifferential(idx: number) {
    setDetails(d => ({ ...d, differentials: d.differentials.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/creative" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">Novo produto criativo</h1>
          </div>
        </div>

        {/* Stepper */}
        <Stepper current={step} />

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 — Upload + Dados básicos */}
        {step === 1 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">1. Imagem do produto</h2>
              <CreativeProductUpload value={upload} onChange={setUpload} disabled={submitting} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">2. Dados básicos</h2>
              <div className="space-y-3">
                <Field
                  label="Nome do produto *"
                  value={basic.name}
                  onChange={v => setBasic(b => ({ ...b, name: v }))}
                  placeholder="Ex: Organizador de gaveta com divisórias"
                />
                <Field
                  label="Categoria *"
                  value={basic.category}
                  onChange={v => setBasic(b => ({ ...b, category: v }))}
                  placeholder="Ex: Casa & Cozinha"
                />
                <Field
                  label="Marca"
                  value={basic.brand}
                  onChange={v => setBasic(b => ({ ...b, brand: v }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <PrimaryButton
                onClick={goStep1to2}
                disabled={submitting || !upload || !basic.name.trim() || !basic.category.trim()}
                loading={submitting}
              >
                Próximo <ArrowRight size={14} />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Step 2 — Análise IA + Detalhes */}
        {step === 2 && (
          <div className="mt-6 space-y-6">
            <ProductAnalysisCard
              analysis={product?.ai_analysis ?? null}
              loading={analyzing}
              error={analysisError}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cor"      value={details.color}    onChange={v => setDetails(d => ({ ...d, color: v }))}    placeholder="Ex: Branco fosco" />
              <Field label="Material" value={details.material} onChange={v => setDetails(d => ({ ...d, material: v }))} placeholder="Ex: Plástico ABS" />
              <Field label="Largura"      value={details.width}  onChange={v => setDetails(d => ({ ...d, width: v }))}  placeholder="Ex: 30cm" />
              <Field label="Altura"       value={details.height} onChange={v => setDetails(d => ({ ...d, height: v }))} placeholder="Ex: 15cm" />
              <Field label="Profundidade" value={details.depth}  onChange={v => setDetails(d => ({ ...d, depth: v }))}  placeholder="Ex: 10cm" />
              <Field label="Peso"         value={details.weight} onChange={v => setDetails(d => ({ ...d, weight: v }))} placeholder="Ex: 500g" />
              <Field
                label="Público-alvo"
                value={details.target_audience}
                onChange={v => setDetails(d => ({ ...d, target_audience: v }))}
                placeholder="Ex: Donas de casa, profissionais autônomos"
                className="sm:col-span-2"
              />
              <Field label="SKU" value={details.sku} onChange={v => setDetails(d => ({ ...d, sku: v }))} placeholder="Opcional" />
              <Field label="EAN" value={details.ean} onChange={v => setDetails(d => ({ ...d, ean: v }))} placeholder="Opcional (código de barras)" />
            </div>

            {/* Differentials chips */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Diferenciais comerciais</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {details.differentials.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                    {d}
                    <button type="button" onClick={() => removeDifferential(i)} className="hover:text-cyan-100">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={diffInput}
                  onChange={e => setDiffInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDifferential() } }}
                  placeholder="Ex: Antiderrapante, fácil de limpar…"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={addDifferential}
                  className="px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400 text-cyan-400 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(1)} disabled={submitting}>
                <ArrowLeft size={14} /> Voltar
              </SecondaryButton>
              <PrimaryButton onClick={goStep2to3} disabled={submitting} loading={submitting}>
                Próximo <ArrowRight size={14} />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Step 3 — Briefing */}
        {step === 3 && (
          <div className="mt-6 space-y-6">
            <BriefingConfigurator value={briefing} onChange={setBriefing} />

            <div className="flex justify-between">
              <SecondaryButton onClick={() => setStep(2)} disabled={submitting}>
                <ArrowLeft size={14} /> Voltar
              </SecondaryButton>
              <PrimaryButton onClick={submitFinal} disabled={submitting} loading={submitting}>
                {submitting ? 'Gerando anúncio…' : <>Gerar anúncio <Check size={14} /></>}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  const labels = ['Imagem & dados', 'Análise IA', 'Briefing']
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        const active = current === n
        const done   = current > n
        return (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={[
              'flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold transition-all',
              done   ? 'bg-cyan-400 text-black' :
              active ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(0,229,255,0.4)]' :
                       'bg-zinc-900 text-zinc-500 border border-zinc-800',
            ].join(' ')}>
              {done ? <Check size={12} /> : n}
            </div>
            <span className={[
              'text-xs hidden sm:inline',
              active ? 'text-zinc-100 font-medium' : done ? 'text-zinc-300' : 'text-zinc-500',
            ].join(' ')}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-px ${done ? 'bg-cyan-400' : 'bg-zinc-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, className,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  className?:   string
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
    </div>
  )
}

function PrimaryButton({
  onClick, disabled, loading, children,
}: {
  onClick:   () => void
  disabled?: boolean
  loading?:  boolean
  children:  React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold transition-all"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

function SecondaryButton({
  onClick, disabled, children,
}: {
  onClick:   () => void
  disabled?: boolean
  children:  React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 text-sm transition-colors border border-zinc-800"
    >
      {children}
    </button>
  )
}
