'use client'

/**
 * Custos de Produção 3D — custeio por absorção (R$/g).
 * Todo custo operacional mensal rateado em cada grama boa produzida; energia
 * por família de material (PLA ≠ ABS); trilha de auditoria em cada alteração.
 * NÃO confundir com Financeiro → Custos Operacionais (aquele rateia no DRE de
 * VENDA; este é custo de FABRICAÇÃO, estágio anterior).
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Zap, Factory, Receipt, Package, Boxes, Tag, FlaskConical, History,
  Plus, Trash2, Check, AlertTriangle, ShieldCheck, Loader2, Sparkles,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── Types (payload de GET /prod3d/dados) ──────────────────────────────────────

type Config = {
  tarifa_kwh: number; tarifa_kwh_estimado: boolean
  taxa_falha: number; fator_purga_ams: number; perdas_estimado: boolean
  manutencao_hora: number; manutencao_estimado: boolean
  mo_custo_hora: number; mo_minutos_padrao: number
  horas_mes_por_impressora: number; producao_estimado: boolean
}
type Impressora = { id: string; modelo: string; quantidade: number; valor_pago: number; vida_util_horas: number; potencia_ams_w: number; estimado: boolean }
type Potencia = { id: string; impressora_id: string; material: string; watts: number; estimado: boolean; fonte: string | null }
type Fixo = { id: string; nome: string; valor_mensal: number; categoria: string; estimado: boolean }
type Filamento = { id: string; material: string; preco_kg: number; estimado: boolean }
type Embalagem = { id: string; codigo: string; descricao: string; unidade: string; preco: number; qtd_padrao: number; estimado: boolean }
type Sku = { id: string; sku: string; projeto: string | null; gramas: number; horas: number; material: string }
type SkuCusto = { total: number; por_grama: number; filamento: number; energia: number; depreciacao: number; manutencao: number; fixo_rateado: number; embalagem: number } | null
type Kpis = {
  custo_g: { filamento: number; energia: number; depreciacao: number; manutencao: number; fixo_rateado: number; total: number }
  hm_pla: { total: number }
  fixos: { total: number }
  cap: { g_boas_mes: number; horas_mes: number; g_por_hora: number; origem_g_por_hora: string }
} | null
type Dados = {
  config: Config; impressoras: Impressora[]; potencias: Potencia[]; fixos: Fixo[]
  filamentos: Filamento[]; embalagens: Embalagem[]; skus: Sku[]
  kpis: Kpis; sku_custos: SkuCusto[]; problemas: Array<[string, string]>
}

const CATEGORIAS = ['aluguel', 'impostos', 'pessoal', 'servicos', 'insumos', 'outros']

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers as Record<string, string> ?? {}) },
  })
  const j: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const m = (j as { message?: string | string[] })?.message
    throw new Error(Array.isArray(m) ? m.join('; ') : (m ?? `Erro ${res.status}`))
  }
  return j as T
}

function Skel({ h = 16, w = '100%' }: { h?: number; w?: string }) {
  return <div className="rounded-lg animate-pulse" style={{ height: h, width: w, background: '#1e1e24' }} />
}

function EstimadoPill({ texto = 'estimado' }: { texto?: string }) {
  return (
    <span className="ml-1.5 rounded-md px-1.5 text-[10px] align-middle"
      style={{ color: '#F59E0B', border: '1px solid rgba(245,158,11,0.45)' }}>
      {texto}
    </span>
  )
}

// input numérico + botão salvar (padrão de edição inline da página)
function CampoNum({ label, valor, sufixo, estimado, onSave, step = 'any', largura = 110 }: {
  label: string; valor: number; sufixo?: string; estimado?: boolean
  onSave: (v: number) => Promise<void>; step?: string; largura?: number
}) {
  const [v, setV] = useState(String(valor))
  const [busy, setBusy] = useState(false)
  useEffect(() => setV(String(valor)), [valor])
  const salvar = async () => {
    const n = parseFloat(v)
    if (!Number.isFinite(n)) return
    setBusy(true)
    try { await onSave(n) } finally { setBusy(false) }
  }
  return (
    <div>
      <div className="mb-1 text-xs" style={{ color: '#a1a1aa' }}>
        {label}{estimado && <EstimadoPill />}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="number" step={step} value={v} onChange={e => setV(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && salvar()}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-1"
          style={{ width: largura, background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
        {sufixo && <span className="text-xs" style={{ color: '#71717a' }}>{sufixo}</span>}
        <button onClick={salvar} disabled={busy} title="Salvar"
          className="rounded-lg p-1.5 transition-colors hover:bg-cyan-400/10"
          style={{ border: '1px solid #27272a', color: '#00E5FF' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
      </div>
    </div>
  )
}

function Secao({ icon, titulo, children, nota }: { icon: React.ReactNode; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color: '#00E5FF' }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>{titulo}</h2>
      </div>
      {nota && <p className="mb-3 -mt-1 text-xs" style={{ color: '#71717a' }}>{nota}</p>}
      {children}
    </section>
  )
}

const th = 'px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide'
const td = 'px-2.5 py-1.5 text-sm'
const inputCls = 'rounded-lg px-2 py-1 text-sm outline-none'
const inputStyle = { background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' } as const

// ── Página ────────────────────────────────────────────────────────────────────

export default function CustosProducaoPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [flash, setFlash] = useState('')

  // formulários de adição
  const [fxNome, setFxNome] = useState(''); const [fxValor, setFxValor] = useState(''); const [fxCat, setFxCat] = useState('')
  const [explicacao, setExplicacao] = useState(''); const [explicando, setExplicando] = useState(false)
  const [filMat, setFilMat] = useState(''); const [filPreco, setFilPreco] = useState('')
  const [potMat, setPotMat] = useState(''); const [potW, setPotW] = useState(''); const [potFonte, setPotFonte] = useState('')
  const [skNome, setSkNome] = useState(''); const [skG, setSkG] = useState(''); const [skH, setSkH] = useState(''); const [skMat, setSkMat] = useState('PLA')
  // edição inline (valor por id)
  const [edit, setEdit] = useState<Record<string, string>>({})
  // simulador de peça
  const [simG, setSimG] = useState(''); const [simH, setSimH] = useState(''); const [simMat, setSimMat] = useState('PLA')
  const [simRes, setSimRes] = useState<SkuCusto>(null); const [simBusy, setSimBusy] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setDados(await api<Dados>('/prod3d/dados'))
      setErro('')
    } catch (e: unknown) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const mudar = useCallback(async (fn: () => Promise<unknown>, ok = 'Salvo — auditoria registrada') => {
    try {
      await fn()
      await carregar()
      setFlash(ok); setErro('')
      setTimeout(() => setFlash(''), 2500)
    } catch (e: unknown) {
      setErro((e as Error).message)
    }
  }, [carregar])

  const setConfig = (campo: string) => (valor: number) =>
    mudar(() => api('/prod3d/config', { method: 'PATCH', body: JSON.stringify({ campo, valor }) }))

  const k = dados?.kpis
  const comp = k ? [
    { nome: 'Custos fixos rateados', v: k.custo_g.fixo_rateado, cor: '#00E5FF' },
    { nome: 'Filamento', v: k.custo_g.filamento, cor: '#4ADE50' },
    { nome: 'Depreciação', v: k.custo_g.depreciacao, cor: '#F59E0B' },
    { nome: 'Manutenção', v: k.custo_g.manutencao, cor: '#a78bfa' },
    { nome: 'Energia', v: k.custo_g.energia, cor: '#f472b6' },
  ] : []
  const problemas = dados?.problemas ?? []
  const erros = problemas.filter(p => p[0] === 'ERRO')
  const avisos = problemas.filter(p => p[0] === 'AVISO')
  const estimados = problemas.filter(p => p[0] === 'ESTIMADO')

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#fafafa' }}>Custos de Produção 3D</h1>
          <p className="text-xs" style={{ color: '#71717a' }}>
            Custeio por absorção — todo custo operacional mensal rateado em cada grama boa produzida.
            Não inclui custo de venda (comissão, frete, ads): isso é do Financeiro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {flash && (
            <span className="rounded-lg px-3 py-1.5 text-xs" style={{ background: 'rgba(74,222,80,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,80,0.3)' }}>
              ✓ {flash}
            </span>
          )}
          <button disabled={explicando || loading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
            onClick={async () => {
              setExplicando(true)
              try {
                const r = await api<{ texto: string }>('/prod3d/explicar', { method: 'POST' })
                setExplicacao(r.texto); setErro('')
              } catch (e: unknown) { setErro((e as Error).message) } finally { setExplicando(false) }
            }}>
            {explicando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Explicar para investidor (IA)
          </button>
        </div>
      </div>

      {explicacao && (
        <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line"
          style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.35)', color: '#fafafa', borderLeft: '3px solid #00E5FF' }}>
          <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: '#00E5FF' }}>
            <Sparkles size={12} /> Resumo executivo (IA)
          </div>
          <p>{explicacao}</p>
        </div>
      )}

      {erro && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !dados ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={86} />) : (
          <>
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.35)' }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: '#a1a1aa' }}>Custo por grama</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#00E5FF' }}>
                {k ? brl(k.custo_g.total) : '—'}<span className="text-xs font-normal" style={{ color: '#71717a' }}> /g boa</span>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: '#a1a1aa' }}>Custos fixos</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#fafafa' }}>
                {k ? brl(k.fixos.total) : '—'}<span className="text-xs font-normal" style={{ color: '#71717a' }}> /mês</span>
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: '#a1a1aa' }}>Capacidade</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#fafafa' }}>
                {k ? `${num(k.cap.g_boas_mes / 1000, 1)} kg` : '—'}<span className="text-xs font-normal" style={{ color: '#71717a' }}> boas/mês</span>
              </div>
              {k && <div className="text-[11px] tabular-nums" style={{ color: '#71717a' }}>{num(k.cap.horas_mes, 0)}h × {num(k.cap.g_por_hora, 1)} g/h</div>}
            </div>
            <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: '#a1a1aa' }}>Hora-máquina (PLA)</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#fafafa' }}>
                {k ? brl(k.hm_pla.total) : '—'}<span className="text-xs font-normal" style={{ color: '#71717a' }}> /h</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Composição do R$/g */}
      {k && k.custo_g.total > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="mb-2 text-xs font-semibold" style={{ color: '#fafafa' }}>De onde vem cada real do custo por grama</div>
          <div className="flex h-6 overflow-hidden rounded-lg" style={{ border: '1px solid #27272a' }}>
            {comp.map(c => (
              <div key={c.nome} title={`${c.nome}: ${brl(c.v)}/g`}
                style={{ width: `${(100 * c.v / k.custo_g.total).toFixed(2)}%`, background: c.cor }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {comp.map(c => (
              <span key={c.nome} className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#a1a1aa' }}>
                <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.cor }} />
                {c.nome} <b className="tabular-nums" style={{ color: '#fafafa' }}>{num(c.v, 3)}</b>
                ({(100 * c.v / k.custo_g.total).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {loading || !dados ? <Skel h={300} /> : (
        <>
          {/* Energia e perdas */}
          <Secao icon={<Zap size={15} />} titulo="Energia e perdas">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <CampoNum label="Tarifa de energia" sufixo="R$/kWh" valor={dados.config.tarifa_kwh}
                estimado={dados.config.tarifa_kwh_estimado} onSave={setConfig('kwh')} />
              <CampoNum label="Taxa de falha" sufixo="0–1" valor={dados.config.taxa_falha}
                estimado={dados.config.perdas_estimado} onSave={setConfig('falha')} step="0.01" />
              <CampoNum label="Purga AMS" sufixo="0–1" valor={dados.config.fator_purga_ams}
                estimado={dados.config.perdas_estimado} onSave={setConfig('purga')} step="0.01" />
              <CampoNum label="Manutenção" sufixo="R$/h" valor={dados.config.manutencao_hora}
                estimado={dados.config.manutencao_estimado} onSave={setConfig('manutencao')} />
              <CampoNum label="Mão de obra direta" sufixo="R$/h" valor={dados.config.mo_custo_hora}
                onSave={setConfig('mo_hora')} />
            </div>
          </Secao>

          {/* Impressoras + potências */}
          <Secao icon={<Factory size={15} />} titulo="Impressoras e potência por material"
            nota="Potência = watts médios IMPRIMINDO cada família (PLA-Silk usa PLA, PETG-HF usa PETG…). Mediu com a tomada medidora? Salve aqui com a fonte.">
            {dados.impressoras.map(imp => (
              <div key={imp.id} className="mb-3 rounded-lg p-3" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
                <div className="mb-2 text-sm font-semibold" style={{ color: '#fafafa' }}>
                  {imp.modelo}{imp.estimado && <EstimadoPill texto="valor/vida estimados" />}
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <CampoNum label="Valor pago" sufixo="R$" valor={imp.valor_pago}
                    onSave={v => mudar(() => api(`/prod3d/impressoras/${imp.id}`, { method: 'PATCH', body: JSON.stringify({ campo: 'valor_pago', valor: v }) }))} />
                  <CampoNum label="Vida útil" sufixo="horas" valor={imp.vida_util_horas}
                    onSave={v => mudar(() => api(`/prod3d/impressoras/${imp.id}`, { method: 'PATCH', body: JSON.stringify({ campo: 'vida_util_horas', valor: v }) }))} />
                  <CampoNum label="Quantidade" valor={imp.quantidade} largura={70}
                    onSave={v => mudar(() => api(`/prod3d/impressoras/${imp.id}`, { method: 'PATCH', body: JSON.stringify({ campo: 'quantidade', valor: v }) }))} />
                  <CampoNum label="AMS" sufixo="W" valor={imp.potencia_ams_w} largura={70}
                    onSave={v => mudar(() => api(`/prod3d/impressoras/${imp.id}`, { method: 'PATCH', body: JSON.stringify({ campo: 'potencia_ams_w', valor: v }) }))} />
                  <CampoNum label="Horas de impressão/mês" sufixo="h" valor={dados.config.horas_mes_por_impressora}
                    estimado={dados.config.producao_estimado} onSave={setConfig('horas_mes')} />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                        <th className={th}>Família</th><th className={th}>W médios</th><th className={th}>Fonte</th><th className={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {dados.potencias.filter(p => p.impressora_id === imp.id).sort((a, b) => a.material.localeCompare(b.material)).map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                          <td className={td} style={{ color: '#fafafa' }}>
                            <b>{p.material}</b>{p.estimado && <EstimadoPill texto="estimado — medir!" />}
                          </td>
                          <td className={td}>
                            <input type="number" step="any" defaultValue={p.watts} className={inputCls} style={{ ...inputStyle, width: 80 }}
                              onChange={e => setEdit(s => ({ ...s, [`pot-${p.id}`]: e.target.value }))} />
                          </td>
                          <td className={`${td} max-w-[360px] whitespace-normal text-xs`} style={{ color: '#71717a' }}>{p.fonte ?? ''}</td>
                          <td className={td}>
                            <button title="Salvar" className="rounded-lg p-1.5 hover:bg-cyan-400/10" style={{ border: '1px solid #27272a', color: '#00E5FF' }}
                              onClick={() => mudar(() => api('/prod3d/potencias', {
                                method: 'PUT',
                                body: JSON.stringify({ impressora_id: imp.id, material: p.material, watts: parseFloat(edit[`pot-${p.id}`] ?? String(p.watts)), fonte: 'confirmado na tela de custos' }),
                              }))}>
                              <Check size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input placeholder="Material (ex.: PETG)" value={potMat} onChange={e => setPotMat(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 140 }} />
                  <input placeholder="Watts" type="number" value={potW} onChange={e => setPotW(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 90 }} />
                  <input placeholder="Fonte (como mediu)" value={potFonte} onChange={e => setPotFonte(e.target.value)} className={`${inputCls} flex-1 min-w-[160px]`} style={inputStyle} />
                  <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
                    onClick={() => mudar(() => api('/prod3d/potencias', {
                      method: 'PUT', body: JSON.stringify({ impressora_id: imp.id, material: potMat, watts: parseFloat(potW), fonte: potFonte }),
                    }), 'Potência salva').then(() => { setPotMat(''); setPotW(''); setPotFonte('') })}>
                    <Plus size={13} /> Salvar potência
                  </button>
                </div>
              </div>
            ))}
            {!dados.impressoras.length && (
              <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhuma impressora cadastrada — cadastre a primeira pelo suporte ou peça pro time habilitar.</p>
            )}
          </Secao>

          {/* Custos fixos */}
          <Secao icon={<Receipt size={15} />} titulo="Custos fixos mensais (100% rateados em cada grama)"
            nota="Aluguel, impostos fixos, pessoal, serviços, insumos de bancada. Não cadastre custo de venda aqui — e não duplique o que já está em Financeiro → Custos Operacionais (aquele rateia no DRE de venda).">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                    <th className={th}>Custo</th><th className={th}>Categoria</th><th className={`${th} text-right`}>R$/mês</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {dados.fixos.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                      <td className={td} style={{ color: '#fafafa' }}>{f.nome}{f.estimado && <EstimadoPill />}</td>
                      <td className={td} style={{ color: '#a1a1aa' }}>{f.categoria}</td>
                      <td className={`${td} text-right`}>
                        <input type="number" step="any" defaultValue={f.valor_mensal} className={`${inputCls} text-right tabular-nums`} style={{ ...inputStyle, width: 110 }}
                          onChange={e => setEdit(s => ({ ...s, [`fx-${f.id}`]: e.target.value }))} />
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <button title="Salvar" className="mr-1 rounded-lg p-1.5 hover:bg-cyan-400/10" style={{ border: '1px solid #27272a', color: '#00E5FF' }}
                          onClick={() => mudar(() => api(`/prod3d/fixos/${f.id}`, { method: 'PATCH', body: JSON.stringify({ valor_mensal: parseFloat(edit[`fx-${f.id}`] ?? String(f.valor_mensal)) }) }))}>
                          <Check size={14} />
                        </button>
                        <button title="Remover" className="rounded-lg p-1.5 hover:bg-red-400/10" style={{ border: '1px solid #27272a', color: '#f87171' }}
                          onClick={() => { if (confirm(`Remover o custo "${f.nome}"?`)) void mudar(() => api(`/prod3d/fixos/${f.id}`, { method: 'DELETE' }), 'Custo removido') }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {k && (
                    <tr>
                      <td className={`${td} font-bold`} style={{ color: '#fafafa' }}>Total</td><td />
                      <td className={`${td} text-right font-bold tabular-nums`} style={{ color: '#fafafa' }}>{brl(k.fixos.total)}</td><td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input placeholder="Nome do custo (ex.: Seguro do galpão)" value={fxNome} onChange={e => setFxNome(e.target.value)} className={`${inputCls} flex-1 min-w-[200px]`} style={inputStyle} />
              <input placeholder="R$/mês" type="number" value={fxValor} onChange={e => setFxValor(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 110 }} />
              <select value={fxCat} onChange={e => setFxCat(e.target.value)} className={inputCls} style={inputStyle}>
                <option value="">✨ IA decide a categoria</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
                onClick={() => mudar(() => api('/prod3d/fixos', { method: 'POST', body: JSON.stringify({ nome: fxNome, valor_mensal: parseFloat(fxValor), categoria: fxCat || undefined }) }), 'Custo cadastrado')
                  .then(() => { setFxNome(''); setFxValor('') })}>
                <Plus size={13} /> Cadastrar custo
              </button>
            </div>
          </Secao>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Filamentos */}
            <Secao icon={<Boxes size={15} />} titulo="Filamentos (R$/kg)"
              nota="Cadastre com o preço que VOCÊ pagou. Variantes (PLA-SILK, PETG-HF…) herdam a energia da família sozinhas.">
              <table className="w-full">
                <thead>
                  <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                    <th className={th}>Material</th><th className={`${th} text-right`}>R$/kg</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {dados.filamentos.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                      <td className={td} style={{ color: '#fafafa' }}><b>{f.material}</b>{f.estimado && <EstimadoPill />}</td>
                      <td className={`${td} text-right`}>
                        <input type="number" step="any" defaultValue={f.preco_kg} className={`${inputCls} text-right tabular-nums`} style={{ ...inputStyle, width: 100 }}
                          onChange={e => setEdit(s => ({ ...s, [`fil-${f.id}`]: e.target.value }))} />
                      </td>
                      <td className={td}>
                        <button title="Salvar" className="rounded-lg p-1.5 hover:bg-cyan-400/10" style={{ border: '1px solid #27272a', color: '#00E5FF' }}
                          onClick={() => mudar(() => api('/prod3d/filamentos', { method: 'PUT', body: JSON.stringify({ material: f.material, preco_kg: parseFloat(edit[`fil-${f.id}`] ?? String(f.preco_kg)) }) }))}>
                          <Check size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <input placeholder="Material (ex.: PLA-SILK)" value={filMat} onChange={e => setFilMat(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 150 }} />
                <input placeholder="R$/kg" type="number" value={filPreco} onChange={e => setFilPreco(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 100 }} />
                <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
                  onClick={() => mudar(() => api('/prod3d/filamentos', { method: 'PUT', body: JSON.stringify({ material: filMat, preco_kg: parseFloat(filPreco) }) }), 'Filamento salvo')
                    .then(() => { setFilMat(''); setFilPreco('') })}>
                  <Plus size={13} /> Salvar
                </button>
              </div>
            </Secao>

            {/* Embalagens */}
            <Secao icon={<Package size={15} />} titulo="Embalagem"
              nota="Qtd padrão = quanto entra na embalagem de 1 peça (compõe o custo por peça).">
              <table className="w-full">
                <thead>
                  <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                    <th className={th}>Item</th><th className={`${th} text-right`}>R$</th><th className={`${th} text-right`}>Qtd padrão</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {dados.embalagens.map(e2 => (
                    <tr key={e2.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                      <td className={td} style={{ color: '#fafafa' }}>{e2.descricao} <span className="text-xs" style={{ color: '#71717a' }}>({e2.unidade})</span>{e2.estimado && <EstimadoPill />}</td>
                      <td className={`${td} text-right`}>
                        <input type="number" step="any" defaultValue={e2.preco} className={`${inputCls} text-right tabular-nums`} style={{ ...inputStyle, width: 80 }}
                          onChange={ev => setEdit(s => ({ ...s, [`embp-${e2.id}`]: ev.target.value }))} />
                      </td>
                      <td className={`${td} text-right`}>
                        <input type="number" step="any" defaultValue={e2.qtd_padrao} className={`${inputCls} text-right tabular-nums`} style={{ ...inputStyle, width: 70 }}
                          onChange={ev => setEdit(s => ({ ...s, [`embq-${e2.id}`]: ev.target.value }))} />
                      </td>
                      <td className={td}>
                        <button title="Salvar" className="rounded-lg p-1.5 hover:bg-cyan-400/10" style={{ border: '1px solid #27272a', color: '#00E5FF' }}
                          onClick={() => mudar(() => api(`/prod3d/embalagens/${e2.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              preco: parseFloat(edit[`embp-${e2.id}`] ?? String(e2.preco)),
                              qtd_padrao: parseFloat(edit[`embq-${e2.id}`] ?? String(e2.qtd_padrao)),
                            }),
                          }))}>
                          <Check size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Secao>
          </div>

          {/* SKUs */}
          <Secao icon={<Tag size={15} />} titulo="SKUs — peso e tempo REAIS do fatiador"
            nota="A média g/h destes SKUs define a capacidade usada no rateio dos fixos. Cadastre todo SKU novo logo após fatiar.">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>
                    <th className={th}>SKU</th><th className={`${th} text-right`}>g</th><th className={`${th} text-right`}>h</th>
                    <th className={th}>Mat</th><th className={`${th} text-right`}>Custo produção</th><th className={`${th} text-right`}>R$/g</th><th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {dados.skus.map((s, i) => {
                    const pc = dados.sku_custos[i]
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                        <td className={td} style={{ color: '#fafafa' }}>{s.sku}</td>
                        <td className={`${td} text-right tabular-nums`} style={{ color: '#a1a1aa' }}>{num(s.gramas, 1)}</td>
                        <td className={`${td} text-right tabular-nums`} style={{ color: '#a1a1aa' }}>{num(s.horas, 2)}</td>
                        <td className={td} style={{ color: '#a1a1aa' }}>{s.material}</td>
                        <td className={`${td} text-right font-semibold tabular-nums`} style={{ color: '#fafafa' }}>{pc ? brl(pc.total) : '—'}</td>
                        <td className={`${td} text-right tabular-nums`} style={{ color: '#00E5FF' }}>{pc ? num(pc.por_grama) : '—'}</td>
                        <td className={td}>
                          <button title="Remover" className="rounded-lg p-1.5 hover:bg-red-400/10" style={{ border: '1px solid #27272a', color: '#f87171' }}
                            onClick={() => { if (confirm(`Remover o SKU "${s.sku}"?`)) void mudar(() => api(`/prod3d/skus/${s.id}`, { method: 'DELETE' }), 'SKU removido') }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!dados.skus.length && (
                    <tr><td colSpan={7} className={`${td} text-center`} style={{ color: '#71717a' }}>
                      Nenhum SKU — cadastre o primeiro com o peso/tempo do fatiador pra usar produtividade real.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input placeholder="SKU (ex.: 15-vaso-G)" value={skNome} onChange={e => setSkNome(e.target.value)} className={`${inputCls} flex-1 min-w-[180px]`} style={inputStyle} />
              <input placeholder="Gramas" type="number" value={skG} onChange={e => setSkG(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 90 }} />
              <input placeholder="Horas" type="number" value={skH} onChange={e => setSkH(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 90 }} />
              <input placeholder="Material" value={skMat} onChange={e => setSkMat(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 100 }} />
              <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
                onClick={() => mudar(() => api('/prod3d/skus', { method: 'POST', body: JSON.stringify({ sku: skNome, gramas: parseFloat(skG), horas: parseFloat(skH), material: skMat }) }), 'SKU cadastrado')
                  .then(() => { setSkNome(''); setSkG(''); setSkH('') })}>
                <Plus size={13} /> Cadastrar SKU
              </button>
            </div>
          </Secao>

          {/* Simulador */}
          <Secao icon={<FlaskConical size={15} />} titulo="Simulador — custo de 1 peça"
            nota="Digite o peso e o tempo do fatiador pra ver o custo de produção antes de cadastrar o SKU.">
            <div className="flex flex-wrap items-end gap-2">
              <input placeholder="Gramas" type="number" value={simG} onChange={e => setSimG(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 100 }} />
              <input placeholder="Horas" type="number" value={simH} onChange={e => setSimH(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 100 }} />
              <input placeholder="Material" value={simMat} onChange={e => setSimMat(e.target.value)} className={inputCls} style={{ ...inputStyle, width: 100 }} />
              <button disabled={simBusy} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}
                onClick={async () => {
                  setSimBusy(true)
                  try {
                    setSimRes(await api<NonNullable<SkuCusto>>('/prod3d/peca', {
                      method: 'POST', body: JSON.stringify({ gramas: parseFloat(simG), horas: parseFloat(simH), material: simMat }),
                    }))
                    setErro('')
                  } catch (e: unknown) { setErro((e as Error).message) } finally { setSimBusy(false) }
                }}>
                {simBusy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Calcular
              </button>
              {simRes && (
                <div className="ml-2 text-sm tabular-nums" style={{ color: '#fafafa' }}>
                  <b style={{ color: '#00E5FF' }}>{brl(simRes.total)}</b>
                  <span className="text-xs" style={{ color: '#71717a' }}>
                    {' '}({brl(simRes.por_grama)}/g · filamento {brl(simRes.filamento)} · máquina {brl(simRes.energia + simRes.depreciacao + simRes.manutencao)} · fixos {brl(simRes.fixo_rateado)} · embalagem {brl(simRes.embalagem)})
                  </span>
                </div>
              )}
            </div>
          </Secao>

          {/* Auditoria */}
          <Secao icon={erros.length ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />} titulo="Auditoria">
            {erros.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold" style={{ color: '#f87171' }}>Erros</div>
                <ul className="ml-4 list-disc text-xs" style={{ color: '#f87171' }}>{erros.map((p, i) => <li key={i}>{p[1]}</li>)}</ul>
              </div>
            )}
            {avisos.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Avisos</div>
                <ul className="ml-4 list-disc text-xs" style={{ color: '#a1a1aa' }}>{avisos.map((p, i) => <li key={i}>{p[1]}</li>)}</ul>
              </div>
            )}
            {estimados.length > 0 ? (
              <div>
                <div className="text-xs font-semibold" style={{ color: '#fafafa' }}>Valores estimados a confirmar ({estimados.length})</div>
                <ul className="ml-4 list-disc text-xs" style={{ color: '#a1a1aa' }}>{estimados.map((p, i) => <li key={i}>{p[1]}</li>)}</ul>
              </div>
            ) : !erros.length && !avisos.length && (
              <p className="text-sm" style={{ color: '#4ade80' }}>Tudo confirmado — nenhuma pendência. ✓</p>
            )}
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: '#71717a' }}>
              <History size={12} /> Toda alteração fica registrada na trilha de auditoria (quem, quando, de → para).
            </p>
          </Secao>
        </>
      )}
    </div>
  )
}
