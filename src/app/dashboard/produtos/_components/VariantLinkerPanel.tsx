'use client'

/**
 * Variantes de cor/acabamento (Provador IA) — no editor de produto do catálogo.
 *
 * Cada cor é um produto separado (cor no nome/SKU). Aqui o lojista CONFIRMA
 * quais outros produtos são variantes deste. A sugestão é por RAIZ DE SKU
 * (mesmo tronco, final diferente) — mas NADA é vinculado sem o lojista marcar.
 *
 * Usado pela vitrine: "Ver em outra cor" no Ambientador (Provador).
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Sparkles, X, Check, Loader2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function authToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

interface VItem { productId: string; name: string; sku: string | null; label: string | null; imageUrl: string | null }
interface VSuggestion { productId: string; name: string; sku: string | null; suggestLabel: string | null; imageUrl: string | null }

export default function VariantLinkerPanel({ productId }: { productId: string }) {
  const [items, setItems] = useState<Map<string, VItem>>(new Map())   // catálogo dos produtos conhecidos
  const [selected, setSelected] = useState<string[]>([])              // ids vinculados (ordem)
  const [suggestions, setSuggestions] = useState<VSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const token = await authToken()
      const headers = { Authorization: `Bearer ${token}` }
      const [linkedRes, sugRes] = await Promise.all([
        fetch(`${BACKEND}/storefront-variants?baseProductId=${encodeURIComponent(productId)}`, { headers }),
        fetch(`${BACKEND}/storefront-variants/suggest?baseProductId=${encodeURIComponent(productId)}`, { headers }),
      ])
      const linked = linkedRes.ok ? (await linkedRes.json()) as VItem[] : []
      const sug = sugRes.ok ? (await sugRes.json()) as VSuggestion[] : []
      const map = new Map<string, VItem>()
      for (const l of linked) map.set(l.productId, l)
      for (const s of sug) if (!map.has(s.productId)) {
        map.set(s.productId, { productId: s.productId, name: s.name, sku: s.sku, label: s.suggestLabel, imageUrl: s.imageUrl })
      }
      setItems(map)
      setSelected(linked.map(l => l.productId))
      setSuggestions(sug)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { void load() }, [load])

  const add = (id: string) => { setMsg(null); setSelected(prev => prev.includes(id) ? prev : [...prev, id]) }
  const remove = (id: string) => { setMsg(null); setSelected(prev => prev.filter(x => x !== id)) }

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null)
    try {
      const token = await authToken()
      const variants = selected.map(id => ({ variantProductId: id, label: items.get(id)?.label ?? null }))
      const res = await fetch(`${BACKEND}/storefront-variants`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseProductId: productId, variants }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({} as { message?: string }))
        throw new Error(b.message ?? `HTTP ${res.status}`)
      }
      setMsg('✓ Variantes salvas.')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pendingSuggestions = suggestions.filter(s => !selected.includes(s.productId))

  return (
    <div className="mt-8 pt-6" style={{ borderTop: '1px solid #27272a' }}>
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#fafafa' }}>
        <Sparkles size={15} style={{ color: '#00E5FF' }} /> Variantes de cor/acabamento (Provador IA)
      </h3>
      <p className="text-xs mt-1 mb-4" style={{ color: '#71717a' }}>
        Ligue os produtos que são a mesma peça em cores/acabamentos diferentes. Na loja, o cliente vê
        “Ver em outra cor” no Ambientador. Sugerimos candidatos pelo SKU — você confirma.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}>
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Vinculadas */}
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: '#52525b' }}>Variantes vinculadas</p>
            {selected.length === 0 ? (
              <p className="text-xs" style={{ color: '#71717a' }}>Nenhuma ainda. Confirme as sugestões abaixo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selected.map(id => {
                  const it = items.get(id)
                  return (
                    <span key={id} className="inline-flex items-center gap-2 rounded-full pl-1 pr-2 py-1 text-xs"
                      style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)', color: '#a5f3fc' }}>
                      {it?.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.imageUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                        : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#27272a', display: 'inline-block' }} />}
                      <span className="max-w-[160px] truncate">{it?.label || it?.name || id}</span>
                      <button type="button" onClick={() => remove(id)} aria-label="Remover" style={{ color: '#f87171', lineHeight: 0 }}>
                        <X size={13} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sugestões por SKU */}
          {pendingSuggestions.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: '#52525b' }}>
                Sugestões por SKU (confirme as reais)
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingSuggestions.map(s => (
                  <button key={s.productId} type="button" onClick={() => add(s.productId)}
                    className="inline-flex items-center gap-2 rounded-full pl-1 pr-2 py-1 text-xs transition-colors"
                    style={{ background: '#18181b', border: '1px solid #3f3f46', color: '#d4d4d8' }}
                    title={`${s.name}${s.sku ? ` · ${s.sku}` : ''}`}>
                    {s.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.imageUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#27272a', display: 'inline-block' }} />}
                    <span className="max-w-[160px] truncate">{s.suggestLabel || s.name}</span>
                    <Check size={13} style={{ color: '#4ade80' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <div className="rounded-lg p-2 text-xs mb-3" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
          {msg && <div className="rounded-lg p-2 text-xs mb-3" style={{ background: 'rgba(74,222,128,0.10)', color: '#86efac', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: '#00E5FF', color: '#06121a', opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar variantes
          </button>
        </>
      )}
    </div>
  )
}
