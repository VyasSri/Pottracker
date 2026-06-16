'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Alert = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  SESSION_ENDED:    '■',
  SETTLEMENT_READY: '⊕',
  PAYMENT_CONFIRMED:'✓',
  GROUP_INVITE:     '♠',
  PAYMENT_REMINDER: '⏰',
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function AlertsPage() {
  const [alerts, setAlerts]       = useState<Alert[]>([])
  const [unread, setUnread]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [markingAll, setMarkAll]  = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/alerts')
    if (res.ok) {
      const data = await res.json()
      setAlerts(data.alerts)
      setUnread(data.unreadCount)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'PATCH' })
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, readAt: new Date().toISOString() } : a))
    setUnread((n) => Math.max(0, n - 1))
  }

  async function markAllRead() {
    setMarkAll(true)
    await fetch('/api/alerts/mark-all-read', { method: 'PATCH' })
    const now = new Date().toISOString()
    setAlerts((prev) => prev.map((a) => ({ ...a, readAt: a.readAt ?? now })))
    setUnread(0)
    setMarkAll(false)
  }

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-felt-50">Alerts</h1>
            {unread > 0 && (
              <p className="text-felt-400 text-sm mt-0.5">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} disabled={markingAll}
              className="text-sm text-felt-400 hover:text-gold-400 transition-colors disabled:opacity-50">
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-felt-500 py-16">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="bg-felt-800 rounded-2xl border border-felt-600 p-12 text-center">
            <p className="text-4xl font-display text-felt-600 mb-3">♦</p>
            <p className="text-felt-400 text-sm">No alerts yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const isUnread = !alert.readAt
              const icon = TYPE_ICON[alert.type] ?? '•'
              const inner = (
                <div
                  className={`flex gap-4 bg-felt-800 rounded-xl border p-4 transition-all ${
                    isUnread ? 'border-gold-400/30 bg-felt-800' : 'border-felt-600 opacity-70'
                  }`}
                  onClick={() => { if (isUnread) markRead(alert.id) }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isUnread ? 'bg-gold-400/10 text-gold-400' : 'bg-felt-700 text-felt-500'
                  }`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${isUnread ? 'text-felt-50' : 'text-felt-300'}`}>
                        {alert.title}
                        {isUnread && <span className="ml-2 inline-block w-2 h-2 bg-gold-400 rounded-full align-middle" />}
                      </p>
                      <span className="text-felt-500 text-xs flex-shrink-0">{timeAgo(alert.createdAt)}</span>
                    </div>
                    <p className="text-felt-400 text-sm mt-0.5">{alert.body}</p>
                  </div>
                </div>
              )

              return alert.link ? (
                <Link key={alert.id} href={alert.link} className="block hover:opacity-90 transition-opacity cursor-pointer">
                  {inner}
                </Link>
              ) : (
                <div key={alert.id} className="cursor-pointer">
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
