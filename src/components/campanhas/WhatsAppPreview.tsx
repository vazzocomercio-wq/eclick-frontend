'use client'

import { CheckCheck } from 'lucide-react'

interface Props {
  productImage?:    string
  productTitle?:    string
  productPrice?:    number
  productSalePrice?: number
  productUrl?:      string
  message:          string
  customerName?:    string
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g

function renderMessageWithLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  text.replace(URL_REGEX, (match, _g, idx: number) => {
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx))
    parts.push(
      <a key={idx} href={match} target="_blank" rel="noreferrer" className="underline text-cyan-300 break-all">
        {match}
      </a>,
    )
    lastIdx = idx + match.length
    return match
  })
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

export default function WhatsAppPreview({
  productImage,
  productTitle,
  productPrice,
  productSalePrice,
  productUrl: _productUrl,
  message,
  customerName = 'Maria',
}: Props) {
  const promoPct = productPrice && productSalePrice && productPrice > productSalePrice
    ? Math.round((1 - productSalePrice / productPrice) * 100)
    : null

  const personalized = (message ?? '').replace(/\{\{nome\}\}/g, customerName)

  return (
    <div className="max-w-[380px] w-full rounded-3xl border border-zinc-700 bg-zinc-900 overflow-hidden shadow-2xl">
      {/* Header */}
      <div style={{ background: '#075E54' }} className="flex items-center gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-cyan-400 font-bold text-sm">
          V
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Vazzo Comercio</p>
          <p className="text-[11px]" style={{ color: '#a4e8a4' }}>online</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: '#0a1014' }} className="min-h-[480px] p-4 flex flex-col items-end justify-end gap-2">
        <div
          style={{ background: '#005c4b', borderRadius: '8px 8px 2px 8px' }}
          className="max-w-[80%] overflow-hidden text-white shadow"
        >
          {productImage && (
            <div className="relative">
              <img src={productImage} alt={productTitle ?? ''} className="w-[240px] h-[240px] object-cover" />
              {promoPct !== null && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                  -{promoPct}%
                </span>
              )}
            </div>
          )}
          <div className="px-3 py-2">
            {productTitle && (
              <p className="text-sm font-bold leading-tight mb-1">{productTitle}</p>
            )}
            {(productPrice !== undefined || productSalePrice !== undefined) && (
              <p className="text-sm mb-2">
                {productSalePrice && productPrice ? (
                  <>
                    <span className="line-through text-white/50 mr-2 text-xs">R$ {productPrice.toFixed(2)}</span>
                    <span className="font-bold">R$ {productSalePrice.toFixed(2)}</span>
                  </>
                ) : productPrice !== undefined ? (
                  <span className="font-bold">R$ {productPrice.toFixed(2)}</span>
                ) : null}
              </p>
            )}
            <p className="text-sm whitespace-pre-wrap break-words leading-snug">
              {renderMessageWithLinks(personalized)}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[11px] text-white/60">14:32</span>
              <CheckCheck size={14} className="text-sky-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
