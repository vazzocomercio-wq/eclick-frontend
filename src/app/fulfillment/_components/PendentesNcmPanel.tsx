'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Save, Wand2, AlertTriangle, PackageCheck, Info, Boxes } from 'lucide-react'
import { fulfillmentApi, type PendentesNcm, type ProdutoPendenteNcm } from '../_lib/api'

/**
 * CLASSIFICAÇÃO PENDENTE (F2b-9) — o buraco que trava a emissão.
 *
 * A NF-e recusa item sem NCM e um item derruba a NOTA INTEIRA. O catálogo herdou
 * NCM só do que é revenda (veio no import da NF-e de compra), então tudo que é
 * fabricação própria só aparecia na hora de faturar, um pedido por vez.
 *
 * Esta tela mostra o buraco todo de uma vez, ranqueado por quanto vende, com uma
 * sugestão herdada de um irmão JÁ classificado do próprio catálogo. A sugestão
 * preenche o campo mas NÃO grava: classificação fiscal é decisão do contador.
 */
const CIANO = '#00E5FF', VERDE = '#4ADE50', AMBAR = '#fcd34d', VERMELHO = '#f87171'
const TXT = '#FAFAFA', TXT2 = '#A1A1AA', TXT3 = '#71717A'
const CARD = { background: '#18181b', border: '1px solid #27272a' } as const
const inp = { background: '#09090b', color: TXT, border: '1px solid #27272a' } as const

const ORIGENS: Array<{ v: string; label: string }> = [
  { v: '0', label: '0 · Nacional' },
  { v: '1', label: '1 · Importado direto' },
  { v: '2', label: '2 · Importado no mercado interno' },
  { v: '3', label: '3 · Nacional, +40% importado' },
]

const soDigitos = (s: string) => s.replace(/\D/g, '').slice(0, 8)
const formataNcm = (s: string) => (s.length === 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6)}` : s)

export function PendentesNcmPanel() {
  const [dados, setDados] = useState<PendentesNcm | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  /** rascunho local: productId -> {ncm, origem}. Só o que está aqui é gravado. */
  const [draft, setDraft] = useState<Record<string, { ncm: string; origem: string }>>({})

  const carregar = useCallback(async () => {
    setLoading(true)
    try { setDados(await fulfillmentApi.pendentesNcm(120)); setErr(null) }
    catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const itens = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const lista = dados?.itens ?? []
    if (!q) return lista
    return lista.filter((i) => `${i.sku ?? ''} ${i.nome ?? ''}`.toLowerCase().includes(q))
  }, [dados, busca])

  const prontos = useMemo(
    () => Object.entries(draft).filter(([, v]) => v.ncm.length === 8),
    [draft],
  )
  /** quantos dos que vão ser gravados vieram do palpite mais fraco (nome parecido) */
  const fracos = useMemo(() => {
    const porId = new Map((dados?.itens ?? []).map((i) => [i.productId, i.sugestao]))
    return prontos.filter(([id, v]) => {
      const s = porId.get(id)
      return s?.base === 'nome' && s.ncm === v.ncm
    }).length
  }, [prontos, dados])

  function setLinha(id: string, patch: Partial<{ ncm: string; origem: string }>) {
    setDraft((p) => ({ ...p, [id]: { ...{ ncm: '', origem: '0' }, ...p[id], ...patch } }))
  }

  /** Preenche o campo com a sugestão — não grava. O usuário revisa e salva. */
  function usarSugestao(i: ProdutoPendenteNcm) {
    if (!i.sugestao) return
    setLinha(i.productId, { ncm: i.sugestao.ncm, origem: i.sugestao.origem ?? '0' })
  }
  /**
   * Preenche em massa SÓ as sugestões de categoria (muitos irmãos concordando).
   * As por nome parecido ficam de fora de propósito: a margem entre um palpite
   * certo e um errado ali é fina, e um clique nao pode carimbar 7 classificacoes
   * que ninguem leu. Essas exigem o clique na propria linha.
   */
  const emMassa = useMemo(() => itens.filter((i) => i.sugestao?.base === 'categoria'), [itens])
  function preencherTodas() {
    const novo = { ...draft }
    for (const i of emMassa) {
      if (!i.sugestao || novo[i.productId]?.ncm) continue
      novo[i.productId] = { ncm: i.sugestao.ncm, origem: i.sugestao.origem ?? '0' }
    }
    setDraft(novo)
  }

  async function salvar() {
    if (prontos.length === 0) return
    setSalvando(true); setErr(null); setOk(null)
    try {
      const r = await fulfillmentApi.salvarFiscalProdutos(prontos.map(([productId, v]) => ({
        productId, ncm: v.ncm, origem: v.origem, cfop_sale: '5102', cst_csosn: '102', unit: 'UN',
      })))
      setOk(`${r.gravados} produto(s) classificado(s). Os pedidos que dependiam deles já podem ser faturados.`)
      setDraft({})
      await carregar()
    } catch (e) { setErr((e as Error).message) } finally { setSalvando(false) }
  }

  const r = dados?.resumo

  return (
    <div className="flex flex-col gap-4">
      {err && <div className="rounded-xl p-3 text-sm" style={{ background: `${VERMELHO}1a`, color: VERMELHO, border: `1px solid ${VERMELHO}44` }}>{err}</div>}
      {ok && <div className="rounded-xl p-3 text-sm" style={{ background: `${VERDE}1a`, color: VERDE, border: `1px solid ${VERDE}44` }}>{ok}</div>}

      {/* o tamanho do buraco */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { t: 'Sem NCM', v: String(r?.pendentes ?? 0), c: r?.pendentes ? AMBAR : VERDE },
          { t: 'Pedidos travados', v: String(r?.pedidosTravados ?? 0), c: r?.pedidosTravados ? VERMELHO : VERDE },
          { t: 'Produtos que vendem', v: String(r?.produtosVendidos ?? 0), c: TXT },
        ].map((k) => (
          <div key={k.t} className="rounded-xl p-3" style={CARD}>
            <div className="text-xl font-bold tabular-nums" style={{ color: k.c }}>{k.v}</div>
            <div className="text-[11px]" style={{ color: TXT3 }}>{k.t}</div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl p-3 text-[11px] leading-relaxed" style={{ background: '#121214', border: '1px solid #27272a', color: TXT2 }}>
        <Info size={13} className="mt-0.5 shrink-0" color={CIANO} />
        <span>
          A NF-e recusa item sem NCM, e <b style={{ color: TXT }}>um item sem classificação derruba a nota inteira</b> — até as linhas que estão ok.
          A sugestão vem de um produto <b style={{ color: TXT }}>irmão já classificado no seu catálogo</b> (mesma categoria) e serve pra você não começar do zero:
          ela preenche o campo, mas <b style={{ color: AMBAR }}>quem bate o martelo na classificação é o seu contador</b>. Nada é gravado sem você clicar em salvar.
        </span>
      </div>

      {/* busca + preencher tudo */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search size={13} className="absolute left-2.5 top-2.5" color={TXT3} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="SKU ou nome do produto"
            className="w-full rounded-lg py-2 pl-8 pr-2 text-sm outline-none" style={inp} />
        </label>
        <button onClick={preencherTodas} disabled={loading || emMassa.length === 0}
          title="Preenche as sugestões apoiadas por vários produtos da mesma categoria. As baseadas em nome parecido ficam de fora — essas você aceita uma a uma."
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 hover:brightness-125 disabled:opacity-40"
          style={{ background: '#09090b', color: AMBAR, border: `1px solid ${AMBAR}44` }}>
          <Wand2 size={13} /> Preencher as {emMassa.length} de categoria
        </button>
      </div>

      {/* lista */}
      {loading ? (
        <div className="flex animate-pulse flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl" style={CARD} />)}
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center" style={CARD}>
          <PackageCheck size={28} className="mx-auto mb-3" color={busca ? '#3f3f46' : VERDE} />
          <p className="text-sm font-semibold" style={{ color: TXT2 }}>
            {busca ? 'Nenhum produto com esse termo.' : 'Nenhum produto pendente.'}
          </p>
          <p className="mt-1 text-xs" style={{ color: TXT3 }}>
            {busca ? 'Limpe a busca pra ver a lista toda.' : 'Todo produto que vendeu nos últimos 120 dias já tem NCM.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 pb-20">
          {itens.map((i) => {
            const d = draft[i.productId]
            const preenchido = (d?.ncm ?? '').length === 8
            const igualSugestao = preenchido && d?.ncm === i.sugestao?.ncm
            return (
              <div key={i.productId} className="rounded-xl px-4 py-3"
                style={{ ...CARD, borderLeftWidth: 3, borderLeftColor: preenchido ? VERDE : (i.pedidos > 0 ? AMBAR : '#3f3f46') }}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-xs font-bold" style={{ color: CIANO }}>{i.sku ?? '—'}</span>
                      <span className="text-sm" style={{ color: TXT }}>{i.nome ?? '—'}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: TXT3 }}>
                      <span style={{ color: i.pedidos > 0 ? AMBAR : TXT3 }}>
                        {i.pedidos > 0 ? `${i.pedidos} pedido${i.pedidos > 1 ? 's' : ''} em 120 dias` : 'sem venda direta'}
                      </span>
                      {i.receita > 0 && <><span>·</span><span>R$ {i.receita.toFixed(2)}</span></>}
                      {i.viaKit.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1" style={{ color: TXT2 }}>
                            <Boxes size={10} /> componente de {i.viaKit.map((k) => k.sku ?? '?').join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <input
                      value={formataNcm(d?.ncm ?? '')}
                      onChange={(e) => setLinha(i.productId, { ncm: soDigitos(e.target.value) })}
                      placeholder="NCM (8 dígitos)" inputMode="numeric"
                      className="w-[130px] rounded-lg px-2 py-1.5 text-sm tabular-nums outline-none"
                      style={{ ...inp, borderColor: preenchido ? `${VERDE}66` : '#27272a', color: preenchido ? VERDE : TXT }} />
                    <select value={d?.origem ?? i.sugestao?.origem ?? '0'} onChange={(e) => setLinha(i.productId, { origem: e.target.value })}
                      className="w-[150px] rounded-lg px-2 py-1.5 text-xs outline-none" style={inp}>
                      {ORIGENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* sugestão herdada do irmão */}
                {i.sugestao ? (
                  <button onClick={() => usarSugestao(i)} disabled={igualSugestao}
                    className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors duration-150 hover:brightness-125 disabled:cursor-default disabled:opacity-50"
                    style={{ background: '#09090b', border: `1px solid ${igualSugestao ? VERDE : AMBAR}33`, color: igualSugestao ? VERDE : AMBAR }}>
                    <Wand2 size={11} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {igualSugestao ? 'usando' : 'usar'} <b>{formataNcm(i.sugestao.ncm)}</b>
                      <span style={{ color: TXT3 }}>
                        {' '}— {i.sugestao.base === 'categoria'
                          ? `${i.sugestao.irmaos} produto${i.sugestao.irmaos > 1 ? 's' : ''} da mesma categoria`
                          : 'produto de nome parecido'}
                        {i.sugestao.exemplo ? `: ${i.sugestao.exemplo}` : ''}
                      </span>
                    </span>
                  </button>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: TXT3 }}>
                    <AlertTriangle size={11} /> Sem irmão classificado nessa categoria — esse aqui precisa vir do contador.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* barra de salvar — fixa, some quando não há nada pra gravar */}
      {prontos.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 shadow-lg"
          style={{ background: '#18181b', border: `1px solid ${VERDE}55` }}>
          <span className="text-xs" style={{ color: TXT2 }}>
            <b style={{ color: VERDE }}>{prontos.length}</b> produto(s) prontos pra gravar
            {fracos > 0 && (
              <span className="ml-1 inline-flex items-center gap-1" style={{ color: AMBAR }}>
                <AlertTriangle size={11} /> {fracos} veio de nome parecido — confira
              </span>
            )}
          </span>
          <button onClick={salvar} disabled={salvando}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-colors duration-150 hover:brightness-110 disabled:opacity-50"
            style={{ background: VERDE, color: '#052e12' }}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Gravar classificação
          </button>
        </div>
      )}
    </div>
  )
}
