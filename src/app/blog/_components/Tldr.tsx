import { Zap } from 'lucide-react'
import { C } from './tokens'

/** Box TL;DR no topo do post — pontos-chave em 30s (forte sinal pra LLM resumir). */
export function Tldr({ items }: { items: string[] }) {
  if (!items?.length) return null
  return (
    <aside style={{
      margin: '8px 0 32px', padding: '20px 22px', borderRadius: 14,
      background: 'linear-gradient(160deg, rgba(0,229,255,0.06), rgba(18,18,20,0.4))',
      border: `1px solid ${C.CYAN}33`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800,
        letterSpacing: '0.08em', textTransform: 'uppercase', color: C.CYAN, marginBottom: 12,
      }}>
        <Zap size={15} /> TL;DR · pontos-chave em 30 segundos
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((b, i) => (
          <li key={i} style={{ fontSize: 15.5, color: '#d4d4d8', lineHeight: 1.55 }}>{b}</li>
        ))}
      </ul>
    </aside>
  )
}
