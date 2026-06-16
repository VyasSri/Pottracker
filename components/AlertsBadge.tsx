'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AlertsBadge() {
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setUnread(d.unreadCount) })
      .catch(() => {})
  }, [pathname])

  const isActive = pathname === '/alerts'

  return (
    <Link
      href="/alerts"
      className={`relative text-sm px-3 py-1.5 rounded-md transition-all ${
        isActive
          ? 'text-gold-400 bg-felt-700'
          : 'text-felt-300 hover:text-gold-400 hover:bg-felt-700'
      }`}
    >
      Alerts
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-gold-400 text-felt-900 text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
