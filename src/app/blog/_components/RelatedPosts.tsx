import type { PostCardData } from '../lib/types'
import { PostCard } from './PostCard'
import { C } from './tokens'

/** Posts relacionados (até 3 cards). */
export function RelatedPosts({ posts }: { posts?: PostCardData[] }) {
  if (!posts?.length) return null
  return (
    <section style={{ margin: '48px 0' }} aria-label="Posts relacionados">
      <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 20px', color: C.TXT }}>
        Continue lendo
      </h2>
      <div className="bl-grid-3">
        {posts.slice(0, 3).map((p) => (
          <PostCard key={p._id} post={p} />
        ))}
      </div>
    </section>
  )
}
