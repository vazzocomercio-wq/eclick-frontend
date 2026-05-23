'use client'

/**
 * Ambientador IA — "Veja no seu espaço" (AH).
 *
 * Botão + modal na página de produto da vitrine. Fluxo:
 *   1. intro    — explica + dá dicas de como fotografar o ambiente
 *   2. register — cadastro (nome, e-mail, WhatsApp) → manda OTP
 *   3. otp      — cliente digita o código recebido no WhatsApp
 *   4. capture  — tira/sobe a foto do ambiente (câmera traseira no celular)
 *   5. result   — 2 imagens geradas (também enviadas no WhatsApp) + créditos
 *
 * Gate: só libera a captura depois do WhatsApp validado. O token do cliente
 * fica no localStorage (por loja) e identifica nas chamadas seguintes.
 *
 * Mobile-first: modal full-screen no celular, card centralizado no desktop.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Sparkles, Camera, Loader2, X, CheckCircle2, ArrowLeft, RefreshCcw,
  ShieldCheck, Lightbulb,
} from 'lucide-react'
import { ProductKitsClient } from './sections/ProductKitsClient'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Step = 'intro' | 'register' | 'otp' | 'capture' | 'generating' | 'result'

interface PublicCustomer {
  id: string; name: string | null; whatsappValidated: boolean
  generationsAllowed: number; generationsUsed: number; generationsLeft: number
}

export function RoomVisualizerLauncher({ slug, productId, productName, productCategory }: {
  slug: string; productId: string; productName: string; productCategory?: string | null
}) {
  const [enabled, setEnabled] = useState(false)
  const [buttonLabel, setButtonLabel] = useState('Veja no seu ambiente')
  const [open, setOpen] = useState(false)

  // Descobre se a loja ativou o recurso (1 request, esconde se off)
  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/config`)
        if (!res.ok) return
        const d = await res.json() as { enabled: boolean; buttonLabel: string }
        if (cancel) return
        setEnabled(Boolean(d.enabled))
        if (d.buttonLabel) setButtonLabel(d.buttonLabel)
      } catch { /* silent */ }
    })()
    return () => { cancel = true }
  }, [slug])

  if (!enabled) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12, width: '100%', padding: '14px 20px', minHeight: 48,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'transparent', color: 'var(--c-primary)',
          border: '1.5px solid var(--c-primary)', borderRadius: 'var(--r)',
          cursor: 'pointer', fontWeight: 600, fontSize: 15,
        }}>
        <Sparkles size={18} /> {buttonLabel}
      </button>
      {open && (
        <RoomVisualizerModal
          slug={slug} productId={productId} productName={productName} productCategory={productCategory}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function tokenKey(slug: string) { return `eclick_visualizer_token_${slug}` }

function RoomVisualizerModal({ slug, productId, productName, productCategory, onClose }: {
  slug: string; productId: string; productName: string; productCategory?: string | null; onClose: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<PublicCustomer | null>(null)

  // cadastro
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  // captura/resultado
  const [scene, setScene] = useState<{ dataUrl: string; width: number; height: number } | null>(null)
  const [results, setResults] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // provador de cor/acabamento (variantes)
  const [variants, setVariants] = useState<Array<{ productId: string; name: string; label: string | null; imageUrl: string | null }>>([])
  const [recoloring, setRecoloring] = useState<string | null>(null)

  const token = useCallback(() => {
    try { return localStorage.getItem(tokenKey(slug)) } catch { return null }
  }, [slug])

  // Carrega as variantes de cor/acabamento ao chegar no resultado.
  useEffect(() => {
    if (step !== 'result') return
    let cancel = false
    void (async () => {
      try {
        const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/variants`)
        if (!res.ok) return
        const d = await res.json() as Array<{ productId: string; name: string; label: string | null; imageUrl: string | null }>
        if (!cancel) setVariants(Array.isArray(d) ? d : [])
      } catch { /* silent */ }
    })()
    return () => { cancel = true }
  }, [step, slug, productId])

  // Provador: recolore a cena atual pra uma variante (gasta 1 crédito).
  const doRecolor = async (variantProductId: string) => {
    const t = token()
    if (!t) { setStep('register'); return }
    setError(null); setRecoloring(variantProductId)
    try {
      const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/recolor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Visualizer-Token': t },
        body: JSON.stringify({ baseProductId: productId, variantProductId }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.message ?? 'Não consegui trocar a cor agora.')
      const imgs = (d.images ?? []) as string[]
      setResults(prev => [...imgs, ...prev])   // variante recolorida aparece no topo
      setCustomer(c => c ? { ...c, generationsLeft: d.generationsLeft, generationsUsed: c.generationsUsed + 1 } : c)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRecoloring(null)
    }
  }

  // Se já tem token válido, pula direto pra captura
  useEffect(() => {
    const t = token()
    if (!t) return
    void (async () => {
      try {
        const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/me`, {
          headers: { 'X-Visualizer-Token': t },
        })
        if (!res.ok) return
        const c = await res.json() as PublicCustomer
        setCustomer(c)
        setStep('capture')
      } catch { /* fica no intro */ }
    })()
  }, [slug, token])

  const startRegister = () => { setError(null); setStep(token() ? 'capture' : 'register') }

  /** Chama o register e devolve se o código de fato saiu pelo WhatsApp.
   *  `otpSent === false` = código gerado, mas o canal de WhatsApp está
   *  indisponível agora (ponte fora do ar). Não mentimos pro cliente. */
  const doRegister = async (): Promise<{ otpSent: boolean }> => {
    const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.replace(/\D/g, ''), consent }),
    })
    const d = await res.json().catch(() => null)
    if (!res.ok) throw new Error(d?.message ?? 'Não foi possível enviar o código.')
    return { otpSent: d?.otpSent !== false }
  }

  const submitRegister = async () => {
    setError(null); setResendMsg(null)
    if (!name.trim() || !email.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Preencha nome, e-mail e WhatsApp com DDD.')
      return
    }
    if (!consent) { setError('É preciso aceitar o uso dos seus dados e da foto para continuar.'); return }
    setBusy(true)
    try {
      const { otpSent } = await doRegister()
      if (!otpSent) {
        // Código não saiu pelo WhatsApp — não jogamos o cliente numa tela de
        // código vazia. Mantemos no cadastro com aviso honesto + opção de tentar.
        setError('Não conseguimos enviar o código pelo seu WhatsApp agora. Confira o número e tente de novo em instantes.')
        return
      }
      setStep('otp')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const resendCode = async () => {
    setError(null); setResendMsg(null)
    setBusy(true)
    try {
      const { otpSent } = await doRegister()
      if (!otpSent) {
        setError('Ainda não conseguimos enviar pelo WhatsApp. Tente mais tarde ou fale com a loja pelo WhatsApp.')
        return
      }
      setResendMsg('Código reenviado! Confira seu WhatsApp.')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const submitOtp = async () => {
    setError(null)
    if (code.replace(/\D/g, '').length !== 6) { setError('Digite o código de 6 dígitos.'); return }
    setBusy(true)
    try {
      const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), code: code.replace(/\D/g, '') }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.message ?? 'Código incorreto.')
      try { localStorage.setItem(tokenKey(slug), d.token) } catch { /* ignore */ }
      setCustomer(d.customer as PublicCustomer)
      setStep('capture')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const scaled = await fileToScaledBase64(file, 1280)
      setScene(scaled)
    } catch { setError('Não consegui ler essa imagem. Tente outra foto.') }
  }

  const generate = async () => {
    if (!scene) { setError('Tire ou escolha uma foto do ambiente.'); return }
    const t = token()
    if (!t) { setStep('register'); return }
    setError(null); setStep('generating'); setBusy(true)
    try {
      const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/visualizer/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Visualizer-Token': t },
        body: JSON.stringify({
          productId, productName,
          sceneImageBase64: scene.dataUrl,
          sceneWidth: scene.width, sceneHeight: scene.height,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.message ?? 'A IA não conseguiu gerar agora.')
      setResults((d.images ?? []) as string[])
      setCustomer(c => c ? { ...c, generationsLeft: d.generationsLeft, generationsUsed: c.generationsUsed + 1 } : c)
      setStep('result')
    } catch (e) {
      setError((e as Error).message)
      setStep('capture')
    } finally { setBusy(false) }
  }

  const resetForAnother = () => { setScene(null); setResults([]); setError(null); setStep('capture') }
  const left = customer?.generationsLeft ?? null

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      className="sm:items-center">
      <div onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto',
          background: 'var(--c-bg, #0a0a0e)', color: 'var(--c-text, #fafafa)',
          borderRadius: 'var(--r) var(--r) 0 0', fontFamily: 'var(--f-body)',
        }}
        className="sm:rounded-2xl">
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 1, padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--c-surface, #111)', borderBottom: '1px solid var(--c-border, #27272a)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontFamily: 'var(--f-heading)' }}>
            <Sparkles size={18} style={{ color: 'var(--c-primary)' }} /> Veja no seu ambiente
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {typeof left === 'number' && (
              <span style={{ fontSize: 12, color: 'var(--c-text-muted, #a1a1aa)' }}>{left} restante{left === 1 ? '' : 's'}</span>
            )}
            <button onClick={onClose} aria-label="Fechar"
              style={{ background: 'transparent', border: 0, color: 'var(--c-text-muted)', cursor: 'pointer', minHeight: 32, minWidth: 32 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {error && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          {step === 'intro' && (
            <div>
              <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                Tire uma foto do seu ambiente e a nossa IA mostra como o <strong style={{ color: 'var(--c-text)' }}>{productName}</strong> fica no seu espaço — fiel ao seu ambiente.
              </p>
              <div style={{ background: 'var(--c-surface, #18181b)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <p style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Lightbulb size={15} style={{ color: 'var(--c-primary)' }} /> Como tirar a melhor foto
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--c-text-muted)', fontSize: 13.5, lineHeight: 1.7 }}>
                  {captureTips(productCategory, productName).map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <ShieldCheck size={14} style={{ color: 'var(--c-primary)' }} /> Validamos seu WhatsApp uma única vez e enviamos as imagens lá.
              </p>
              <button onClick={startRegister} style={primaryBtn()}>Começar</button>
            </div>
          )}

          {step === 'register' && (
            <div>
              <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 14, fontSize: 14 }}>
                Pra liberar, confirme seus dados. Vamos mandar um código no seu WhatsApp.
              </p>
              <Label>Seu nome</Label>
              <Inp value={name} onChange={setName} placeholder="Nome completo" />
              <Label>E-mail</Label>
              <Inp value={email} onChange={setEmail} type="email" placeholder="voce@email.com" />
              <Label>WhatsApp (com DDD)</Label>
              <Inp value={phone} onChange={setPhone} type="tel" placeholder="(11) 99999-9999" />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, fontSize: 12.5, color: 'var(--c-text-muted)', lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--c-primary)' }} />
                <span>Autorizo o uso dos meus dados e da foto que eu enviar para gerar a ambientação e receber contato da loja pelo WhatsApp.</span>
              </label>
              <button onClick={submitRegister} disabled={busy || !consent} style={primaryBtn(busy || !consent)}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} Receber código no WhatsApp
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div>
              {resendMsg && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13, background: 'rgba(34,197,94,0.12)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}>
                  {resendMsg}
                </div>
              )}
              <p style={{ color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 14, fontSize: 14 }}>
                Enviamos um código de 6 dígitos no WhatsApp <strong style={{ color: 'var(--c-text)' }}>{phone}</strong>. Digite abaixo:
              </p>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" placeholder="______"
                style={{ ...inpStyle(), textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: 700 }} />
              <button onClick={submitOtp} disabled={busy} style={primaryBtn(busy)}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} Validar e continuar
              </button>
              <button onClick={resendCode} disabled={busy} style={ghostBtn()}>
                <RefreshCcw size={14} /> Não recebi o código — reenviar
              </button>
              <button onClick={() => { setStep('register'); setResendMsg(null) }} style={ghostBtn()}>
                <ArrowLeft size={14} /> Corrigir número
              </button>
            </div>
          )}

          {step === 'capture' && (
            <div>
              {typeof left === 'number' && left <= 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>Você usou todas as suas ambientações 🎨</p>
                  <p style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>Faça uma compra para ganhar mais gerações automaticamente.</p>
                </div>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                    onChange={e => onPickFile(e.target.files?.[0])} />
                  {scene ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={scene.dataUrl} alt="Seu ambiente"
                      style={{ width: '100%', borderRadius: 12, marginBottom: 12, display: 'block' }} />
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      style={{
                        width: '100%', minHeight: 200, borderRadius: 12, marginBottom: 12,
                        border: '2px dashed var(--c-border, #3f3f46)', background: 'var(--c-surface, #18181b)',
                        color: 'var(--c-text-muted)', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                      <Camera size={32} style={{ color: 'var(--c-primary)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>Tirar foto do ambiente</span>
                      <span style={{ fontSize: 12.5 }}>ou escolher da galeria</span>
                    </button>
                  )}
                  {scene && (
                    <button onClick={() => fileRef.current?.click()} style={ghostBtn()}>
                      <RefreshCcw size={14} /> Trocar foto
                    </button>
                  )}
                  <button onClick={generate} disabled={!scene || busy} style={primaryBtn(!scene || busy)}>
                    <Sparkles size={16} /> Gerar minha ambientação
                  </button>
                  {typeof left === 'number' && (
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8 }}>
                      Cada geração cria 2 imagens · {left} {left === 1 ? 'geração restante' : 'gerações restantes'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--c-primary)', margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 600 }}>Criando seu ambiente…</p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: 13.5, marginTop: 6 }}>Pode levar alguns segundos. Não feche esta janela.</p>
            </div>
          )}

          {step === 'result' && (
            <div>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 4 }}>
                <CheckCircle2 size={18} style={{ color: '#22c55e' }} /> Prontinho!
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: 13.5, marginBottom: 6 }}>
                Também enviamos as imagens no seu WhatsApp 📲
              </p>
              <p style={{ color: 'var(--c-text-muted)', fontSize: 12, marginBottom: 12 }}>
                Arraste a barra pra comparar <strong style={{ color: 'var(--c-text)' }}>antes</strong> e <strong style={{ color: 'var(--c-text)' }}>depois</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {results.map((u, i) => (
                  <div key={i}>
                    {scene
                      ? <BeforeAfter before={scene.dataUrl} after={u} />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={u} alt={`Ambientação ${i + 1}`} style={{ width: '100%', borderRadius: 10, display: 'block' }} />}
                    <a href={u} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 6, fontSize: 12.5, color: 'var(--c-primary)' }}>
                      Abrir imagem {i + 1} em tamanho cheio
                    </a>
                  </div>
                ))}
              </div>

              {/* Provador: ver o produto em outra cor/acabamento (variantes da loja). */}
              {variants.length > 0 && (
                <div style={{ borderTop: '1px solid var(--c-border, #27272a)', marginTop: 6, paddingTop: 12, marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={15} style={{ color: 'var(--c-primary)' }} /> Ver em outra cor
                  </p>
                  {typeof left === 'number' && left <= 0 ? (
                    <p style={{ fontSize: 12.5, color: 'var(--c-text-muted)' }}>Você usou suas gerações. Faça uma compra pra ver outras cores.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                        {variants.map(v => (
                          <button key={v.productId} onClick={() => doRecolor(v.productId)} disabled={recoloring !== null}
                            title={v.name}
                            style={{ flex: '0 0 auto', width: 72, background: 'transparent', border: 0, padding: 0, cursor: recoloring ? 'wait' : 'pointer' }}>
                            <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-border, #3f3f46)', position: 'relative', background: 'var(--c-surface, #18181b)' }}>
                              {v.imageUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={v.imageUrl} alt={v.label ?? v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                : null}
                              {recoloring === v.productId && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                                  <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} />
                                </div>
                              )}
                            </div>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4, textAlign: 'center', maxWidth: 72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.label || v.name}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>Cada troca de cor usa 1 geração.</p>
                    </>
                  )}
                </div>
              )}

              {/* Cross-sell: kits que contêm o produto ambientado. Some sozinho se não houver. */}
              <div style={{ borderTop: '1px solid var(--c-border, #27272a)', marginTop: 6, paddingTop: 12 }}>
                <ProductKitsClient
                  slug={slug}
                  productId={productId}
                  settings={{ filter: 'currentProduct', columns: { mobile: 1, tablet: 2, desktop: 2 }, limit: 3, showReasoning: false, title: 'Complete o ambiente' }}
                />
              </div>

              {typeof left === 'number' && left > 0 ? (
                <button onClick={resetForAnother} style={primaryBtn()}>
                  <Sparkles size={16} /> Gerar outra ({left} {left === 1 ? 'restante' : 'restantes'})
                </button>
              ) : (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-text-muted)' }}>
                  Você usou todas as suas ambientações. Faça uma compra pra ganhar mais!
                </p>
              )}
              <button onClick={onClose} style={ghostBtn()}>Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── UI helpers ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 4, marginTop: 10 }}>{children}</label>
}
function Inp({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder} style={inpStyle()} />
}
function inpStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '12px 14px', minHeight: 48, marginBottom: 2,
    background: 'var(--c-surface, #18181b)', color: 'var(--c-text, #fafafa)',
    border: '1px solid var(--c-border, #3f3f46)', borderRadius: 'var(--r, 8px)',
    fontSize: 16, fontFamily: 'var(--f-body)',
  }
}
function primaryBtn(disabled = false): React.CSSProperties {
  return {
    width: '100%', marginTop: 14, padding: '14px 20px', minHeight: 50,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--c-primary)', color: 'var(--c-on-accent)',
    border: 0, borderRadius: 'var(--r)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 15, opacity: disabled ? 0.6 : 1,
  }
}
function ghostBtn(): React.CSSProperties {
  return {
    width: '100%', marginTop: 8, padding: '10px 16px', minHeight: 40,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'transparent', color: 'var(--c-text-muted)',
    border: 0, cursor: 'pointer', fontSize: 13.5,
  }
}

/** Redimensiona a foto pro maior lado <= maxDim e devolve JPEG base64 + dims. */
async function fileToScaledBase64(file: File, maxDim: number): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  URL.revokeObjectURL(img.src)
  return { dataUrl, width: w, height: h }
}
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Dicas de captura adaptadas à categoria/nome do produto. */
function captureTips(category?: string | null, name?: string): string[] {
  const hay = `${category ?? ''} ${name ?? ''}`.toLowerCase()
  const has = (...ks: string[]) => ks.some(k => hay.includes(k))
  const base = ['Boa iluminação: abra as cortinas ou acenda as luzes.', 'Segure o celular firme e na horizontal.']
  if (has('lustre', 'pendente', 'plafon', 'luminár', 'luminar', 'arandela', 'spot', 'lâmpada', 'lampada', 'ilumin', 'abajur')) {
    return ['Fotografe o ambiente incluindo o teto onde a luminária vai ficar.', 'Afaste-se pra pegar a altura (pé-direito) do cômodo.', ...base]
  }
  if (has('tapete', 'rug', 'carpete', 'piso')) {
    return ['Fotografe o chão do ambiente, em pé, apontando levemente pra baixo.', 'Deixe livre o espaço do piso onde o item vai ficar.', ...base]
  }
  if (has('quadro', 'poster', 'pôster', 'painel', 'papel de parede', 'adesivo', 'espelho')) {
    return ['Fotografe a parede inteira onde o item vai ficar.', 'Fique de frente pra parede, a uns 2 metros.', ...base]
  }
  if (has('sofá', 'sofa', 'mesa', 'cadeira', 'poltrona', 'estante', 'rack', 'cama', 'armár', 'armar', 'móvel', 'movel', 'aparador', 'buffet')) {
    return ['Fotografe o canto do cômodo onde o móvel vai ficar.', 'Afaste-se ~2 metros pra pegar o espaço inteiro.', 'Deixe o local livre.', ...base]
  }
  return [
    'Segure o celular na horizontal e capture a parede/cantinho inteiro.',
    'Afaste-se ~2 metros pra pegar todo o espaço onde o produto vai ficar.',
    'Deixe livre o local onde quer ver o produto.',
    'Boa iluminação: abra as cortinas ou acenda as luzes.',
  ]
}

/** Slider antes/depois: arrasta a barra pra revelar a foto original (antes)
 *  sobre a ambientação gerada (depois). Toque + mouse. */
function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const move = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
  }
  return (
    <div ref={ref}
      onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); move(e.clientX) }}
      onPointerMove={e => { if (e.buttons === 1) move(e.clientX) }}
      style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', touchAction: 'none', cursor: 'ew-resize', userSelect: 'none' }}>
      {/* Depois (base) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="Depois" draggable={false} style={{ width: '100%', display: 'block' }} />
      {/* Antes (recortado à esquerda) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Antes" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      {/* Divisor + alça */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 2, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 34, height: 34, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#111' }}>⇄</div>
      </div>
      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 8px', borderRadius: 999 }}>Antes</span>
      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '2px 8px', borderRadius: 999 }}>Depois</span>
    </div>
  )
}
