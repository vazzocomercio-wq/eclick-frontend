/**
 * Imagem OG da landing — preview quando o link da Auditoria GEO é compartilhado
 * no conteúdo (LinkedIn, WhatsApp, X). Estática (sem fetch). next/og.
 */
import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Auditoria GEO Grátis — e-Click'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#09090b', color: '#fafafa', padding: 72, fontFamily: 'sans-serif', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>
          e<span style={{ color: '#00E5FF' }}>-</span>Click · Inteligência Comercial
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#00E5FF', marginBottom: 18 }}>GRÁTIS · 60 SEGUNDOS</div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.08, maxWidth: 1000 }}>
            Seu produto está
            <span style={{ color: '#00E5FF', marginLeft: 16, marginRight: 16 }}>invisível</span>
            pra ChatGPT e Perplexity?
          </div>
          <div style={{ display: 'flex', fontSize: 32, color: '#a1a1aa', marginTop: 28 }}>
            Descubra a Nota GEO do seu anúncio. Auditoria gratuita.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#00E5FF' }}>eclick.app.br/auditoria-gratis</div>
      </div>
    ),
    { ...size },
  )
}
