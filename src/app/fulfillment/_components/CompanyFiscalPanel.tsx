'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Upload, FileText } from 'lucide-react'
import { fulfillmentApi, getToken, BACKEND, type CompanyFiscalConfig, type FiscalReadiness, type FiscalProvider, type RegimeTributario } from '../_lib/api'

type CertInfo = { status: string; expiresAt: string | null; daysToExpire: number | null; hasFile: boolean }

const PROVIDERS: Array<{ key: FiscalProvider; label: string }> = [
  { key: 'nfeio', label: 'NFe.io' }, { key: 'focusnfe', label: 'Focus NFe' }, { key: 'plugnotas', label: 'PlugNotas' }, { key: 'erp_externo', label: 'ERP externo' },
]
const REGIMES: Array<{ key: RegimeTributario; label: string }> = [
  { key: 'mei', label: 'MEI' }, { key: 'simples', label: 'Simples Nacional' }, { key: 'presumido', label: 'Lucro Presumido' }, { key: 'real', label: 'Lucro Real' },
]
const inp = { background: '#09090b', color: '#fafafa', border: '1px solid rgba(255,255,255,0.08)' } as const

/**
 * Config fiscal (NF-e) de UMA empresa (CNPJ) — Faturador F1. Provedor + ambiente
 * + token (criptografado no backend) + IE + regime + % padrão + status do
 * certificado + endereço. NÃO emite ainda; mostra o que falta pra poder emitir.
 */
export function CompanyFiscalPanel({ companyId }: { companyId: string }) {
  const [cfg, setCfg] = useState<CompanyFiscalConfig | null>(null)
  const [ready, setReady] = useState<FiscalReadiness | null>(null)
  const [cert, setCert] = useState<CertInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [pfxB64, setPfxB64] = useState('')
  const [pfxName, setPfxName] = useState('')
  const [certPwd, setCertPwd] = useState('')
  const [certBusy, setCertBusy] = useState(false)
  const [sefaz, setSefaz] = useState<{ ok: boolean; cStat: string | null; xMotivo: string | null; uf: string; ambiente: string } | null>(null)
  const [sefazBusy, setSefazBusy] = useState(false)
  const [emit, setEmit] = useState<{ authorized: boolean; cStat: string | null; xMotivo: string | null; chave: string | null; protocolo: string | null } | null>(null)
  const [emitBusy, setEmitBusy] = useState(false)
  const [addr, setAddr] = useState<Record<string, string>>({})
  // F2b-3 — emissão real por pedido
  const [orderSn, setOrderSn] = useState('')
  const [orderEmit, setOrderEmit] = useState<{ authorized: boolean; dryRun?: boolean; cStat: string | null; xMotivo: string | null; chave: string | null; protocolo: string | null; nNF: number | null; serie?: number; xml?: string } | null>(null)
  const [orderBusy, setOrderBusy] = useState<'dry' | 'emit' | null>(null)
  // override do destinatário (quando a Shopee mascara o endereço — ver no detalhe do pedido)
  const [showDest, setShowDest] = useState(false)
  const [dest, setDest] = useState<Record<string, string>>({})
  const setD = (k: string, v: string) => setDest((p) => ({ ...p, [k]: v }))
  // F2b-4 — coletor de endereços (bookmarklet que roda na tela da Shopee)
  const [coletor, setColetor] = useState<string | null>(null)
  const [coletorBusy, setColetorBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [c, r, ci] = await Promise.all([fulfillmentApi.companyFiscal(companyId), fulfillmentApi.fiscalReadiness(companyId), fulfillmentApi.certificateInfo(companyId)])
      setCfg(c); setReady(r); setCert(ci); setAddr((c?.fiscal_address ?? {}) as Record<string, string>); setErr(null)
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [companyId])

  function onPickFile(f: File | undefined) {
    if (!f) return
    setPfxName(f.name)
    const reader = new FileReader()
    reader.onload = () => setPfxB64(String(reader.result || ''))
    reader.readAsDataURL(f)
  }
  async function sendCert() {
    if (!pfxB64) return
    setCertBusy(true); setErr(null)
    try {
      await fulfillmentApi.uploadCertificate(companyId, { pfxBase64: pfxB64, password: certPwd })
      setPfxB64(''); setPfxName(''); setCertPwd('')
      await reload()
    } catch (e) { setErr((e as Error).message) } finally { setCertBusy(false) }
  }
  async function testSefaz() {
    setSefazBusy(true); setErr(null); setSefaz(null)
    try { setSefaz(await fulfillmentApi.sefazStatus(companyId)) }
    catch (e) { setErr((e as Error).message) } finally { setSefazBusy(false) }
  }
  async function emitTestNfe() {
    setEmitBusy(true); setErr(null); setEmit(null)
    try { setEmit(await fulfillmentApi.emitTestNfe(companyId)) }
    catch (e) { setErr((e as Error).message) } finally { setEmitBusy(false) }
  }
  /** Monta o bookmarklet do coletor: carrega o script do e-Click e injeta a URL
   *  da API + o token da sessão. Roda na página da Shopee (a Open API mascara o
   *  endereço até o despacho, que por sua vez exige a NF-e). */
  async function gerarColetor() {
    setColetorBusy(true); setErr(null)
    try {
      const tk = await getToken()
      if (!tk) throw new Error('Sessão expirada — recarregue a página e entre de novo.')
      const src = `${window.location.origin}/coletor-shopee.js`
      const js = `(function(){window.__ECLICK_API__=${JSON.stringify(BACKEND)};window.__ECLICK_TOKEN__=${JSON.stringify(tk)};var s=document.createElement('script');s.src=${JSON.stringify(src)}+'?v='+Date.now();document.body.appendChild(s);})()`
      setColetor('javascript:' + encodeURIComponent(js))
    } catch (e) { setErr((e as Error).message) } finally { setColetorBusy(false) }
  }

  async function emitOrder(dryRun: boolean) {
    if (!orderSn.trim()) return
    // emissão de verdade é irreversível (consome número da série) — confirmar
    if (!dryRun && !window.confirm(`Emitir NF-e REAL do pedido ${orderSn.trim()} em ${cfg?.environment === 'producao' ? 'PRODUÇÃO' : 'homologação'}?`)) return
    setOrderBusy(dryRun ? 'dry' : 'emit'); setErr(null); setOrderEmit(null)
    // só manda os campos preenchidos do override
    const cleanDest = Object.fromEntries(Object.entries(dest).filter(([, v]) => v?.trim()))
    const destArg = Object.keys(cleanDest).length ? cleanDest : undefined
    try { setOrderEmit(await fulfillmentApi.emitOrderNfe(orderSn.trim(), dryRun, destArg)) }
    catch (e) {
      const msg = (e as Error).message
      // a Shopee mascara o endereço até organizar o envio → abre o formulário manual
      if (/ENDERECO_INCOMPLETO|CPF\/CNPJ do comprador/i.test(msg)) setShowDest(true)
      setErr(msg)
    } finally { setOrderBusy(null) }
  }
  useEffect(() => { void reload() }, [reload])

  // Salva e REFETCHA o cfg — sem isso o <select> controlado (regime/provedor/
  // ambiente) volta pro valor antigo, parecendo que "não salvou".
  async function save(patch: Record<string, unknown>) {
    try {
      await fulfillmentApi.upsertCompanyFiscal(companyId, patch)
      const [c, r] = await Promise.all([fulfillmentApi.companyFiscal(companyId), fulfillmentApi.fiscalReadiness(companyId)])
      setCfg(c); setReady(r); setErr(null)
    } catch (e) { setErr((e as Error).message) }
  }
  // Endereço é jsonb único: acumula no estado local (síncrono) pra um campo não
  // sobrescrever o outro, e salva o objeto inteiro.
  function saveAddr(k: string, v: string) {
    const next = { ...addr, [k]: v }
    setAddr(next)
    save({ fiscalAddress: next })
  }

  if (loading) return <div className="grid place-items-center py-4"><Loader2 size={18} className="animate-spin" color="#00E5FF" /></div>

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl p-3" style={{ background: '#09090b', border: '1px solid rgba(0,229,255,0.18)' }}>
      {err && <div className="rounded-lg p-2 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>{err}</div>}

      {/* readiness */}
      {ready && (
        <div className="flex items-start gap-2 rounded-lg p-2 text-xs" style={{ background: ready.ready ? 'rgba(74,222,80,0.10)' : 'rgba(245,158,11,0.10)', color: ready.ready ? '#4ADE50' : '#fcd34d' }}>
          {ready.ready ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertTriangle size={14} className="mt-0.5" />}
          <span>{ready.ready ? 'Pronta pra emitir NF-e.' : `Falta: ${ready.missing.join(', ')}`}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Lbl t="Provedor"><select value={cfg?.provider ?? ''} onChange={(e) => save({ provider: e.target.value || null })} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}><option value="">—</option>{PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Lbl>
        <Lbl t="Ambiente"><select value={cfg?.environment ?? 'homologacao'} onChange={(e) => save({ environment: e.target.value })} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}><option value="homologacao">Homologação (teste)</option><option value="producao">Produção</option></select></Lbl>
      </div>

      <Lbl t={`Token do provedor ${cfg?.has_provider_token ? '(configurado ✓ — preencha pra trocar)' : ''}`}>
        <div className="flex gap-2">
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg?.has_provider_token ? '••••••••' : 'cole o token da API'} className="flex-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} />
          <button onClick={() => { if (token.trim() && cfg?.provider) { save({ provider: cfg.provider, providerToken: token.trim() }); setToken('') } }} disabled={!token.trim() || !cfg?.provider} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#00E5FF', color: '#04222a' }}>Salvar</button>
        </div>
      </Lbl>

      <div className="grid grid-cols-2 gap-2">
        <Lbl t="Inscrição Estadual"><input defaultValue={cfg?.inscricao_estadual ?? ''} onBlur={(e) => save({ inscricaoEstadual: e.target.value })} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="Regime tributário"><select value={cfg?.regime_tributario ?? ''} onChange={(e) => save({ regimeTributario: e.target.value || null })} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}><option value="">—</option>{REGIMES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Lbl>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Lbl t="% venda (padrão)"><input type="number" min={0} max={100} defaultValue={cfg?.invoice_sale_pct ?? 100} onBlur={(e) => save({ invoiceSalePct: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 text-center text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="% compra (padrão)"><input type="number" min={0} max={100} defaultValue={cfg?.invoice_purchase_pct ?? 100} onBlur={(e) => save({ invoicePurchasePct: Number(e.target.value) })} className="w-full rounded-lg px-2 py-1.5 text-center text-sm outline-none" style={inp} /></Lbl>
      </div>

      {/* Certificado A1 (emissão direta — sobe o arquivo aqui, guardado criptografado) */}
      <div className="rounded-lg p-2.5" style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold" style={{ color: '#a1a1aa' }}><ShieldCheck size={13} /> Certificado A1 (.pfx)</div>
        {cert?.hasFile && cert.status !== 'expired' ? (
          <p className="text-xs" style={{ color: '#4ADE50' }}>✓ Certificado válido{cert.expiresAt ? ` até ${new Date(cert.expiresAt).toLocaleDateString('pt-BR')}` : ''}{cert.daysToExpire != null ? ` (${cert.daysToExpire} dias)` : ''}. Suba outro pra trocar.</p>
        ) : cert?.status === 'expired' ? (
          <p className="text-xs" style={{ color: '#f87171' }}>⚠ Certificado vencido — suba um novo.</p>
        ) : (
          <p className="text-xs" style={{ color: '#71717a' }}>Nenhum certificado. Suba o A1 da empresa pra poder emitir direto.</p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#09090b', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Upload size={13} /> {pfxName || 'Escolher arquivo .pfx / .p12'}
            <input type="file" accept=".pfx,.p12" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
          </label>
          {pfxB64 && (
            <div className="flex gap-2">
              <input type="password" value={certPwd} onChange={(e) => setCertPwd(e.target.value)} placeholder="senha do certificado" className="flex-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} />
              <button onClick={sendCert} disabled={certBusy} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#04222a' }}>{certBusy ? <Loader2 size={13} className="animate-spin" /> : 'Enviar'}</button>
            </div>
          )}
          {/* F2b — testa a conexão com a SEFAZ usando o certificado */}
          {cert?.hasFile && (
            <div className="mt-1 flex items-center gap-2">
              <button onClick={testSefaz} disabled={sefazBusy} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#18181b', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
                {sefazBusy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Testar conexão SEFAZ
              </button>
              {sefaz && (
                <span className="text-xs font-semibold" style={{ color: sefaz.ok ? '#4ADE50' : '#fcd34d' }}>
                  {sefaz.ok ? '✓' : '⚠'} SEFAZ-{sefaz.uf} ({sefaz.ambiente}): {sefaz.cStat} {sefaz.xMotivo}
                </span>
              )}
            </div>
          )}
          {/* F2b-2 — emite uma NF-e de teste (homologação) ponta a ponta */}
          {cert?.hasFile && (
            <div className="mt-1 flex flex-col gap-1">
              <button onClick={emitTestNfe} disabled={emitBusy} className="flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#18181b', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
                {emitBusy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Emitir NF-e de teste (homologação)
              </button>
              {emit && (
                <span className="text-xs font-semibold leading-relaxed" style={{ color: emit.authorized ? '#4ADE50' : '#fcd34d' }}>
                  {emit.authorized ? '✓ Autorizada!' : '⚠'} cStat {emit.cStat}: {emit.xMotivo}
                  {emit.chave ? <><br />Chave: {emit.chave}</> : null}
                  {emit.protocolo ? ` · Protocolo: ${emit.protocolo}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* F2b-3 — emissão REAL: NF-e de um pedido do marketplace (nº do pedido na Shopee) */}
      {cert?.hasFile && (
        <div className="rounded-lg p-2.5" style={{ background: '#0c0c10', border: '1px solid rgba(0,229,255,0.18)' }}>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold" style={{ color: '#00E5FF' }}><FileText size={13} /> Emitir NF-e de pedido</div>
          <p className="mb-2 text-[11px]" style={{ color: '#71717a' }}>Cole o nº do pedido do marketplace (ex: 2608246F7GWX2B). "Ver prévia" monta o XML sem emitir; "Emitir" assina e envia à SEFAZ no ambiente selecionado acima. Emita com o pedido em "A Enviar" — é a janela em que a Shopee abre CPF/endereço do comprador.</p>
          {/* Coletor de enderecos — a Shopee mascara o endereco na API ate o
              despacho (que exige a NF). O coletor le da tela do vendedor. */}
          <div className="mb-2 rounded-lg p-2" style={{ background: '#0a0a0e', border: '1px solid rgba(0,229,255,0.12)' }}>
            <div className="mb-1 text-[11px] font-semibold" style={{ color: '#a5f3fc' }}>1º passo — trazer os endereços da Shopee</div>
            <p className="mb-1.5 text-[10px] leading-relaxed" style={{ color: '#71717a' }}>
              A Shopee esconde o endereço do comprador na integração até o pedido ser despachado — e só deixa despachar depois da nota. O coletor resolve isso lendo os endereços na sua tela da Shopee, de uma vez, para todos os pedidos.
            </p>
            <button onClick={gerarColetor} disabled={coletorBusy} className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#18181b', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
              {coletorBusy ? <Loader2 size={13} className="animate-spin" /> : 'Preparar coletor de endereços'}
            </button>
            {coletor && (
              <div className="mt-2 flex flex-col gap-1.5">
                <a href={coletor} onClick={(e) => e.preventDefault()} draggable className="cursor-grab rounded-lg px-3 py-2 text-center text-xs font-bold" style={{ background: '#00E5FF', color: '#04222a' }}>
                  ⬇ Puxar endereços da Shopee
                </a>
                <ol className="ml-3 list-decimal text-[10px] leading-relaxed" style={{ color: '#a1a1aa' }}>
                  <li>Arraste o botão acima para a <b>barra de favoritos</b> do navegador (só na 1ª vez).</li>
                  <li>Abra a Shopee em <b>Meus Pedidos → A Enviar</b>.</li>
                  <li>Clique no favorito <b>Puxar endereços da Shopee</b> e espere o aviso verde.</li>
                  <li>Volte aqui e clique em <b>Emitir NF-e</b>.</li>
                </ol>
                <p className="text-[10px]" style={{ color: '#52525b' }}>Se disser que a sessão expirou, clique em Preparar coletor de novo e re-arraste.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input value={orderSn} onChange={(e) => setOrderSn(e.target.value)} placeholder="nº do pedido" className="flex-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} />
            <button onClick={() => emitOrder(true)} disabled={!orderSn.trim() || orderBusy != null} className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40" style={{ background: '#18181b', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.25)' }}>
              {orderBusy === 'dry' ? <Loader2 size={13} className="animate-spin" /> : 'Ver prévia'}
            </button>
            <button onClick={() => emitOrder(false)} disabled={!orderSn.trim() || orderBusy != null} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#00E5FF', color: '#04222a' }}>
              {orderBusy === 'emit' ? <Loader2 size={13} className="animate-spin" /> : 'Emitir NF-e'}
            </button>
          </div>

          {/* Override do destinatário — a Shopee mascara o endereço até organizar o
              envio (que exige a NF). Copie do "Verifique os detalhes" do pedido. */}
          <button onClick={() => setShowDest((v) => !v)} className="mt-2 text-[11px] underline" style={{ color: '#a5f3fc' }}>
            {showDest ? 'Ocultar' : 'Informar'} endereço do comprador (se a Shopee mascarou)
          </button>
          {showDest && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-lg p-2" style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px]" style={{ color: '#71717a' }}>Copie do detalhe do pedido na Shopee (&quot;Verifique os detalhes&quot;). Preencha só quando a prévia acusar endereço mascarado.</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input value={dest.name ?? ''} onChange={(e) => setD('name', e.target.value)} placeholder="Nome do comprador" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
                <input value={dest.doc ?? ''} onChange={(e) => setD('doc', e.target.value)} placeholder="CPF/CNPJ" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input value={dest.logradouro ?? ''} onChange={(e) => setD('logradouro', e.target.value)} placeholder="Logradouro" className="col-span-2 rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
                <input value={dest.numero ?? ''} onChange={(e) => setD('numero', e.target.value)} placeholder="Número" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
              </div>
              <input value={dest.complemento ?? ''} onChange={(e) => setD('complemento', e.target.value)} placeholder="Complemento (apto/bloco — opcional)" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
              <div className="grid grid-cols-4 gap-1.5">
                <input value={dest.bairro ?? ''} onChange={(e) => setD('bairro', e.target.value)} placeholder="Bairro" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
                <input value={dest.cidade ?? ''} onChange={(e) => setD('cidade', e.target.value)} placeholder="Cidade" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
                <input value={dest.uf ?? ''} maxLength={2} onChange={(e) => setD('uf', e.target.value.toUpperCase())} placeholder="UF" className="rounded-lg px-2 py-1.5 text-center text-xs uppercase outline-none" style={inp} />
                <input value={dest.cep ?? ''} onChange={(e) => setD('cep', e.target.value)} placeholder="CEP" className="rounded-lg px-2 py-1.5 text-xs outline-none" style={inp} />
              </div>
            </div>
          )}
          {orderEmit && (
            <div className="mt-2 text-xs font-semibold leading-relaxed" style={{ color: orderEmit.authorized ? '#4ADE50' : orderEmit.dryRun ? '#a5f3fc' : '#fcd34d' }}>
              {orderEmit.dryRun ? '👁 Prévia montada' : orderEmit.authorized ? '✓ AUTORIZADA!' : '⚠'} {orderEmit.cStat ? `cStat ${orderEmit.cStat}: ` : ''}{orderEmit.xMotivo}
              {orderEmit.nNF != null ? <><br />NF nº {orderEmit.nNF} · série {orderEmit.serie ?? 1}</> : null}
              {orderEmit.chave ? <><br />Chave: {orderEmit.chave}</> : null}
              {orderEmit.protocolo ? ` · Protocolo: ${orderEmit.protocolo}` : ''}
              {orderEmit.dryRun && orderEmit.xml ? (
                <button onClick={() => { const b = new Blob([orderEmit.xml!], { type: 'application/xml' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `previa-${orderSn.trim()}.xml`; a.click(); URL.revokeObjectURL(u) }} className="mt-1 block rounded-lg px-2 py-1 text-[11px]" style={{ background: '#18181b', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>Baixar XML da prévia</button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Lbl t="Logradouro"><input defaultValue={addr.logradouro ?? ''} onBlur={(e) => saveAddr('logradouro', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="Número"><input defaultValue={addr.numero ?? ''} onBlur={(e) => saveAddr('numero', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="Bairro"><input defaultValue={addr.bairro ?? ''} onBlur={(e) => saveAddr('bairro', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Lbl t="Cidade"><input defaultValue={addr.city ?? ''} onBlur={(e) => saveAddr('city', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="UF"><input defaultValue={addr.uf ?? ''} maxLength={2} onBlur={(e) => saveAddr('uf', e.target.value.toUpperCase())} className="w-full rounded-lg px-2 py-1.5 text-center text-sm uppercase outline-none" style={inp} /></Lbl>
        <Lbl t="CEP"><input defaultValue={addr.cep ?? ''} onBlur={(e) => saveAddr('cep', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
      </div>
      <Lbl t="Cód. IBGE do município (7 dígitos)"><input defaultValue={addr.cMun ?? ''} maxLength={7} onBlur={(e) => saveAddr('cMun', e.target.value.replace(/\D/g, ''))} placeholder="ex: 3518800 (Guarulhos)" className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>

      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#52525b' }}><ShieldCheck size={12} /> O token é guardado criptografado. O certificado A1 fica no painel do provedor — o e-Click não armazena o arquivo.</p>
    </div>
  )
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px]" style={{ color: '#71717a' }}>{t}</span>{children}</label>
}
