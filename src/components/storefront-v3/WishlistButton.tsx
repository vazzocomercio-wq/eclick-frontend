'use client'

/**
 * Botão coração toggle de favorito.
 *
 * Comportamento:
 * - Se não tem token (visitante anônimo): ao clicar, redireciona pra
 *   /loja/[slug]/conta/entrar?next=...
 * - Se tem token: PATCH/DELETE inline + atualiza estado local.
 *
 * Estado inicial vem via prop `initialFavorited` (caller bate
 * /wishlist/check pra grid inteiro). Component só toggle local +
 * envia ao backend.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { addToWishlist, removeFromWishlist, getCustomerToken } from '@/lib/storefront/customer-auth'

interface Props {
  slug:       string
  productId:  string
  initialFavorited?: boolean
  size?:      'sm' | 'md'
}

export function WishlistButton({ slug, productId, initialFavorited = false, size = 'md' }: Props) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)

  const handle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const token = getCustomerToken(slug)
    if (!token) {
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/loja/${slug}/conta/entrar?next=${next}`)
      return
    }

    setBusy(true)
    // Optimistic toggle
    const newState = !favorited
    setFavorited(newState)
    try {
      const ok = newState
        ? await addToWishlist(slug, productId)
        : await removeFromWishlist(slug, productId)
      if (!ok) {
        // Rollback
        setFavorited(!newState)
      }
    } finally {
      setBusy(false)
    }
  }

  const dim = size === 'sm' ? 32 : 40
  const iconSize = size === 'sm' ? 14 : 18

  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      className="transition-all hover:scale-110 disabled:opacity-50"
      style={{
        width: dim, height: dim,
        background: favorited ? '#ef4444' : 'rgba(255,255,255,0.9)',
        color:      favorited ? '#fff' : '#ef4444',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: busy ? 'wait' : 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: 'none',
        padding: 0,
      }}>
      <Heart size={iconSize} fill={favorited ? '#fff' : 'transparent'} strokeWidth={2.5} />
    </button>
  )
}
