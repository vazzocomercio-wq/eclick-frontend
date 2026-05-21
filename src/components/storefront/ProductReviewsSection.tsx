'use client'

/**
 * Seção de avaliações na página de produto (Loja Própria).
 *
 * Renderiza, em ordem:
 *   1. Header com média + estrelas + count + distribuição (barra por rating)
 *   2. Lista paginada (10 por página) das reviews aprovadas
 *   3. Form pra cliente logado avaliar — só aparece se ele tem orderItem
 *      delivered não-avaliado deste produto (via /me/reviews/eligible)
 *   4. CTA "Entrar" pro anônimo (link pra /loja/[slug]/conta/entrar?next=)
 *
 * Mobile-first: form full-width, touch >=44px nos botões.
 *
 * Cores vêm do tema (CSS vars `--text`, `--text-muted`, `--surface`,
 * `--border`, `--primary`) que o StoreShell já expõe.
 */

import { useCallback, useEffect, useState } from 'react'
import { Star, Loader2, MessageSquare, Send, AlertCircle, X } from 'lucide-react'
import {
  fetchCurrentCustomer, fetchEligibleReviews, fetchProductReviews,
  submitReview, type EligibleReview, type ProductReviewListing,
} from '@/lib/storefront/customer-auth'
import { ReviewStars } from './ReviewStars'

const PAGE_SIZE = 10

interface Props {
  slug:      string
  productId: string
  /** Texto do CTA pra anônimo entrar/cadastrar. */
  loginHref?: string
}

export function ProductReviewsSection({ slug, productId, loginHref }: Props) {
  const [data, setData] = useState<ProductReviewListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [eligible, setEligible] = useState<EligibleReview | null>(null)
  const [openForm, setOpenForm] = useState(false)

  const load = useCallback(async (off: number) => {
    setLoading(true)
    const next = await fetchProductReviews(slug, productId, { limit: PAGE_SIZE, offset: off })
    setData(next)
    setLoading(false)
  }, [slug, productId])

  useEffect(() => { void load(0) }, [load])

  // Detecta sessão + elegibilidade pra avaliar ESTE produto
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const customer = await fetchCurrentCustomer(slug)
      if (cancelled) return
      if (!customer) { setLoggedIn(false); return }
      setLoggedIn(true)
      const all = await fetchEligibleReviews(slug)
      if (cancelled) return
      const match = all.find(e => e.productId === productId)
      setEligible(match ?? null)
    })()
    return () => { cancelled = true }
  }, [slug, productId])

  // Abrir form automaticamente se a URL trouxer ?review=1
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('review') === '1' && eligible) {
      setOpenForm(true)
      // Rola pra seção
      setTimeout(() => {
        document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }, [eligible])

  const total   = data?.total   ?? 0
  const summary = data?.summary ?? { avg: null, count: 0, distribution: {} as Record<string, number> }
  const items   = data?.items   ?? []

  const goNext = () => {
    const next = offset + PAGE_SIZE
    if (next < total) { setOffset(next); void load(next) }
  }
  const goPrev = () => {
    const next = Math.max(0, offset - PAGE_SIZE)
    if (next !== offset) { setOffset(next); void load(next) }
  }

  return (
    <section id="reviews-section"
      style={{
        marginTop: 32,
        padding: '24px 0',
        borderTop: '1px solid var(--border, #27272a)',
      }}>
      <h2 style={{
        fontSize: 22, fontWeight: 700, marginBottom: 16,
        color: 'var(--text, #fafafa)',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <MessageSquare size={20} /> Avaliações dos clientes
      </h2>

      {/* Header com resumo */}
      <SummaryHeader summary={summary} total={total} />

      {/* CTA Avaliar — se eligible */}
      {eligible && !openForm && (
        <button onClick={() => setOpenForm(true)}
          style={{
            marginTop: 12,
            width: '100%', padding: '12px 16px', minHeight: 44,
            background: 'var(--primary, #00E5FF)',
            color: 'var(--on-accent, #0a0a0e)',
            border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <Star size={16} /> Avaliar este produto
        </button>
      )}

      {/* Form de avaliação */}
      {eligible && openForm && (
        <ReviewForm
          slug={slug}
          eligible={eligible}
          onCancel={() => setOpenForm(false)}
          onSubmitted={() => {
            setOpenForm(false)
            setEligible(null) // já avaliou
            void load(0)      // recarrega lista (mostra como pending pro lojista moderar)
          }}
        />
      )}

      {/* CTA login pra anônimo */}
      {loggedIn === false && total > 0 && loginHref && (
        <p style={{
          marginTop: 12, padding: '10px 12px',
          fontSize: 13, color: 'var(--text-muted, #a1a1aa)',
          background: 'var(--surface, #18181b)',
          border: '1px dashed var(--border, #27272a)', borderRadius: 8,
        }}>
          Já comprou aqui? <a href={loginHref} style={{ color: 'var(--primary, #00E5FF)', fontWeight: 600 }}>Entre na sua conta</a> pra avaliar.
        </p>
      )}

      {/* Lista */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted, #71717a)' }}>
            <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
          </div>
        )}
        {!loading && total === 0 && (
          <p style={{ textAlign: 'center', padding: '24px 0', fontSize: 14, color: 'var(--text-muted, #71717a)' }}>
            Ainda não há avaliações.{eligible ? ' Seja o primeiro!' : ''}
          </p>
        )}
        {items.map(r => (
          <ReviewItem key={r.id} review={r} />
        ))}
      </div>

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button onClick={goPrev} disabled={offset === 0 || loading}
            style={pagerButton(offset === 0 || loading)}>
            ← Anterior
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>
            {Math.floor(offset / PAGE_SIZE) + 1} de {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button onClick={goNext} disabled={offset + PAGE_SIZE >= total || loading}
            style={pagerButton(offset + PAGE_SIZE >= total || loading)}>
            Próxima →
          </button>
        </div>
      )}
    </section>
  )
}

function SummaryHeader({ summary, total }: { summary: ProductReviewListing['summary']; total: number }) {
  const avg = summary.avg ?? 0
  const dist = summary.distribution ?? {}
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 24,
      padding: 16,
      background: 'var(--surface, #18181b)',
      border: '1px solid var(--border, #27272a)',
      borderRadius: 8,
    }}>
      <div style={{ flex: '0 0 auto', minWidth: 120, textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--text, #fafafa)', lineHeight: 1 }}>
          {avg ? avg.toFixed(1) : '–'}
        </div>
        <div style={{ marginTop: 6 }}><ReviewStars value={avg} size={18} idSeed="summary" /></div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
          {total} avaliaç{total === 1 ? 'ão' : 'ões'}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[5, 4, 3, 2, 1].map(n => {
          const cnt = dist[String(n)] ?? 0
          const pct = total > 0 ? (cnt / total) * 100 : 0
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ minWidth: 16, color: 'var(--text-muted, #a1a1aa)' }}>{n}★</span>
              <div style={{ flex: 1, height: 8, background: 'var(--border, #27272a)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: 'var(--primary, #fbbf24)',
                  transition: 'width 300ms',
                }} />
              </div>
              <span style={{ minWidth: 24, textAlign: 'right', color: 'var(--text-muted, #a1a1aa)' }}>{cnt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewItem({ review }: { review: ProductReviewListing['items'][number] }) {
  return (
    <article style={{
      padding: 16,
      background: 'var(--surface, #18181b)',
      border: '1px solid var(--border, #27272a)',
      borderRadius: 8,
    }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <ReviewStars value={review.rating} size={14} idSeed={review.id} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text, #fafafa)' }}>
            {review.customer.display_name}
          </span>
        </div>
        <time style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>
          {new Date(review.created_at).toLocaleDateString('pt-BR')}
        </time>
      </header>
      {review.title && (
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #fafafa)', marginBottom: 6 }}>
          {review.title}
        </h3>
      )}
      <p style={{ fontSize: 14, color: 'var(--text, #fafafa)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {review.body}
      </p>
      {review.photos.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {review.photos.map((p, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={p.url} alt="Foto da avaliação"
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border, #27272a)' }} />
          ))}
        </div>
      )}
      {review.store_reply && (
        <div style={{
          marginTop: 12, padding: 12,
          background: 'rgba(0,229,255,0.05)',
          border: '1px solid var(--border, #27272a)',
          borderLeft: '3px solid var(--primary, #00E5FF)',
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary, #00E5FF)', marginBottom: 4 }}>
            Resposta da loja
          </div>
          <p style={{ fontSize: 13, color: 'var(--text, #fafafa)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {review.store_reply}
          </p>
        </div>
      )}
    </article>
  )
}

function ReviewForm({ slug, eligible, onCancel, onSubmitted }: {
  slug:        string
  eligible:    EligibleReview
  onCancel:    () => void
  onSubmitted: () => void
}) {
  const [rating, setRating] = useState(5)
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [hover, setHover]   = useState<number | null>(null)
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState<string | null>(null)
  const [ok, setOk]         = useState(false)

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await submitReview(slug, {
        orderId:   eligible.orderId,
        productId: eligible.productId,
        rating,
        title:     title.trim() || undefined,
        body:      body.trim(),
      })
      setOk(true)
      setTimeout(onSubmitted, 1400)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setBusy(false)
    }
  }

  if (ok) {
    return (
      <div style={{
        marginTop: 12, padding: 16,
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 8,
        textAlign: 'center', color: '#22c55e', fontWeight: 600,
      }}>
        Avaliação enviada! A loja vai moderar e ela ficará visível em breve.
      </div>
    )
  }

  const display = hover ?? rating
  return (
    <div style={{
      marginTop: 12, padding: 16,
      background: 'var(--surface, #18181b)',
      border: '1px solid var(--primary, #00E5FF)',
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #fafafa)' }}>
          Avaliar &ldquo;{eligible.productName}&rdquo;
        </h3>
        <button type="button" onClick={onCancel} aria-label="Fechar"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted, #a1a1aa)', cursor: 'pointer', padding: 4, minHeight: 32, minWidth: 32 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginBottom: 6 }}>
          Sua nota
        </label>
        <div style={{ display: 'inline-flex', gap: 4 }} onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" disabled={busy}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 2, minHeight: 36, minWidth: 36, lineHeight: 0,
              }}>
              <Star size={28} fill={n <= display ? '#fbbf24' : 'none'} stroke={n <= display ? '#fbbf24' : '#52525b'} strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
          {display}/5
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginBottom: 6 }}>
          Título (opcional)
        </label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ex.: Superou expectativas"
          disabled={busy}
          style={{
            width: '100%', padding: '10px 12px', minHeight: 44,
            background: 'var(--background, #0a0a0e)', color: 'var(--text, #fafafa)',
            border: '1px solid var(--border, #27272a)', borderRadius: 6,
            fontSize: 14,
          }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginBottom: 6 }}>
          Comentário <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          rows={4}
          placeholder="Como foi sua experiência com o produto?"
          disabled={busy}
          style={{
            width: '100%', padding: '10px 12px', minHeight: 96,
            background: 'var(--background, #0a0a0e)', color: 'var(--text, #fafafa)',
            border: '1px solid var(--border, #27272a)', borderRadius: 6,
            fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
          }} />
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted, #71717a)' }}>
          {body.trim().length} caracteres
        </div>
      </div>

      {err && (
        <div style={{
          marginBottom: 12, padding: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 6, fontSize: 13, color: '#f87171',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <button type="button" onClick={submit} disabled={busy || body.trim().length < 5}
        style={{
          width: '100%', padding: '12px 16px', minHeight: 44,
          background: 'var(--primary, #00E5FF)',
          color: 'var(--on-accent, #0a0a0e)',
          border: 'none', borderRadius: 8,
          fontSize: 15, fontWeight: 600,
          cursor: busy || body.trim().length < 5 ? 'not-allowed' : 'pointer',
          opacity: busy || body.trim().length < 5 ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {busy ? 'Enviando…' : 'Publicar avaliação'}
      </button>
    </div>
  )
}

function pagerButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', minHeight: 40,
    background: 'var(--surface, #18181b)',
    color: disabled ? 'var(--text-muted, #52525b)' : 'var(--text, #fafafa)',
    border: '1px solid var(--border, #27272a)',
    borderRadius: 6,
    fontSize: 13, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
