'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronLeft, AlertCircle, Users } from 'lucide-react'
import { affiliateLogin, affiliateSignup } from '@/lib/storefront/affiliate-auth'

export function AfiliadoAuthForm({ slug, storeName, mode }: {
  slug: string; storeName: string; mode: 'login' | 'signup'
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [doc, setDoc] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      if (mode === 'login') {
        await affiliateLogin(slug, { email, password })
      } else {
        if (!name.trim()) { setErr('Nome obrigatório'); setLoading(false); return }
        if (password.length < 6) { setErr('Senha precisa ter 6+ caracteres'); setLoading(false); return }
        await affiliateSignup(slug, { name, email, password, phone, doc, code: code || undefined })
      }
      router.push(`/loja/${slug}/afiliado`)
    } catch (e) {
      setErr((e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href={`/loja/${slug}`} className="text-xs hover:underline inline-flex items-center gap-1 mb-6"
        style={{ color: 'var(--c-text-muted)' }}>
        <ChevronLeft size={12} /> Voltar pra loja
      </Link>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center rounded-full mb-3"
          style={{ background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)', width: 56, height: 56 }}>
          <Users size={28} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
          {mode === 'login' ? 'Área do Afiliado' : 'Vire afiliado da loja'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
          {mode === 'login'
            ? `Acesse sua área e veja suas comissões em ${storeName}`
            : `Indique a ${storeName} e ganhe comissão a cada venda`}
        </p>
      </div>

      {err && (
        <div className="mb-4 p-3 rounded flex items-center gap-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === 'signup' && (
          <Field label="Nome completo">
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3 py-2 text-sm rounded outline-none"
              style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
          </Field>
        )}

        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
            className="w-full px-3 py-2 text-sm rounded outline-none"
            style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
        </Field>

        <Field label={mode === 'login' ? 'Senha' : 'Crie uma senha (mín. 6 caracteres)'}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full px-3 py-2 text-sm rounded outline-none"
            style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
        </Field>

        {mode === 'signup' && (
          <>
            <Field label="Seu código personalizado (opcional)">
              <input value={code} onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                placeholder="ex: joao_x9 (deixe vazio pra gerar automaticamente)"
                maxLength={20}
                className="w-full px-3 py-2 text-sm rounded outline-none font-mono"
                style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                Será usado no seu link: <span className="font-mono">loja?ref={code || 'SEU_CODE'}</span>
              </p>
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Telefone (opcional)">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
              </Field>
              <Field label="CPF/CNPJ (opcional)">
                <input value={doc} onChange={e => setDoc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded outline-none"
                  style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
              </Field>
            </div>
          </>
        )}

        <button type="submit" disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold text-sm disabled:opacity-50"
          style={{
            background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)',
            borderRadius: 'var(--r)', minHeight: 44,
          }}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {mode === 'login' ? 'Entrar' : 'Quero ser afiliado'}
        </button>
      </form>

      <div className="text-center mt-6">
        {mode === 'login' ? (
          <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
            Ainda não é afiliado?{' '}
            <Link href={`/loja/${slug}/afiliado/cadastro`}
              className="font-semibold hover:underline" style={{ color: 'var(--c-primary)' }}>
              Cadastre-se grátis
            </Link>
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
            Já é afiliado?{' '}
            <Link href={`/loja/${slug}/afiliado/entrar`}
              className="font-semibold hover:underline" style={{ color: 'var(--c-primary)' }}>
              Entrar
            </Link>
          </p>
        )}
      </div>

      {mode === 'signup' && (
        <div className="mt-8 rounded-lg p-4 text-xs"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--c-text)' }}>Como funciona:</p>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>Cadastre-se com seu nome e email</li>
            <li>Lojista aprova seu cadastro</li>
            <li>Você recebe um link personalizado (?ref=seu_code)</li>
            <li>Divulgue nas suas redes (Insta, Tik Tok, WhatsApp...)</li>
            <li>Toda venda gerada do seu link te dá comissão</li>
            <li>Lojista paga via Pix ou transferência</li>
          </ol>
        </div>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
