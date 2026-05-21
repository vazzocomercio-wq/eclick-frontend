/**
 * Helpers pra download de imagens no client-side.
 *
 * Funciona com URLs públicas (Supabase Storage tem CORS aberto).
 * Pra download em massa, baixa em sequência com pequeno delay
 * (alguns navegadores bloqueiam múltiplos downloads simultâneos).
 */

/** Faz fetch + trigger download. Retorna true se OK. */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return false
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Libera blob depois de 1s pra dar tempo do download iniciar
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    return true
  } catch {
    return false
  }
}

/** Baixa N imagens em sequência (delay 400ms entre cada). */
export async function downloadAllImages(
  images: Array<{ url: string; filename: string }>,
  onProgress?: (current: number, total: number) => void,
): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0
  for (let i = 0; i < images.length; i++) {
    const { url, filename } = images[i]!
    onProgress?.(i + 1, images.length)
    const success = await downloadImage(url, filename)
    if (success) ok++; else fail++
    if (i < images.length - 1) {
      await new Promise(r => setTimeout(r, 400))
    }
  }
  return { ok, fail }
}

/** Gera filename amigável: "banner-wide-1-2026-05-21.png" */
export function bannerFilename(format: string, index: number, ext = 'png'): string {
  const date = new Date().toISOString().slice(0, 10)
  return `banner-${format}-${index + 1}-${date}.${ext}`
}
