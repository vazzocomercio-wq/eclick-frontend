/**
 * Imagem OG dinâmica do resultado — é o que aparece quando alguém compartilha
 * (ou cola o link) da sua Nota GEO no LinkedIn/WhatsApp/X. Gerada com next/og.
 * Busca a auditoria por id; se ainda não concluiu, mostra a versão genérica.
 */
import { ImageResponse } from 'next/og'
import { BACKEND, BAND_COLOR, bandLabel, type PublicAuditStatus } from '../../_components/auditResult'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Auditoria GEO — e-Click'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let score: number | null = null
  let band: 'red' | 'yellow' | 'green' = 'red'
  let headline = 'Descubra se a IA enxerga seu produto'
  try {
    const r = await fetch(`${BACKEND}/public/audits/${id}`, { cache: 'no-store' })
    if (r.ok) {
      const b = (await r.json()) as PublicAuditStatus
      if (b.status === 'done' && b.result && !b.result.skipped) {
        score = b.result.score
        band = b.result.band
        headline = b.result.headline
      }
    }
  } catch { /* usa genérico */ }

  const color = BAND_COLOR[band]

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#09090b', color: '#fafafa', padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>
          e<span style={{ color: '#00E5FF' }}>-</span>Click · Auditoria GEO
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
          {score != null ? (
            <>
              <div style={{ display: 'flex', width: 300, height: 300, borderRadius: 300, border: `20px solid ${color}`, alignItems: 'center', justifyContent: 'center', marginRight: 56 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', fontSize: 140, fontWeight: 800, color }}>{score}</div>
                  <div style={{ display: 'flex', fontSize: 28, color: '#71717a' }}>/100 · Nota GEO</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color }}>{bandLabel(band)}</div>
                <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, lineHeight: 1.15, marginTop: 16 }}>{headline}</div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
                Seu produto está <span style={{ color: '#00E5FF', marginLeft: 14, marginRight: 14 }}> invisível </span> pra IA?
              </div>
              <div style={{ display: 'flex', fontSize: 34, color: '#a1a1aa', marginTop: 24 }}>Auditoria GEO gratuita em 60 segundos</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: '#00E5FF' }}>eclick.app.br/auditoria-gratis</div>
      </div>
    ),
    { ...size },
  )
}
