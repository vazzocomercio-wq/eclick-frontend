/**
 * Política de Privacidade (LGPD). Página pública estática — destino do aceite
 * do form da Auditoria GEO e linkada no rodapé das telas públicas.
 * Entidade operadora: Vazzo Comércio LTDA (marca e-Click).
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade | e-Click',
  description: 'Como a e-Click coleta, usa e protege seus dados pessoais (LGPD).',
  alternates: { canonical: 'https://eclick.app.br/privacidade' },
}

const CYAN = '#00E5FF'
const TXT = '#fafafa'
const MUT = '#a1a1aa'

const RAZAO = 'Vazzo Comércio LTDA'
const CNPJ = '29.049.890/0001-08'
const CONTATO = 'privacidade@eclick.app.br'
const ATUALIZACAO = '18 de junho de 2026'

export default function PrivacidadePage() {
  return (
    <div className="geo-page" style={{ background: '#09090b', color: TXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ maxWidth: 760, margin: '0 auto', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', color: TXT, textDecoration: 'none' }}>
          e<span style={{ color: CYAN }}>-</span>Click
        </Link>
        <Link href="/termos" style={{ fontSize: 13, color: MUT, textDecoration: 'none' }}>Termos de Serviço</Link>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '8px 20px 64px', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px' }}>
          Política de Privacidade
        </h1>
        <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 28px' }}>Última atualização: {ATUALIZACAO}</p>

        <P>A e-Click, operada por <b>{RAZAO}</b> (CNPJ <b>{CNPJ}</b>) (“nós”), respeita a sua privacidade e trata seus dados pessoais conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Esta política explica, em linguagem simples, o que coletamos na <b>Auditoria GEO gratuita</b> e ao usar a Plataforma, e como usamos.</P>

        <H>1. Quais dados coletamos</H>
        <P>Quando você usa a Auditoria GEO, coletamos: <b>nome, email e WhatsApp</b> que você informa no formulário; a <b>URL</b> que você pede pra auditar; dados técnicos mínimos (uma versão criptografada — hash — do seu IP, para limitar abuso, e o navegador). Não coletamos dados sensíveis.</P>

        <H>2. Para que usamos</H>
        <P>Usamos seus dados para: (a) rodar a análise e te enviar o resultado (nota GEO + recomendações); (b) enviar conteúdo educativo e comercial sobre GEO por <b>email e WhatsApp</b>; (c) entrar em contato caso você demonstre interesse. A análise da URL serve só para gerar o relatório.</P>

        <H>3. Base legal</H>
        <P>O tratamento se baseia no seu <b>consentimento</b> (você marca o aceite no formulário) e no <b>legítimo interesse</b> para comunicações relacionadas ao serviço. Você pode retirar o consentimento a qualquer momento (veja o item 6).</P>

        <H>4. Com quem compartilhamos</H>
        <P>Não vendemos seus dados. Compartilhamos apenas com operadores que viabilizam o serviço, sob contrato e dever de confidencialidade — por exemplo, provedores de envio de email e de mensagens, e infraestrutura de banco de dados. Esses operadores tratam os dados só para as finalidades acima.</P>

        <H>5. Por quanto tempo guardamos</H>
        <P>Mantemos seus dados enquanto durar o relacionamento ou até você pedir a exclusão. Dados de contato podem ser mantidos pelo prazo necessário para cumprir obrigações legais.</P>

        <H>6. Seus direitos (titular)</H>
        <P>Você pode, a qualquer momento: confirmar a existência de tratamento, acessar, corrigir, solicitar a exclusão ou a portabilidade dos seus dados, e revogar o consentimento. Para deixar de receber nossos emails, use o link <b>“Descadastrar”</b> no rodapé de qualquer email, ou fale com a gente em <a href={`mailto:${CONTATO}`} style={{ color: CYAN }}>{CONTATO}</a>.</P>

        <H>7. Segurança</H>
        <P>Adotamos medidas técnicas e organizacionais para proteger seus dados (controle de acesso, criptografia de credenciais, isolamento por organização). Nenhum sistema é 100% imune, mas trabalhamos para reduzir riscos.</P>

        <H>8. Contato</H>
        <P>Dúvidas sobre privacidade ou para exercer seus direitos: <a href={`mailto:${CONTATO}`} style={{ color: CYAN }}>{CONTATO}</a>.</P>

        <p style={{ marginTop: 36, fontSize: 13, color: '#52525b' }}>
          <Link href="/" style={{ color: CYAN }}>← Voltar para a e-Click</Link>
          <span style={{ margin: '0 10px', color: '#3f3f46' }}>·</span>
          <Link href="/termos" style={{ color: CYAN }}>Termos de Serviço</Link>
        </p>
      </main>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: TXT, margin: '28px 0 8px', letterSpacing: '-0.01em' }}>{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: MUT, margin: '0 0 12px' }}>{children}</p>
}
