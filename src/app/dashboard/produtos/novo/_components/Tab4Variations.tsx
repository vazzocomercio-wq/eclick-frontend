'use client'

import { Fragment, useCallback, useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import type { TabProps, Variation } from '../types'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

// 'Cor + Tamanho' = produto de DOIS eixos (Pendente Gota Creme G / Creme M).
// O Product OS gera essas linhas com `attributes` preenchido; aqui o `value` é o
// rótulo combinado ("Creme / G") e o editor é texto livre — não é uma cor só do
// catálogo, então o seletor de cor não se aplica.
const VARIATION_TYPES = ['Cor', 'Cor + Tamanho', 'Voltagem', 'Tamanho', 'Modelo', 'Capacidade', 'Material', 'Estilo']

// cor do catálogo do gerador de SKU (Product OS) — mesma taxonomia, mesma fonte
type SkuColor = { id: string; code: string; label: string }

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-all shrink-0"
      style={{ background: checked ? '#00E5FF' : '#3f3f46' }}>
      <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full"
        style={{ background: '#fff', left: checked ? '22px' : '2px' }} />
    </button>
  )
}

export default function Tab4Variations({ data, set }: TabProps) {
  const t = useTranslations('produtos')
  const uid = useId()
  const VARIATION_TYPE_LABEL: Record<string, string> = {
    'Cor': t('tab4.varType.color'),
    'Cor + Tamanho': t('tab4.varType.colorSize'),
    'Voltagem': t('tab4.varType.voltage'),
    'Tamanho': t('tab4.varType.size'),
    'Modelo': t('tab4.varType.model'),
    'Capacidade': t('tab4.varType.capacity'),
    'Material': t('tab4.varType.material'),
    'Estilo': t('tab4.varType.style'),
  }

  /** Opções do seletor de tipo, SEMPRE incluindo o valor atual da linha.
   *  Um <select> controlado com value fora das options renderiza vazio e, ao
   *  primeiro toque, troca o valor por outro sem o usuário pedir — ou seja,
   *  destrói silenciosamente um tipo que esta UI só não conhece ainda. */
  function typeOptions(current: string): string[] {
    return VARIATION_TYPES.includes(current) || !current ? VARIATION_TYPES : [current, ...VARIATION_TYPES]
  }

  // catálogo de cores do SKU: seletor único pra variação Cor. Se a busca falhar
  // (sem permissão/offline), o campo volta a ser texto livre — nada quebra.
  const [colors, setColors] = useState<SkuColor[]>([])
  const [colorsReady, setColorsReady] = useState(false)
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [savingColor, setSavingColor] = useState(false)
  const [colorErr, setColorErr] = useState('')
  const [genFor, setGenFor] = useState<string | null>(null)
  const [genErr, setGenErr] = useState('')

  const loadColors = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${BACKEND}/product-os/sku/taxonomy?kind=cor`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const j = await res.json()
      if (Array.isArray(j)) { setColors(j as SkuColor[]); setColorsReady(true) }
    } catch { /* segue com texto livre */ }
  }, [])
  useEffect(() => { void loadColors() }, [loadColors])

  function patchVariation(id: string, patch: Partial<Variation>) {
    set('variations', data.variations.map(v => v.id === id ? { ...v, ...patch } : v))
  }
  function updateVariation(id: string, field: keyof Variation, value: string) {
    patchVariation(id, { [field]: value })
  }

  /** Base do SKU (sem o sufixo de cor): SKU interno do produto ou deduzida de
   *  uma variação já no padrão BASE-NN. */
  function skuBase(): string {
    const b = (data.sku ?? '').trim()
    if (b) return b
    const w = data.variations.find(x => /-\d{2}$/.test(x.sku ?? ''))
    return w ? w.sku.replace(/-\d{2}$/, '') : ''
  }

  /** Escolher a cor só troca o CAMPO DE COR: valor = nome da cor, SKU = BASE-código. */
  function applyColor(v: Variation, cor: SkuColor) {
    const base = skuBase()
    patchVariation(v.id, { value: cor.label, sku: base ? `${base}-${cor.code}` : v.sku })
  }

  const sameLabel = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0

  async function createColor(v: Variation) {
    const label = newName.trim()
    if (!label) return
    setSavingColor(true); setColorErr('')
    try {
      const token = await getToken()
      const res = await fetch(`${BACKEND}/product-os/sku/taxonomy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'cor', label }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((j as { message?: string }).message ?? 'Erro ao cadastrar cor')
      const cor = j as SkuColor
      setColors(cs => (cs.some(c => c.id === cor.id) ? cs : [...cs, cor].sort((a, b) => a.code.localeCompare(b.code))))
      applyColor(v, cor)
      setNewFor(null); setNewName('')
    } catch (e) { setColorErr(e instanceof Error ? e.message : 'Erro') } finally { setSavingColor(false) }
  }

  /** Gera EAN interno (789/790) no backend — mesma numeração e checagem de
   *  unicidade do gerador do Product OS. */
  async function genEanFor(v: Variation) {
    setGenFor(v.id); setGenErr('')
    try {
      const token = await getToken()
      const res = await fetch(`${BACKEND}/product-os/sku/ean/mint`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !(j as { ean?: string }).ean) throw new Error((j as { message?: string }).message ?? 'Erro ao gerar EAN')
      patchVariation(v.id, { ean: (j as { ean: string }).ean })
    } catch (e) { setGenErr(e instanceof Error ? e.message : 'Erro') } finally { setGenFor(null) }
  }

  function addVariation() {
    const v: Variation = {
      id: `${uid}-${Date.now()}`,
      type: 'Cor', value: '', price: data.price, stock: '', sku: '', ean: '',
    }
    set('variations', [...data.variations, v])
  }

  function removeVariation(id: string) {
    set('variations', data.variations.filter(v => v.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <section>
        <p className={sec}>{t('tab4.section')}</p>
        <div className="flex items-center justify-between p-4 rounded-xl border"
          style={{ background: '#1c1c1f', borderColor: '#3f3f46' }}>
          <div>
            <p className="text-white text-sm font-medium">{t('tab4.hasVariations')}</p>
            <p className="text-zinc-500 text-[12px] mt-0.5">
              {t('tab4.hasVariationsSub')}
            </p>
          </div>
          <Toggle checked={data.hasVariations} onChange={v => {
            set('hasVariations', v)
            if (!v) set('variations', [])
          }} />
        </div>
      </section>

      {/* Variation table */}
      {data.hasVariations && (
        <section>
          <p className={sec}>{t('tab4.tableSection')}</p>

          {data.variations.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              {t('tab4.emptyTable')}
            </p>
          ) : (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#1e1e24' }}>
              <div style={{ minWidth: 920 }}>
              {/* Table header */}
              <div className="grid gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
                style={{ gridTemplateColumns: '140px minmax(160px,1fr) 95px 75px 130px 150px 36px', background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                <span>{t('tab4.col.type')}</span>
                <span>{t('tab4.col.value')}</span>
                <span>{t('tab4.col.price')}</span>
                <span>{t('tab4.col.stock')}</span>
                <span>{t('tab4.col.sku')}</span>
                <span>{t('tab4.col.ean')}</span>
                <span />
              </div>
              {/* Rows */}
              {data.variations.map((v, i) => (
                <Fragment key={v.id}>
                  <div
                    className="grid gap-2 px-4 py-2.5 items-center"
                    style={{
                      gridTemplateColumns: '140px minmax(160px,1fr) 95px 75px 130px 150px 36px',
                      background: i % 2 === 0 ? '#111114' : '#0f0f12',
                      borderBottom: '1px solid #1e1e24',
                    }}>
                    <select className={inp} value={v.type} onChange={e => updateVariation(v.id, 'type', e.target.value)}
                      style={{ background: '#1c1c1f' }}>
                      {typeOptions(v.type).map(vt => <option key={vt} value={vt}>{VARIATION_TYPE_LABEL[vt] ?? vt}</option>)}
                    </select>
                    {v.type === 'Cor' && colorsReady ? (
                      <select className={inp} style={{ background: '#1c1c1f' }}
                        value={colors.find(c => sameLabel(c.label, v.value))?.id ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          if (val === '__new') { setNewFor(v.id); setNewName(''); setColorErr('') }
                          else if (val) { const cor = colors.find(c => c.id === val); if (cor) applyColor(v, cor) }
                        }}>
                        <option value="" disabled>{v.value || t('tab4.valuePlaceholder')}</option>
                        {colors.map(c => <option key={c.id} value={c.id}>{c.label} · {c.code}</option>)}
                        <option value="__new">{t('tab4.newColor')}</option>
                      </select>
                    ) : (
                      <input type="text" className={inp} placeholder={t('tab4.valuePlaceholder')} value={v.value}
                        onChange={e => updateVariation(v.id, 'value', e.target.value)} />
                    )}
                    <input type="text" className={inp} placeholder="0,00" value={v.price}
                      onChange={e => updateVariation(v.id, 'price', e.target.value)} />
                    <input type="number" className={inp} placeholder="0" min={0} value={v.stock}
                      onChange={e => updateVariation(v.id, 'stock', e.target.value)} />
                    <input type="text" className={inp} placeholder="SKU-VAR-001" value={v.sku}
                      onChange={e => updateVariation(v.id, 'sku', e.target.value)} />
                    <div className="relative">
                      <input type="text" className={inp} style={{ paddingRight: (v.ean ?? '').trim() ? undefined : 34 }}
                        placeholder="789…" maxLength={14} value={v.ean ?? ''}
                        onChange={e => updateVariation(v.id, 'ean', e.target.value)} />
                      {!(v.ean ?? '').trim() && (
                        <button type="button" title={t('tab4.genEan')} disabled={genFor === v.id}
                          onClick={() => void genEanFor(v)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-[13px] disabled:opacity-50"
                          style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.10)' }}>
                          {genFor === v.id ? '…' : '⚡'}
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={() => removeVariation(v.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                      style={{ color: '#71717a' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {/* cadastro inline de cor nova → alimenta o catálogo do SKU e aplica na linha */}
                  {newFor === v.id && (
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-2"
                      style={{ background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                      <span className="text-[11px] shrink-0 text-zinc-400">{t('tab4.newColorLabel')}</span>
                      <input autoFocus type="text" className={inp} style={{ maxWidth: 260 }}
                        placeholder={t('tab4.newColorPlaceholder')} value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createColor(v) } }} />
                      <button type="button" disabled={savingColor || !newName.trim()} onClick={() => void createColor(v)}
                        className="px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-50 shrink-0"
                        style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
                        {savingColor ? '…' : t('tab4.newColorSave')}
                      </button>
                      <button type="button" onClick={() => { setNewFor(null); setColorErr('') }}
                        className="text-[12px] shrink-0" style={{ color: '#71717a' }}>
                        {t('tab4.newColorCancel')}
                      </button>
                      {colorErr && <span className="text-[11px]" style={{ color: '#f87171' }}>{colorErr}</span>}
                    </div>
                  )}
                </Fragment>
              ))}
              </div>
            </div>
          )}

          {genErr && <p className="mt-2 text-[12px]" style={{ color: '#f87171' }}>{genErr}</p>}

          <button type="button" onClick={addVariation}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#00E5FF', color: '#00E5FF', background: 'rgba(0,229,255,0.05)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('tab4.addVariation')}
          </button>

          {data.hasVariations && data.variations.length > 0 && (
            <div className="mt-4 px-4 py-3 rounded-lg text-[12px] space-y-1"
              style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.12)', color: '#71717a' }}>
              <p><span style={{ color: '#00E5FF' }}>{t('tab4.tipLabel')}</span> {t('tab4.tipText')}</p>
              {colorsReady && <p>{t('tab4.tipColor')}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
