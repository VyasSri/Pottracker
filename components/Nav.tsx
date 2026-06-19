'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import SignOutButton from './SignOutButton'
import AlertsBadge from './AlertsBadge'

export default function Nav() {
  const { data: session, status } = useSession()

  if (status === 'loading' || !session) return null

  const initial   = (session.user.name ?? 'P')[0].toUpperCase()
  const avatarUrl = session.user.image ?? null

  return (
    <nav className="bg-felt-800/95 border-b border-felt-600 sticky top-0 z-40 backdrop-blur-sm shadow-[0_1px_0_rgba(224,80,80,0.15)]">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Brand — gold gradient text */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-display font-bold text-xl tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #e05050 0%, #f99999 50%, #c53030 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ♠ PotTracker
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5 flex-1">
          <Link href="/dashboard" className="hidden sm:block text-felt-300 hover:text-gold-400 hover:bg-felt-700 text-sm px-3 py-1.5 rounded-md transition-all">Dashboard</Link>
          <Link href="/groups"    className="text-felt-300 hover:text-gold-400 hover:bg-felt-700 text-sm px-3 py-1.5 rounded-md transition-all">Groups</Link>
          <Link href="/stats"     className="text-felt-300 hover:text-gold-400 hover:bg-felt-700 text-sm px-3 py-1.5 rounded-md transition-all">Stats</Link>
          <AlertsBadge />
          <Link href="/profile"   className="hidden sm:block text-felt-300 hover:text-gold-400 hover:bg-felt-700 text-sm px-3 py-1.5 rounded-md transition-all">Profile</Link>
        </div>

        {/* User avatar + name + sign out */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/profile" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-felt-900 flex-shrink-0 group-hover:opacity-80 transition-opacity ring-1 ring-felt-600"
              style={avatarUrl ? undefined : { background: 'linear-gradient(135deg, #e05050, #c53030)' }}
            >
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : initial}
            </div>
            <span className="text-felt-200 text-sm hidden sm:block group-hover:text-felt-50 transition-colors">{session.user.name}</span>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </nav>
  )
}
