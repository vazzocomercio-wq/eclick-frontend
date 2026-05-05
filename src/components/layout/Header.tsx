'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import NotificationBell from './NotificationBell'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/dashboard/produtos': 'Produtos',
  '/dashboard/concorrentes': 'Concorrentes',
  '/dashboard/precos': 'Preços',
  '/dashboard/estoque': 'Estoque',
  '/dashboard/ads': 'Ads',
  '/dashboard/crm': 'CRM',
  '/dashboard/configuracoes': 'Configurações',
}

interface HeaderProps {
  email: string
  name?: string
}

export default function Header({ email, name }: HeaderProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const pageTitle = routeLabels[pathname] ?? 'Painel'
  const displayName = name || email.split('@')[0]
  const initials = (name || email)
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header
      className="h-[52px] flex items-center justify-between px-5 shrink-0"
      style={{
        background: '#09090b',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Left — page title + breadcrumb */}
      <div className="flex items-center gap-2">
        <h1 className="text-[13px] font-semibold text-white">{pageTitle}</h1>
        <span
          className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}
        >
          <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
          Ao vivo
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">

        {/* Search */}
        <button
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-zinc-500 text-[12px] transition-colors hover:text-zinc-300 hover:bg-white/5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden sm:inline text-[10px] text-zinc-600 border border-zinc-700 rounded px-1">⌘K</kbd>
        </button>

        {/* Notifications */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-4 bg-zinc-800 mx-1" />

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 h-7 px-1.5 rounded-md transition-colors hover:bg-white/5"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black shrink-0"
              style={{ background: 'linear-gradient(135deg, #00E5FF, #00b8d4)' }}
            >
              {initials}
            </div>
            <span className="hidden sm:block text-[12px] font-medium text-zinc-300 max-w-[100px] truncate">
              {displayName}
            </span>
            <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div
                className="absolute right-0 top-9 w-52 rounded-xl z-20 overflow-hidden shadow-2xl"
                style={{
                  background: '#161618',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                }}
              >
                <div className="px-3.5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-white text-[13px] font-medium truncate">{displayName}</p>
                  <p className="text-zinc-500 text-[11px] truncate mt-0.5">{email}</p>
                </div>
                <div className="p-1">
                  <button
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-400 transition-colors hover:text-white hover:bg-white/5 text-left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Meu perfil
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-zinc-400 transition-colors hover:text-white hover:bg-white/5 text-left"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configurações
                  </button>
                </div>
                <div className="p-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left"
                    style={{ color: '#f87171' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sair da conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
