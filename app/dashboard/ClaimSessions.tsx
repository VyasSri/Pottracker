'use client'

import { useState } from 'react'
import { formatCents } from '@/lib/utils'

type GuestSlot = {
  sessionPlayerId: string
  sessionId: string
  sessionStatus: string
  endedAt: string | null
  groupName: string
  guestName: string | null
  netCents: number
  buyInCents: number
}

export default function ClaimSessions({ initial }: { initial: GuestSlot[] }) {
  const [slots, setSlots]       = useState(initial)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [dismissed, setDismiss] = useState(false)

  if (dismissed || slots.length === 0) return null

  async function claim(slot: GuestSlot) {
    setClaiming(slot.sessionPlayerId)
    setErrors((e) => ({ ...e, [slot.sessionPlayerId]: '' }))
    const res = await fetch(
      `/api/sessions/${slot.sessionId}/players/${slot.sessionPlayerId}/claim`,
      { method: 'POST' }
    )
    if (res.ok) {
      setSlots((prev) => prev.filter((s) => s.sessionPlayerId !== slot.sessionPlayerId))
    } else {
      const d = await res.json().catch(() => ({}))
      setErrors((e) => ({ ...e, [slot.sessionPlayerId]: d.error ?? 'Failed to claim' }))
    }
    setClaiming(null)
  }

  return (
    <div className="mb-8 bg-felt-800 rounded-2xl border border-gold-400/30 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-felt-600">
        <div>
          <h2 className="text-felt-50 font-semibold">Were you a guest in any of these sessions?</h2>
          <p className="text-felt-400 text-xs mt-0.5">
            Claim your slot to see results and confirm payments.
          </p>
        </div>
        <button
          onClick={() => setDismiss(true)}
          className="text-felt-500 hover:text-felt-300 text-lg leading-none transition-colors flex-shrink-0 ml-4"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <div className="divide-y divide-felt-700">
        {slots.map((slot) => {
          const net = slot.netCents
          const isClaiming = claiming === slot.sessionPlayerId
          return (
            <div key={slot.sessionPlayerId} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-felt-100 font-semibold text-sm">{slot.guestName ?? 'Unknown'}</span>
                  <span className="text-xs text-felt-500 bg-felt-700 rounded-full px-2 py-0.5">
                    {slot.groupName}
                  </span>
                  {slot.endedAt && (
                    <span className="text-xs text-felt-500">
                      {new Date(slot.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <p className="text-felt-500 text-xs mt-0.5">
                  Buy-in {formatCents(slot.buyInCents)} ·{' '}
                  <span className={net >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {net >= 0 ? '+' : ''}{formatCents(net)}
                  </span>
                </p>
                {errors[slot.sessionPlayerId] && (
                  <p className="text-red-400 text-xs mt-1">{errors[slot.sessionPlayerId]}</p>
                )}
              </div>
              <button
                onClick={() => claim(slot)}
                disabled={!!claiming}
                className="flex-shrink-0 text-xs font-bold bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-felt-900 rounded-lg px-3 py-1.5 transition-all"
              >
                {isClaiming ? 'Claiming…' : "That's me"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
