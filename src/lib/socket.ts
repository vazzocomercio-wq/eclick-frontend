import { io, type Socket } from 'socket.io-client'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

let _socket: Socket | null = null

/**
 * Singleton Socket.IO client conectado ao namespace /events do backend.
 *
 * Auth via JWT do Supabase no handshake — backend resolve user→org e dá join
 * em room `org:{orgId}`. Eventos vêm do worker via POST /internal/realtime.
 *
 * Como é singleton: chamar `getSocket()` em qualquer componente reusa a mesma
 * conexão. NÃO chamar `disconnect()` em cleanup de componente — isso quebra
 * outros listeners ativos. O socket vive enquanto a aba estiver aberta.
 */
export async function getSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('socket: sem sessão Supabase ativa')

  if (_socket) {
    // Reconecta com novo token (refreshed)
    _socket.auth = { token }
    _socket.connect()
    return _socket
  }

  _socket = io(`${BACKEND}/events`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  return _socket
}

/** Força reconexão (ex: após refresh do token JWT). */
export async function reconnectSocket(): Promise<Socket> {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
  return getSocket()
}
