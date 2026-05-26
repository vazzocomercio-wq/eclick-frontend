import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { C } from './tokens'

/** CTA final de cada post — converte leitor em lead da auditoria GEO. */
export function CtaFinal() {
  return (
    <section style={{
      margin: '48px 0', padding: 'clamp(28px, 5vw, 48px)', borderRadius: 20, textAlign: 'center',
      background: 'linear-gradient(160deg, rgba(0,229,255,0.10), rgba(18,18,20,0.5))',
      border: `1px solid ${C.CYAN}44`,
    }}>
      <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0, color: C.TXT }}>
        Quer ver a nota <span style={{ color: C.CYAN }}>GEO</span> do SEU anúncio?
      </h2>
      <p style={{ fontSize: 16, color: C.MUT, lineHeight: 1.6, margin: '14px auto 24px', maxWidth: 520 }}>
        Em 60 segundos, descubra como ChatGPT, Gemini e Perplexity enxergam seu anúncio ou loja —
        e os 3 problemas mais críticos pra corrigir. Grátis, sem cadastro.
      </p>
      <Link href="/auditoria-gratis" data-cta="audit-final" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: C.CYAN, color: '#04141a', fontWeight: 800, fontSize: 16,
        padding: '15px 26px', borderRadius: 12, textDecoration: 'none',
      }}>
        <Sparkles size={18} /> Auditar meu anúncio grátis <ArrowRight size={18} />
      </Link>
    </section>
  )
}
