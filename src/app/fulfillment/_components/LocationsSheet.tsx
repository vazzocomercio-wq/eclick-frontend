'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MapPin, Grid3x3, Upload, Sparkles, Trash2 } from 'lucide-react'
import { fulfillmentApi, type Warehouse, type WarehouseLocation, type AbcSuggestion, type AddressScheme } from '../_lib/api'

/**
 * Endereçamento de estoque (WMS slotting) — Fase 1, com DOIS padrões à escolha:
 *   1) Coluna-Estante-Nível  → A1-N1 (coluna-letra = setor; estante; nível)
 *   2) Rua-Estante-Nível-Posição → R02-E05-N3-P01
 * O endereço vira a ROTA na coleta (separação e ondas).
 */
export function LocationsSheet({ warehouses, warehouseId, onClose }: { warehouses: Warehouse[]; warehouseId: string | null; onClose: () => void }) {
  const [wid, setWid] = useState<string | null>(warehouseId)
  const [scheme, setScheme] = useState<AddressScheme>('coluna_estante_nivel')
  const [locs, setLocs] = useState<WarehouseLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (id: string | null) => {
    setLoading(true)
    try { setLocs(await fulfillmentApi.locations(id ?? undefined)); setErr(null) }
    catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(wid) }, [load, wid])
  useEffect(() => { fulfillmentApi.locationScheme().then((r) => setScheme(r.scheme)).catch(() => {}) }, [])

  async function changeScheme(s: AddressScheme) {
    setScheme(s); setMsg(null); setErr(null)
    try { await fulfillmentApi.setLocationScheme(s) } catch (e) { setErr((e as Error).message) }
  }

  // gerar malha — padrão coluna
  const [gc, setGc] = useState({ colFrom: 'A', colTo: 'E', estanteFrom: 1, estanteTo: 5, nivelFrom: 1, nivelTo: 4 })
  const [setores, setSetores] = useState<Record<string, string>>({})
  const cols = colLetters(gc.colFrom, gc.colTo)
  // gerar malha — padrão rua
  const [gr, setGr] = useState({ ruaFrom: 1, ruaTo: 5, estanteFrom: 1, estanteTo: 6, nivelFrom: 1, nivelTo: 4, posicaoFrom: 1, posicaoTo: 10 })

  async function generate() {
    if (!wid) { setErr('Selecione um CD.'); return }
    setBusy(true); setMsg(null); setErr(null)
    try {
      const r = scheme === 'coluna_estante_nivel'
        ? await fulfillmentApi.generateLocations({ warehouseId: wid, scheme, colFrom: gc.colFrom, colTo: gc.colTo, estanteFrom: gc.estanteFrom, estanteTo: gc.estanteTo, nivelFrom: gc.nivelFrom, nivelTo: gc.nivelTo, setores })
        : await fulfillmentApi.generateLocations({ warehouseId: wid, scheme, ruaFrom: gr.ruaFrom, ruaTo: gr.ruaTo, estanteFrom: gr.estanteFrom, estanteTo: gr.estanteTo, nivelFrom: gr.nivelFrom, nivelTo: gr.nivelTo, posicaoFrom: gr.posicaoFrom, posicaoTo: gr.posicaoTo })
      setMsg(`Malha gerada: ${r.created} endereços criados${r.skipped ? `, ${r.skipped} já existiam` : ''}.`)
      load(wid)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  // importar planilha
  const [importText, setImportText] = useState('')
  async function doImport() {
    if (!wid) { setErr('Selecione um CD.'); return }
    const rows = importText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const p = l.split(/[,;\t]/).map((s) => s.trim())
      return { sku: p[0], code: p[1] }
    }).filter((r) => r.sku && r.code)
    if (rows.length === 0) { setErr(`Cole linhas: SKU , endereço (ex.: ${exampleCode(scheme)}).`); return }
    setBusy(true); setMsg(null); setErr(null)
    try {
      const r = await fulfillmentApi.importLocations({ warehouseId: wid, rows })
      setMsg(`Importado: ${r.linked} vinculados de ${r.total}${r.skippedNoProduct.length ? `. SKUs sem produto: ${r.skippedNoProduct.slice(0, 8).join(', ')}${r.skippedNoProduct.length > 8 ? '…' : ''}` : ''}.`)
      setImportText(''); load(wid)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  // sugestão ABC
  const [suggestions, setSuggestions] = useState<AbcSuggestion[]>([])
  async function suggest(apply: boolean) {
    if (!wid) { setErr('Selecione um CD.'); return }
    setBusy(true); setMsg(null); setErr(null)
    try {
      const r = await fulfillmentApi.abcSuggest({ warehouseId: wid, apply })
      setSuggestions(r.suggestions)
      if (apply) { setMsg(`Aplicado: ${r.applied} produtos endereçados por curva ABC.`); setSuggestions([]); load(wid) }
      else if (r.suggestions.length === 0) setMsg('Nada a sugerir — não há produto sem endereço ou endereços de picking livres.')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true)
    try { await fulfillmentApi.deleteLocation(id); load(wid) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5" style={{ background: '#0b0b0e' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><MapPin size={20} color="#00E5FF" /><h2 className="text-lg font-bold">Endereçamento</h2></div>
          <button onClick={onClose} className="rounded-lg p-2" style={{ background: '#18181b' }}><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs" style={{ color: '#71717a' }}>Dê endereço aos produtos — a coleta passa a mostrar ONDE pegar e a ordenar pela rota.</p>

        {warehouses.length > 1 && (
          <select value={wid ?? ''} onChange={(e) => setWid(e.target.value)} className="mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        )}

        {/* Padrão de endereçamento */}
        <div className="mb-3 rounded-2xl p-3" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="mb-2 text-sm font-semibold">Padrão de endereço</h3>
          <div className="grid grid-cols-2 gap-2">
            <SchemeBtn active={scheme === 'coluna_estante_nivel'} onClick={() => changeScheme('coluna_estante_nivel')} title="Coluna-Estante-Nível" ex="A1-N1" />
            <SchemeBtn active={scheme === 'rua_estante_nivel_posicao'} onClick={() => changeScheme('rua_estante_nivel_posicao')} title="Rua-Estante-Nível-Posição" ex="R02-E05-N3-P01" />
          </div>
          <p className="mt-2 text-[11px]" style={{ color: '#52525b' }}>
            {scheme === 'coluna_estante_nivel'
              ? 'Coluna = letra (A,B,C…), cada uma é um setor; Estante = nº; Nível = andar. Cresce infinito.'
              : 'Rua, estante, nível e posição numerados.'}
          </p>
        </div>

        {msg && <div className="mb-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ADE50', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}
        {err && <div className="mb-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

        {/* Gerar malha */}
        <Section icon={<Grid3x3 size={15} color="#00E5FF" />} title="Gerar malha de endereços">
          {scheme === 'coluna_estante_nivel' ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <LetterRange label="Coluna" from={gc.colFrom} to={gc.colTo} onFrom={(v) => setGc({ ...gc, colFrom: v })} onTo={(v) => setGc({ ...gc, colTo: v })} />
                <Range label="Estante" from={gc.estanteFrom} to={gc.estanteTo} onFrom={(v) => setGc({ ...gc, estanteFrom: v })} onTo={(v) => setGc({ ...gc, estanteTo: v })} />
                <Range label="Nível" from={gc.nivelFrom} to={gc.nivelTo} onFrom={(v) => setGc({ ...gc, nivelFrom: v })} onTo={(v) => setGc({ ...gc, nivelTo: v })} />
              </div>
              {cols.length > 0 && (
                <div className="mt-2">
                  <div className="mb-1 text-[11px]" style={{ color: '#71717a' }}>Setor de cada coluna (opcional)</div>
                  <div className="flex flex-col gap-1">
                    {cols.map((c) => (
                      <div key={c} className="flex items-center gap-2">
                        <span className="w-6 font-mono text-sm font-bold" style={{ color: '#00E5FF' }}>{c}</span>
                        <input value={setores[c] ?? ''} onChange={(e) => setSetores({ ...setores, [c]: e.target.value })} placeholder="ex.: Pendentes" className="flex-1 rounded-lg px-2 py-1 text-sm outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Range label="Rua" from={gr.ruaFrom} to={gr.ruaTo} onFrom={(v) => setGr({ ...gr, ruaFrom: v })} onTo={(v) => setGr({ ...gr, ruaTo: v })} />
              <Range label="Estante" from={gr.estanteFrom} to={gr.estanteTo} onFrom={(v) => setGr({ ...gr, estanteFrom: v })} onTo={(v) => setGr({ ...gr, estanteTo: v })} />
              <Range label="Nível" from={gr.nivelFrom} to={gr.nivelTo} onFrom={(v) => setGr({ ...gr, nivelFrom: v })} onTo={(v) => setGr({ ...gr, nivelTo: v })} />
              <Range label="Posição" from={gr.posicaoFrom} to={gr.posicaoTo} onFrom={(v) => setGr({ ...gr, posicaoFrom: v })} onTo={(v) => setGr({ ...gr, posicaoTo: v })} />
            </div>
          )}
          <button onClick={generate} disabled={busy} className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>Gerar endereços</button>
        </Section>

        {/* Importar planilha */}
        <Section icon={<Upload size={15} color="#00E5FF" />} title="Importar planilha (SKU → endereço)">
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder={`AR522D, ${exampleCode(scheme)}\nKIT-6UN-CORDA, ${exampleCode2(scheme)}`} className="w-full rounded-xl px-3 py-2 font-mono text-xs outline-none" style={{ background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' }} />
          <button onClick={doImport} disabled={busy} className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#18181b', color: '#fafafa', border: '1px solid rgba(0,229,255,0.3)' }}>Importar</button>
        </Section>

        {/* Sugestão ABC */}
        <Section icon={<Sparkles size={15} color="#fcd34d" />} title="Sugestão por curva ABC (IA)">
          <p className="mb-2 text-xs" style={{ color: '#71717a' }}>Sugere endereços para produtos sem posição, colocando os de giro alto (classe A) perto da expedição.</p>
          <div className="flex gap-2">
            <button onClick={() => suggest(false)} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: '#18181b', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>Pré-visualizar</button>
            {suggestions.length > 0 && <button onClick={() => suggest(true)} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#fcd34d', color: '#241c02' }}>Aplicar {suggestions.length}</button>}
          </div>
          {suggestions.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {suggestions.slice(0, 12).map((s) => (
                <li key={s.productId} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs" style={{ background: '#0c0c10' }}>
                  <span className="truncate" style={{ color: '#a1a1aa', maxWidth: 200 }}>{s.abc ? `[${s.abc}] ` : ''}{s.sku} · {s.name}</span>
                  <span className="font-mono font-bold" style={{ color: '#00E5FF' }}>{s.code}</span>
                </li>
              ))}
              {suggestions.length > 12 && <li className="text-xs" style={{ color: '#52525b' }}>+{suggestions.length - 12} produtos…</li>}
            </ul>
          )}
        </Section>

        {/* Lista de endereços */}
        <Section icon={<MapPin size={15} color="#00E5FF" />} title={`Endereços cadastrados (${locs.length})`}>
          {loading ? <div className="h-10 animate-pulse rounded-lg" style={{ background: '#0c0c10' }} />
            : locs.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhum endereço ainda. Gere a malha acima.</p>
            : (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {locs.slice(0, 200).map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs" style={{ background: '#0c0c10' }}>
                    <span className="font-mono font-semibold" style={{ color: l.is_active ? '#00E5FF' : '#52525b' }}>📍 {l.code}{l.setor ? <span className="font-sans" style={{ color: '#71717a' }}> · {l.setor}</span> : null}</span>
                    <button onClick={() => remove(l.id)} disabled={busy} className="p-1" aria-label="Remover"><Trash2 size={13} color="#f87171" /></button>
                  </li>
                ))}
                {locs.length > 200 && <li className="text-xs" style={{ color: '#52525b' }}>+{locs.length - 200} endereços…</li>}
              </ul>
            )}
        </Section>
      </div>
    </div>
  )
}

function exampleCode(s: AddressScheme): string { return s === 'coluna_estante_nivel' ? 'A1-N1' : 'R02-E05-N3-P01' }
function exampleCode2(s: AddressScheme): string { return s === 'coluna_estante_nivel' ? 'B3-N2' : 'R01-E03-N1-P02' }
function colLetters(from: string, to: string): string[] {
  const a = (from || 'A').toUpperCase().charCodeAt(0), b = (to || from || 'A').toUpperCase().charCodeAt(0)
  if (a < 65 || a > 90 || b < 65 || b > 90) return []
  const lo = Math.min(a, b), hi = Math.max(a, b)
  return Array.from({ length: hi - lo + 1 }, (_, i) => String.fromCharCode(lo + i))
}

function SchemeBtn({ active, onClick, title, ex }: { active: boolean; onClick: () => void; title: string; ex: string }) {
  return (
    <button onClick={onClick} className="rounded-xl px-2 py-2 text-left" style={{ background: active ? 'rgba(0,229,255,0.10)' : '#0c0c10', border: `1px solid ${active ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="text-[11px] font-semibold" style={{ color: active ? '#00E5FF' : '#a1a1aa' }}>{title}</div>
      <div className="font-mono text-xs" style={{ color: active ? '#00E5FF' : '#52525b' }}>{ex}</div>
    </button>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-2xl p-3" style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-2 flex items-center gap-2"><span>{icon}</span><h3 className="text-sm font-semibold">{title}</h3></div>
      {children}
    </section>
  )
}

function Range({ label, from, to, onFrom, onTo }: { label: string; from: number; to: number; onFrom: (v: number) => void; onTo: (v: number) => void }) {
  const inp = 'w-full rounded-lg px-2 py-1.5 text-sm outline-none tabular-nums'
  const st = { background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' } as const
  return (
    <div>
      <div className="mb-1 text-[11px]" style={{ color: '#71717a' }}>{label}</div>
      <div className="flex items-center gap-1">
        <input type="number" min={1} value={from} onChange={(e) => onFrom(Math.max(1, Number(e.target.value) || 1))} className={inp} style={st} />
        <span style={{ color: '#52525b' }}>–</span>
        <input type="number" min={1} value={to} onChange={(e) => onTo(Math.max(1, Number(e.target.value) || 1))} className={inp} style={st} />
      </div>
    </div>
  )
}

function LetterRange({ label, from, to, onFrom, onTo }: { label: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const inp = 'w-full rounded-lg px-2 py-1.5 text-center text-sm font-mono uppercase outline-none'
  const st = { background: '#0c0c10', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' } as const
  const clean = (v: string) => (v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'A')
  return (
    <div>
      <div className="mb-1 text-[11px]" style={{ color: '#71717a' }}>{label}</div>
      <div className="flex items-center gap-1">
        <input maxLength={1} value={from} onChange={(e) => onFrom(clean(e.target.value))} className={inp} style={st} />
        <span style={{ color: '#52525b' }}>–</span>
        <input maxLength={1} value={to} onChange={(e) => onTo(clean(e.target.value))} className={inp} style={st} />
      </div>
    </div>
  )
}
