'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export type TodayOrder = {
  id: string
  status: string
  date_created: string
  total_amount: number
  items: Array<{ item_id: string; title: string; quantity: number; unit_price: number }>
  shipping_state?: string | null
  shipping_city?: string | null
}

export function getBrazilToday(): string {
  const now = new Date()
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return br.toISOString().split('T')[0]
}

async function getToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

export function useTodayOrders() {
  const [orders, setOrders] = useState<TodayOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const today = getBrazilToday()
      const token = await getToken()
      if (!token) { setLoading(false); return }
      const res = await fetch(
        `${BACKEND}/ml/recent-orders?date_from=${today}&date_to=${today}&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setOrders(data?.orders ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const faturamento = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const pedidos = orders.length

  return { orders, loading, faturamento, pedidos, refresh: fetchOrders }
}
