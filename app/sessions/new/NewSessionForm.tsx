'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; displayName: string }

export default function NewSessionForm({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string
  members: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [buyIn, setBuyIn] = useState('20')
  const [roundingMode, setRoundingMode] = useState<'BOUNCE' | 'CARRY_FORWARD'>('BOUNCE')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([currentUserId]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const buyInCents = Math.round(parseFloat(buyIn) * 100)
    if (isNaN(buyInCents) || buyInCents <= 0) {
      setError('Enter a valid buy-in amount')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        defaultBuyInCents: buyInCents,
        roundingMode,
        playerUserIds: Array.from(selectedIds),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create session')
      setLoading(false)
      return
    }

    const data = await res.json()
    router.push(`/sessions/${data.session.id}`)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Buy-in amount */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Default buy-in</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
            placeholder="20.00"
            required
          />
        </div>
      </div>

      {/* Rounding mode */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Sub-$1 debt handling
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['BOUNCE', 'CARRY_FORWARD'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRoundingMode(mode)}
              className={`rounded-lg border py-3 px-3 text-left transition-colors ${
                roundingMode === mode
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              <span className="block text-sm font-semibold">
                {mode === 'BOUNCE' ? 'Bounce' : 'Carry Forward'}
              </span>
              <span className="block text-xs opacity-70 mt-0.5">
                {mode === 'BOUNCE' ? 'Two-step qualifying payment' : 'Roll into next session'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Starting players */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Starting players
        </label>
        <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 overflow-hidden">
          {members.map((m, i) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors ${
                i < members.length - 1 ? 'border-b border-gray-800' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => togglePlayer(m.id)}
                className="accent-green-500"
              />
              <span className="text-white text-sm">
                {m.displayName}
                {m.id === currentUserId && (
                  <span className="ml-1.5 text-xs text-gray-500">(you)</span>
                )}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Guests and late arrivals can be added after starting.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || selectedIds.size === 0}
        className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-500/50 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {loading ? 'Creating…' : 'Create Session'}
      </button>
    </form>
  )
}
