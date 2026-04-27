// Standalone layout for public lead-bridge landing pages.
// No sidebar, no header — just the form on a dark canvas.
export const metadata = {
  title: 'Confirme seus dados',
  description: 'Receba atualizações sobre seu pedido e ofertas exclusivas.',
}

export default function PublicLeadBridgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#09090b', minHeight: '100vh' }}>
      {children}
    </div>
  )
}
