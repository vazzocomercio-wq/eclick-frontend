import { C } from './_components/tokens'

/** Skeleton da home/listagens do blog. */
export default function BlogLoading() {
  const box = (h: number): React.CSSProperties => ({
    background: C.CARD, border: `1px solid ${C.BORDER}`, borderRadius: 14, height: h,
  })
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 56px' }}>
      <div style={{ ...box(40), width: 260, marginBottom: 20 }} />
      <div style={{ ...box(120), marginBottom: 28 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} style={box(320)} />)}
      </div>
    </div>
  )
}
