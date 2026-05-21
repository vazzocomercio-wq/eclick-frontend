'use client'

/**
 * BannerGeneratorModal — wizard de 4 steps pra gerar banners por IA
 * usando produtos da loja como contexto.
 *
 * Fluxo:
 *   1. Picker de produtos (busca + grid + multi-select)
 *   2. Galeria de estilos (10 estilos catalogados)
 *   3. Ajustes opcionais (textarea pra customAdditions + preview prompt)
 *   4. Geração + preview (escolhe variação, "Usar este banner")
 *
 * onPick(url) é chamado quando o lojista escolhe um banner — modal fecha.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { X, Loader2, Search, Sparkles, ArrowLeft, ArrowRight, Check, AlertCircle, RotateCcw, Monitor, Smartphone, Square } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Step = 1 | 2 | 3 | 4

type BannerFormat = 'wide' | 'story' | 'square'

interface Product {
  id:                string
  name:              string
  category:          string | null
  brand:             string | null
  price:             number
  sale_price:        number | null
  photo_url:         string | null
  short_description: string | null
}

interface Style {
  key:            string
  label:          string
  description:    string
  category:       string
  defaultFormat:  BannerFormat
  productRange:   { min: number; max: number }
}

interface Props {
  onClose: () => void
  onPick:  (url: string) => void
}

export function BannerGeneratorModal({ onClose, onPick }: Props) {
  const [step,     setStep]     = useState<Step>(1)
  const [error,    setError]    = useState<string | null>(null)

  // Step 1 — produtos
  const [products,        setProducts]        = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [query,           setQuery]           = useState('')
  const [selectedIds,     setSelectedIds]     = useState<string[]>([])

  // Step 2 — estilos
  const [styles,        setStyles]        = useState<Style[]>([])
  const [stylesLoading, setStylesLoading] = useState(true)
  const [styleKey,      setStyleKey]      = useState<string>('')

  // Step 3 — customizações
  const [customAdditions, setCustomAdditions] = useState('')
  const [formats,         setFormats]         = useState<BannerFormat[]>(['wide'])
  const [variations,      setVariations]      = useState(2)

  // Step 4 — geração
  const [generating,    setGenerating]    = useState(false)
  const [generatedImgs, setGeneratedImgs] = useState<Array<{ url: string; format: BannerFormat }>>([])
  const [chosenUrl,     setChosenUrl]     = useState<string | null>(null)
  const [promptUsed,    setPromptUsed]    = useState<string>('')

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  // ── Carrega produtos + estilos no mount ─────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const token = await fetchToken()
        const [psRes, stRes] = await Promise.all([
          fetch(`${BACKEND}/banner-generator/products?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND}/banner-generator/styles`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (psRes.ok) {
          const { products: ps } = await psRes.json()
          setProducts(ps)
        }
        if (stRes.ok) {
          const { styles: ss } = await stRes.json()
          setStyles(ss)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar.')
      } finally {
        setProductsLoading(false)
        setStylesLoading(false)
      }
    })()
  }, [fetchToken])

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category?.toLowerCase().includes(q) ?? false) ||
      (p.brand?.toLowerCase().includes(q) ?? false),
    )
  }, [products, query])

  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.includes(p.id)),
    [products, selectedIds],
  )

  const selectedStyle = useMemo(
    () => styles.find(s => s.key === styleKey),
    [styles, styleKey],
  )

  // ── Auto-ajustes quando estilo muda ──────────────────────────
  useEffect(() => {
    if (selectedStyle) {
      setFormats([selectedStyle.defaultFormat])
      // Se selecionou produtos demais pro estilo, trunca
      if (selectedIds.length > selectedStyle.productRange.max) {
        setSelectedIds(prev => prev.slice(0, selectedStyle.productRange.max))
      }
    }
  }, [selectedStyle, selectedIds.length])

  const stylesByCategory = useMemo(() => {
    const map = new Map<string, Style[]>()
    for (const s of styles) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return map
  }, [styles])

  // ── Validações de step ───────────────────────────────────────
  const canGoToStep2 = selectedIds.length > 0
  const canGoToStep3 = !!selectedStyle
    && selectedIds.length >= selectedStyle.productRange.min
    && selectedIds.length <= selectedStyle.productRange.max
  const canGenerate  = canGoToStep3 && !generating

  // ── Gera banner ──────────────────────────────────────────────
  const generate = async () => {
    if (!canGenerate) return
    setGenerating(true); setError(null); setGeneratedImgs([])
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/banner-generator/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          productIds:      selectedIds,
          styleKey,
          customAdditions: customAdditions.trim() || undefined,
          formats,
          variations,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setGeneratedImgs(data.images as Array<{ url: string; format: BannerFormat }>)
      setPromptUsed(data.promptUsed)
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar.')
    } finally {
      setGenerating(false)
    }
  }

  const usePick = () => {
    if (chosenUrl) {
      onPick(chosenUrl)
    }
  }

  return (
    <div
      onClick={() => !generating && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12,
          width: '100%', maxWidth: 880, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Gerar banner com IA</h2>
            <span style={{ fontSize: 11, color: '#52525b', marginLeft: 8 }}>Passo {step}/4</span>
          </div>
          <button onClick={onClose} disabled={generating}
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: generating ? 'wait' : 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>

        {/* Steps progress */}
        <div className="flex" style={{ borderBottom: '1px solid #27272a' }}>
          {([1, 2, 3, 4] as Step[]).map(n => (
            <div key={n} style={{
              flex: 1, padding: '8px 12px', fontSize: 11, textAlign: 'center',
              background: step === n ? 'rgba(0,229,255,0.05)' : 'transparent',
              color: step >= n ? '#00E5FF' : '#52525b',
              borderBottom: step === n ? '2px solid #00E5FF' : '2px solid transparent',
            }}>
              {n === 1 && '1. Produtos'}
              {n === 2 && '2. Estilo'}
              {n === 3 && '3. Ajustes'}
              {n === 4 && '4. Resultado'}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3 text-xs flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 && (
            <StepProducts
              products={filteredProducts}
              loading={productsLoading}
              query={query}
              onQuery={setQuery}
              selectedIds={selectedIds}
              onToggle={id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            />
          )}
          {step === 2 && (
            <StepStyle
              stylesByCategory={stylesByCategory}
              loading={stylesLoading}
              selected={styleKey}
              onPick={setStyleKey}
              productCount={selectedIds.length}
            />
          )}
          {step === 3 && selectedStyle && (
            <StepAdjust
              style={selectedStyle}
              formats={formats}
              onFormats={setFormats}
              variations={variations}
              onVariations={setVariations}
              customAdditions={customAdditions}
              onCustomAdditions={setCustomAdditions}
              selectedProducts={selectedProducts}
            />
          )}
          {step === 4 && (
            <StepResult
              generating={generating}
              images={generatedImgs}
              chosen={chosenUrl}
              onChoose={setChosenUrl}
              promptUsed={promptUsed}
              onRegenerate={generate}
            />
          )}
        </div>

        {/* Footer — navegação */}
        <div className="flex items-center justify-between gap-3 p-4 border-t" style={{ borderColor: '#27272a' }}>
          <button
            onClick={() => {
              if (step === 1) onClose()
              else setStep((step - 1) as Step)
            }}
            disabled={generating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', minHeight: 44,
              background: 'transparent', color: '#a1a1aa',
              border: '1px solid #27272a', borderRadius: 6,
              cursor: generating ? 'wait' : 'pointer', fontSize: 13,
            }}>
            <ArrowLeft size={14} /> {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!canGoToStep2}
              style={primaryBtnStyle(canGoToStep2)}>
              Próximo <ArrowRight size={14} />
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} disabled={!canGoToStep3}
              style={primaryBtnStyle(canGoToStep3)}>
              Próximo <ArrowRight size={14} />
            </button>
          )}
          {step === 3 && (
            <button onClick={() => { setStep(4); void generate() }} disabled={!canGenerate}
              style={primaryBtnStyle(canGenerate)}>
              <Sparkles size={14} /> Gerar
            </button>
          )}
          {step === 4 && (
            <button onClick={usePick} disabled={!chosenUrl || generating}
              style={primaryBtnStyle(!!chosenUrl && !generating)}>
              <Check size={14} /> Usar este banner
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function primaryBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', minHeight: 44,
    background: enabled ? 'linear-gradient(135deg, #00E5FF, #6366f1)' : '#1e1e24',
    color: enabled ? '#0a0a0e' : '#52525b',
    border: 'none', borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13, fontWeight: 600,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Step 1 — Picker de produtos
// ─────────────────────────────────────────────────────────────────────────

function StepProducts({ products, loading, query, onQuery, selectedIds, onToggle }: {
  products: Product[]; loading: boolean
  query: string; onQuery: (q: string) => void
  selectedIds: string[]; onToggle: (id: string) => void
}) {
  if (loading) {
    return <div className="flex items-center gap-2 text-sm justify-center py-10" style={{ color: '#a1a1aa' }}>
      <Loader2 size={14} className="animate-spin" /> Carregando produtos…
    </div>
  }
  if (products.length === 0) {
    return <div className="text-center py-10 text-sm" style={{ color: '#a1a1aa' }}>
      Nenhum produto visível na sua loja.<br />
      Vá em <strong style={{ color: '#fafafa' }}>Catálogo → Produtos</strong> e marque alguns como "Enviar para a loja".
    </div>
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-3" style={{
        background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 6, padding: '8px 12px',
      }}>
        <Search size={14} style={{ color: '#52525b' }} />
        <input value={query} onChange={e => onQuery(e.target.value)}
          placeholder="Buscar produto…"
          style={{ flex: 1, background: 'transparent', border: 'none', color: '#fafafa', fontSize: 13, outline: 'none', minHeight: 28 }} />
      </div>
      <div className="text-xs mb-2" style={{ color: '#a1a1aa' }}>
        {selectedIds.length} selecionado(s) de {products.length} produto(s)
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {products.map(p => {
          const selected = selectedIds.includes(p.id)
          return (
            <button key={p.id} onClick={() => onToggle(p.id)}
              style={{
                padding: 8, textAlign: 'left',
                background: selected ? 'rgba(0,229,255,0.05)' : '#0a0a0e',
                border: `1px solid ${selected ? '#00E5FF' : '#27272a'}`,
                borderRadius: 6, cursor: 'pointer',
              }}>
              {p.photo_url
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={p.photo_url} alt={p.name} loading="lazy"
                    style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '1/1', background: '#1e1e24', borderRadius: 4 }} />}
              <div style={{ marginTop: 6, fontSize: 12, color: '#fafafa', lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#00E5FF', fontWeight: 600 }}>
                {(p.sale_price ?? p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              {selected && <div style={{ marginTop: 4, fontSize: 10, color: '#00E5FF' }}>✓ Selecionado</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2 — Estilo
// ─────────────────────────────────────────────────────────────────────────

function StepStyle({ stylesByCategory, loading, selected, onPick, productCount }: {
  stylesByCategory: Map<string, Style[]>; loading: boolean
  selected: string; onPick: (k: string) => void; productCount: number
}) {
  if (loading) {
    return <div className="flex items-center gap-2 text-sm justify-center py-10" style={{ color: '#a1a1aa' }}>
      <Loader2 size={14} className="animate-spin" /> Carregando estilos…
    </div>
  }
  return (
    <div className="space-y-5">
      {Array.from(stylesByCategory.entries()).map(([cat, items]) => (
        <div key={cat}>
          <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#a1a1aa' }}>{cat}</h4>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {items.map(s => {
              const isSelected = selected === s.key
              const fits = productCount >= s.productRange.min && productCount <= s.productRange.max
              return (
                <button key={s.key} onClick={() => onPick(s.key)} disabled={!fits}
                  style={{
                    padding: 12, textAlign: 'left',
                    background: isSelected ? 'rgba(0,229,255,0.05)' : '#0a0a0e',
                    border: `1px solid ${isSelected ? '#00E5FF' : '#27272a'}`,
                    borderRadius: 6, cursor: fits ? 'pointer' : 'not-allowed',
                    opacity: fits ? 1 : 0.4, minHeight: 88,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, lineHeight: 1.4 }}>{s.description}</div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 6 }}>
                    {s.productRange.min === s.productRange.max
                      ? `${s.productRange.min} produto`
                      : `${s.productRange.min}–${s.productRange.max} produtos`}
                    {' · '}{s.defaultFormat}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3 — Ajustes
// ─────────────────────────────────────────────────────────────────────────

function StepAdjust({ style, formats, onFormats, variations, onVariations, customAdditions, onCustomAdditions, selectedProducts }: {
  style: Style
  formats: BannerFormat[]; onFormats: (f: BannerFormat[]) => void
  variations: number; onVariations: (n: number) => void
  customAdditions: string; onCustomAdditions: (s: string) => void
  selectedProducts: Product[]
}) {
  const toggleFormat = (f: BannerFormat) => {
    if (formats.includes(f)) {
      // Não deixa zerar — sempre 1 mínimo
      if (formats.length > 1) onFormats(formats.filter(x => x !== f))
    } else {
      onFormats([...formats, f])
    }
  }
  const FORMAT_OPTS: Array<{ key: BannerFormat; label: string; sub: string; icon: React.ReactNode }> = [
    { key: 'wide',   label: 'Desktop',  sub: 'Wide 16:9',     icon: <Monitor size={20} /> },
    { key: 'square', label: 'Mobile',   sub: 'Quadrado 1:1',  icon: <Square size={20} /> },
    { key: 'story',  label: 'Vertical', sub: 'Story 9:16',    icon: <Smartphone size={20} /> },
  ]
  return (
    <div className="space-y-4">
      <div className="p-3 rounded text-xs" style={{ background: 'rgba(0,229,255,0.05)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}>
        ⚡ <strong>Estilo:</strong> {style.label}. {selectedProducts.length} produto(s) selecionado(s):{' '}
        {selectedProducts.map(p => p.name).join(', ')}
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>
          Formatos {formats.length > 1 ? `(${formats.length} selecionados — vai gerar pra cada um)` : ''}
        </label>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {FORMAT_OPTS.map(opt => {
            const active = formats.includes(opt.key)
            return (
              <button key={opt.key} onClick={() => toggleFormat(opt.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '14px 8px', minHeight: 96,
                  background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                  border: `1px solid ${active ? '#00E5FF' : '#27272a'}`,
                  color: active ? '#00E5FF' : '#a1a1aa',
                  borderRadius: 6, cursor: 'pointer',
                }}>
                {opt.icon}
                <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: active ? '#a5f3fc' : '#52525b' }}>{opt.sub}</div>
                {active && <Check size={12} style={{ color: '#00E5FF' }} />}
              </button>
            )
          })}
        </div>
        <div className="text-[11px] mt-2" style={{ color: '#52525b' }}>
          ⚡ Marque <strong>Desktop + Mobile</strong> pra gerar as 2 versões em paralelo (responsivo). Cada formato gera {variations} variação(ões).
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>Quantidade de variações</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => onVariations(n)}
              style={{
                flex: 1, padding: '10px 12px', minHeight: 44,
                background: variations === n ? 'rgba(0,229,255,0.05)' : 'transparent',
                border: `1px solid ${variations === n ? '#00E5FF' : '#27272a'}`,
                color: variations === n ? '#00E5FF' : '#a1a1aa',
                borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}>
              {n}
            </button>
          ))}
        </div>
        <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>
          Mais variações = mais opções pra escolher, mas custo de IA proporcional.
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: '#a1a1aa' }}>Instruções extras (opcional)</label>
        <textarea
          value={customAdditions} onChange={e => onCustomAdditions(e.target.value)}
          placeholder="Ex: use tons mais frios; foco maior no produto; sem texto sobre a imagem"
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', minHeight: 72,
            background: '#0a0a0e', color: '#fafafa',
            border: '1px solid #27272a', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div className="text-[11px] mt-1" style={{ color: '#52525b' }}>
          Suas instruções serão adicionadas ao prompt padrão do estilo escolhido.
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Step 4 — Resultado
// ─────────────────────────────────────────────────────────────────────────

function StepResult({ generating, images, chosen, onChoose, promptUsed, onRegenerate }: {
  generating: boolean; images: Array<{ url: string; format: BannerFormat }>
  chosen: string | null; onChoose: (url: string) => void
  promptUsed: string
  onRegenerate: () => void
}) {
  if (generating) {
    return (
      <div className="flex flex-col items-center gap-3 py-12" style={{ color: '#a1a1aa' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#00E5FF' }} />
        <div style={{ fontSize: 14, color: '#fafafa' }}>Gerando seus banners…</div>
        <div style={{ fontSize: 12 }}>Cada formato leva de 10 a 30 segundos.</div>
      </div>
    )
  }
  if (images.length === 0) {
    return <div className="text-center py-10 text-sm" style={{ color: '#a1a1aa' }}>
      Nenhuma imagem gerada ainda.
    </div>
  }

  // Agrupa por formato
  const byFormat = new Map<BannerFormat, Array<{ url: string; format: BannerFormat }>>()
  for (const img of images) {
    if (!byFormat.has(img.format)) byFormat.set(img.format, [])
    byFormat.get(img.format)!.push(img)
  }

  const formatMeta: Record<BannerFormat, { label: string; icon: React.ReactNode }> = {
    wide:   { label: 'Desktop · Wide 16:9',     icon: <Monitor size={14} /> },
    square: { label: 'Mobile · Quadrado 1:1',   icon: <Square size={14} /> },
    story:  { label: 'Vertical · Story 9:16',   icon: <Smartphone size={14} /> },
  }

  return (
    <div className="space-y-5">
      <div className="text-xs" style={{ color: '#a1a1aa' }}>
        Clique pra escolher a variação que você quer usar:
      </div>

      {Array.from(byFormat.entries()).map(([fmt, imgs]) => (
        <div key={fmt}>
          <div className="flex items-center gap-2 mb-2" style={{ color: '#00E5FF', fontSize: 12, fontWeight: 600 }}>
            {formatMeta[fmt].icon} {formatMeta[fmt].label}
            <span style={{ color: '#52525b', fontWeight: 400, marginLeft: 4 }}>· {imgs.length} variação(ões)</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {imgs.map((img, i) => {
              const isChosen = chosen === img.url
              return (
                <button key={i} onClick={() => onChoose(img.url)}
                  style={{
                    padding: 4,
                    background: isChosen ? 'rgba(0,229,255,0.1)' : 'transparent',
                    border: `2px solid ${isChosen ? '#00E5FF' : '#27272a'}`,
                    borderRadius: 8, cursor: 'pointer',
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`${fmt} ${i + 1}`} loading="lazy"
                    style={{ width: '100%', display: 'block', borderRadius: 4 }} />
                  {isChosen && (
                    <div className="mt-1 flex items-center justify-center gap-1 text-xs" style={{ color: '#00E5FF', fontWeight: 600 }}>
                      <Check size={12} /> Escolhida
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #27272a' }}>
        <button onClick={onRegenerate}
          className="flex items-center gap-1 text-xs"
          style={{ background: 'transparent', border: 'none', color: '#00E5FF', cursor: 'pointer', minHeight: 36 }}>
          <RotateCcw size={12} /> Gerar novamente (mesmas configurações)
        </button>
      </div>
      <details>
        <summary style={{ fontSize: 11, color: '#52525b', cursor: 'pointer' }}>Ver prompt usado</summary>
        <pre style={{ marginTop: 6, fontSize: 10, color: '#a1a1aa', background: '#0a0a0e', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {promptUsed}
        </pre>
      </details>
    </div>
  )
}
