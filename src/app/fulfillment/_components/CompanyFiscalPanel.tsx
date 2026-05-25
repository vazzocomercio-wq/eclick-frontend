'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Upload } from 'lucide-react'
import { fulfillmentApi, type CompanyFiscalConfig, type FiscalReadiness, type FiscalProvider, type RegimeTributario } from '../_lib/api'

type CertInfo = { status: string; expiresAt: string | null; daysToExpire: number | null; hasFile: boolean }

const PROVIDERS: Array<{ key: FiscalProvider; label: string }> = [
  { key: 'nfeio', label: 'NFe.io' }, { key: 'focusnfe', label: 'Focus NFe' }, { key: 'plugnotas', label: 'PlugNotas' }, { key: 'erp_externo', label: 'ERP externo' },
]
const REGIMES: Array<{ key: RegimeTributario; label: string }> = [
  { key: 'simples', label: 'Simples Nacional' }, { key: 'presumido', label: 'Lucro Presumido' }, { key: 'real', label: 'Lucro Real' },
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

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [c, r, ci] = await Promise.all([fulfillmentApi.companyFiscal(companyId), fulfillmentApi.fiscalReadiness(companyId), fulfillmentApi.certificateInfo(companyId)])
      setCfg(c); setReady(r); setCert(ci); setErr(null)
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
  useEffect(() => { void reload() }, [reload])

  async function save(patch: Record<string, unknown>) {
    try { await fulfillmentApi.upsertCompanyFiscal(companyId, patch); setReady(await fulfillmentApi.fiscalReadiness(companyId)) }
    catch (e) { setErr((e as Error).message) }
  }
  const addr = (cfg?.fiscal_address ?? {}) as Record<string, string>
  const saveAddr = (k: string, v: string) => save({ fiscalAddress: { ...addr, [k]: v } })

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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Lbl t="Cidade"><input defaultValue={addr.city ?? ''} onBlur={(e) => saveAddr('city', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
        <Lbl t="UF"><input defaultValue={addr.uf ?? ''} maxLength={2} onBlur={(e) => saveAddr('uf', e.target.value.toUpperCase())} className="w-full rounded-lg px-2 py-1.5 text-center text-sm uppercase outline-none" style={inp} /></Lbl>
        <Lbl t="CEP"><input defaultValue={addr.zip ?? ''} onBlur={(e) => saveAddr('zip', e.target.value)} className="w-full rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></Lbl>
      </div>

      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: '#52525b' }}><ShieldCheck size={12} /> O token é guardado criptografado. O certificado A1 fica no painel do provedor — o e-Click não armazena o arquivo.</p>
    </div>
  )
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10px]" style={{ color: '#71717a' }}>{t}</span>{children}</label>
}
