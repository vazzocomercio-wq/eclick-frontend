/**
 * Termos de Serviço da e-Click. Página pública estática, exigida para a
 * revisão de apps de terceiros (TikTok Marketing API, Meta, etc.) e linkada
 * no rodapé das telas públicas (login/cadastro).
 * Entidade operadora: Vazzo Comércio LTDA (marca e-Click).
 */
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Serviço | e-Click',
  description: 'Termos e condições de uso da plataforma e-Click.',
  alternates: { canonical: 'https://eclick.app.br/termos' },
}

const CYAN = '#00E5FF'
const TXT = '#fafafa'
const MUT = '#a1a1aa'

const RAZAO = 'Vazzo Comércio LTDA'
const CNPJ = '29.049.890/0001-08'
const CONTATO = 'contato@eclick.app.br'
const ATUALIZACAO = '18 de junho de 2026'

export default function TermosPage() {
  return (
    <div className="geo-page" style={{ background: '#09090b', color: TXT, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ maxWidth: 760, margin: '0 auto', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', color: TXT, textDecoration: 'none' }}>
          e<span style={{ color: CYAN }}>-</span>Click
        </Link>
        <Link href="/privacidade" style={{ fontSize: 13, color: MUT, textDecoration: 'none' }}>Política de Privacidade</Link>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '8px 20px 64px', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px' }}>
          Termos de Serviço
        </h1>
        <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 28px' }}>Última atualização: {ATUALIZACAO}</p>

        <P>Estes Termos de Serviço (“Termos”) regem o uso da plataforma <b>e-Click</b> (“Plataforma”, “Serviço”), operada por <b>{RAZAO}</b>, inscrita no CNPJ sob o nº <b>{CNPJ}</b> (“e-Click”, “nós”). Ao criar uma conta ou usar o Serviço, você (“Usuário”) concorda com estes Termos. Se não concordar, não use a Plataforma.</P>

        <H>1. O que é a e-Click</H>
        <P>A e-Click é uma plataforma de inteligência comercial movida a IA que ajuda lojistas a operar e otimizar suas vendas em marketplaces e canais digitais — incluindo gestão de catálogo, pedidos, estoque, anúncios e atendimento. Para isso, a Plataforma se integra, mediante sua autorização, a serviços de terceiros (por exemplo, Mercado Livre, Shopee, TikTok Shop, TikTok for Business, Meta e Google).</P>

        <H>2. Conta e elegibilidade</H>
        <P>Para usar o Serviço você deve ter ao menos 18 anos e capacidade legal para contratar. Você é responsável por manter a confidencialidade das suas credenciais e por todas as atividades realizadas na sua conta. Avise-nos imediatamente em caso de uso não autorizado.</P>

        <H>3. Integrações com terceiros</H>
        <P>Ao conectar uma conta de terceiro (marketplace, rede de anúncios ou rede social), você nos autoriza a acessar e tratar os dados dessa conta <b>estritamente</b> para prestar as funcionalidades que você ativou — como sincronizar produtos e pedidos, ler métricas de anúncios e publicar conteúdo em seu nome. O uso de cada serviço integrado também se sujeita aos termos e políticas do respectivo provedor. Você pode revogar o acesso a qualquer momento, desconectando a integração ou pelo painel do provedor.</P>

        <H>4. Uso aceitável</H>
        <P>Você concorda em não: (a) usar o Serviço para fins ilícitos ou que violem direitos de terceiros; (b) tentar acessar áreas ou dados sem autorização; (c) interferir na segurança ou no funcionamento da Plataforma; (d) usar os dados obtidos por meio das integrações de forma incompatível com estes Termos ou com as políticas dos provedores integrados.</P>

        <H>5. Planos, cobrança e cancelamento</H>
        <P>Algumas funcionalidades podem ser pagas. Quando aplicável, os valores, a periodicidade e as condições de cobrança serão informados no momento da contratação. Você pode cancelar a qualquer momento; o cancelamento encerra a renovação seguinte e o acesso permanece até o fim do período já pago, salvo disposição em contrário.</P>

        <H>6. Propriedade intelectual</H>
        <P>A Plataforma, sua marca, código, design e conteúdos são de titularidade da e-Click ou de seus licenciadores. Estes Termos não transferem qualquer propriedade intelectual a você, apenas concedem uma licença limitada, não exclusiva e revogável de uso do Serviço. Os dados e conteúdos que você insere permanecem seus.</P>

        <H>7. Disponibilidade e isenções</H>
        <P>Empenhamo-nos para manter o Serviço disponível e correto, mas ele é fornecido “no estado em que se encontra”. Não garantimos operação ininterrupta ou livre de erros, e não somos responsáveis por indisponibilidades ou alterações de APIs de terceiros que estejam fora do nosso controle.</P>

        <H>8. Limitação de responsabilidade</H>
        <P>Na máxima extensão permitida pela lei aplicável, a e-Click não responde por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso ou da impossibilidade de uso do Serviço. Nada nestes Termos limita responsabilidades que não possam ser limitadas por lei.</P>

        <H>9. Privacidade</H>
        <P>O tratamento de dados pessoais segue a nossa <Link href="/privacidade" style={{ color: CYAN }}>Política de Privacidade</Link> e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), que é parte integrante destes Termos.</P>

        <H>10. Alterações</H>
        <P>Podemos atualizar estes Termos para refletir mudanças no Serviço ou na legislação. Alterações relevantes serão comunicadas pelos canais usuais. O uso continuado após a vigência das alterações representa concordância com a versão atualizada.</P>

        <H>11. Lei aplicável e foro</H>
        <P>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do Usuário para dirimir eventuais controvérsias, quando aplicável.</P>

        <H>12. Contato</H>
        <P>Dúvidas sobre estes Termos: <a href={`mailto:${CONTATO}`} style={{ color: CYAN }}>{CONTATO}</a>.</P>

        <p style={{ marginTop: 36, fontSize: 13, color: '#52525b' }}>
          <Link href="/" style={{ color: CYAN }}>← Voltar para a e-Click</Link>
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
