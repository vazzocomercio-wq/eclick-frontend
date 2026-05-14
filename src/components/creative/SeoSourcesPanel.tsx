'use client'

/**
 * SeoSourcesPanel — UI de transparência do e-Otimizer IA.
 *
 * Lê `listing.generation_metadata.seo_sources` (gravado pelo backend MVP 2)
 * e mostra de ONDE vieram as decisões da IA:
 *   - Top 5 anúncios concorrentes analisados
 *   - Tabela de keywords com origem rastreável (X dos top 20)
 *   - Padrão de título da categoria
 *   - Preço mediano de mercado
 *
 * Slide-in lateral via overlay. Não bloqueia o editor.
 */

import { X, Search, Sparkles, TrendingUp, Tag, FileText, AlertCircle } from 'lucide-react'

interface SeoSourcesData {
  category_ml_id:   string
  top_keywords_used: Array<{
    keyword:    string
    frequency:  number
    sources_mlb: string[]
    recommend:  'use' | 'use_if_true' | 'avoid'
  }>
  competitors_analyzed: string[]
  avg_title_length: number
  price_median:     number
}

interface Props {
  open:           boolean
  onClose:        () => void
  generationMetadata: Record<string, unknown> | null
}

export default function SeoSourcesPanel({ open, onClose, generationMetadata }: Props) {
  if (!open) return null

  const seo = (generationMetadata?.seo_sources as SeoSourcesData | null) ?? null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Fontes do e-Otimizer IA</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-6">
          {!seo ? (
            <EmptyState />
          ) : (
            <>
              <Intro categoryMlId={seo.category_ml_id} />

              <Section
                icon={<TrendingUp size={13} />}
                title="Top 5 anúncios concorrentes analisados"
                hint="A IA aprendeu padrões observando estes anúncios reais da categoria."
              >
                <ol className="space-y-1.5">
                  {seo.competitors_analyzed.map((title, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-zinc-300">
                      <span className="text-zinc-500 font-mono shrink-0">#{i + 1}</span>
                      <span>{title}</span>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section
                icon={<Tag size={13} />}
                title="Keywords com origem rastreável"
                hint="Cada palavra-chave veio de N anúncios reais — clique pra expandir."
              >
                <KeywordsTable keywords={seo.top_keywords_used} />
              </Section>

              <Section
                icon={<FileText size={13} />}
                title="Padrão de título da categoria"
              >
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <Metric label="Tamanho médio" value={`${seo.avg_title_length} chars`} />
                  <Metric label="Preço mediano" value={`R$ ${seo.price_median.toFixed(2)}`} />
                </div>
              </Section>

              <Legend />
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-zinc-500">
      <Search size={32} className="opacity-30" />
      <h3 className="text-sm font-medium text-zinc-300">Sem fontes registradas</h3>
      <p className="text-[12px] max-w-sm">
        Este anúncio foi gerado antes do e-Otimizer IA estar ativo, OU a pesquisa
        de mercado falhou na hora de gerar (ML offline). Regenere o anúncio
        pra capturar as fontes.
      </p>
    </div>
  )
}

function Intro({ categoryMlId }: { categoryMlId: string }) {
  return (
    <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3 text-[12px] text-cyan-200">
      <p>
        Este anúncio foi gerado com análise de mercado real. A IA leu 20 anúncios
        concorrentes da categoria <strong className="font-mono">{categoryMlId}</strong>{' '}
        e usou os padrões empíricos pra escolher título, keywords e atributos.
      </p>
      <p className="mt-1.5 text-[11px] text-cyan-300/70">
        Nenhuma keyword foi inventada — todas têm origem rastreável.
      </p>
    </div>
  )
}

function Section({
  icon, title, hint, children,
}: {
  icon:    React.ReactNode
  title:   string
  hint?:   string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-cyan-400">{icon}</span>
        <h3 className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">{title}</h3>
      </div>
      {hint && <p className="text-[11px] text-zinc-500 mb-2">{hint}</p>}
      <div>{children}</div>
    </section>
  )
}

function KeywordsTable({ keywords }: { keywords: SeoSourcesData['top_keywords_used'] }) {
  // Ordena: use primeiro, depois use_if_true, depois avoid
  const ordered = [...keywords].sort((a, b) => {
    const w: Record<string, number> = { use: 0, use_if_true: 1, avoid: 2 }
    return (w[a.recommend] ?? 3) - (w[b.recommend] ?? 3)
  })
  // Mostra só top 15 — a tabela completa fica grande demais
  const visible = ordered.slice(0, 15)
  const hidden = ordered.length - visible.length

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wider">
            <th className="text-left px-2.5 py-1.5">Palavra</th>
            <th className="text-center px-2 py-1.5">Origem</th>
            <th className="text-right px-2.5 py-1.5">Recomendação</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((kw, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/50'}>
              <td className="px-2.5 py-1.5 text-zinc-200 font-medium">{kw.keyword}</td>
              <td className="px-2 py-1.5 text-center text-zinc-400 font-mono">
                <span title={`MLBs: ${kw.sources_mlb.slice(0, 5).join(', ')}${kw.sources_mlb.length > 5 ? '…' : ''}`}>
                  {kw.frequency} de 20
                </span>
              </td>
              <td className="px-2.5 py-1.5 text-right">
                <RecommendBadge value={kw.recommend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div className="px-2.5 py-1.5 text-[10px] text-zinc-500 bg-zinc-900/70 text-center border-t border-zinc-800">
          +{hidden} keywords adicionais
        </div>
      )}
    </div>
  )
}

function RecommendBadge({ value }: { value: 'use' | 'use_if_true' | 'avoid' }) {
  const cfg = {
    use:         { label: '✓ Usar',          cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    use_if_true: { label: '⚠ Se for verdade', cls: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
    avoid:       { label: '✗ Evitar',         cls: 'bg-red-400/15 text-red-300 border-red-400/30' },
  }[value]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  )
}

function Legend() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex items-start gap-2 text-[11px] text-zinc-400">
        <AlertCircle size={12} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p><strong className="text-zinc-200">Como funciona:</strong> a IA buscou os 50 anúncios mais relevantes da categoria, filtrou os ruins (vendedor amarelo, preço outlier, suspeitos) e escolheu os 20 melhores baseado em vendas/dia, posição orgânica, reputação e relevância vs seu produto.</p>
          <p>Cada keyword aqui aparece em pelo menos 1 desses 20 anúncios — origem 100% rastreável.</p>
        </div>
      </div>
    </div>
  )
}
