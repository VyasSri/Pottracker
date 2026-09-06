'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'
import AlertsBadge from './AlertsBadge'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', desktopOnly: true },
  { href: '/groups', label: 'Groups', desktopOnly: false },
  { href: '/stats', label: 'Stats', desktopOnly: false },
]

export default function Nav() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading' || !session) return null

  const initial = (session.user.name ?? 'P')[0].toUpperCase()
  const avatarUrl = session.user.image ?? null

  const linkCls = (href: string, desktopOnly: boolean) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return [
      desktopOnly ? 'hidden sm:block' : 'block',
      'text-sm px-3 py-1.5 rounded-lg transition-colors',
      active
        ? 'text-felt-50 bg-felt-700'
        : 'text-felt-300 hover:text-felt-50 hover:bg-felt-700',
    ].join(' ')
  }

  return (
    <nav className="bg-felt-800/80 border-b border-felt-600 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-6">

        {/* Brand . minimal chip mark + wordmark */}
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 group">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-gold-400 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-white/90" />
          </span>
          <span className="font-semibold text-[15px] tracking-tight text-felt-50">
            PotTracker
          </span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-0.5 flex-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(l.href, l.desktopOnly)}>
              {l.label}
            </Link>
          ))}
          <AlertsBadge />
          <Link href="/profile" className={linkCls('/profile', true)}>Profile</Link>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/profile" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-full overflow-hidden grid place-items-center text-sm font-semibold text-white flex-shrink-0 ring-1 ring-felt-600 group-hover:ring-gold-400/50 transition-all"
              style={avatarUrl ? undefined : { backgroundColor: '#059669' }}
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
