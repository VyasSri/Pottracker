'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; displayName: string }

const inputCls =
  'w-full bg-felt-900 border border-felt-500 rounded-lg px-4 py-2.5 text-felt-50 placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors text-sm'

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
  const [buyIn, setBuyIn]           = useState('20')
  const [roundingMode, setRounding] = useState<'BOUNCE' | 'CARRY_FORWARD'>('BOUNCE')
  const [selectedIds, setIds]       = useState<Set<string>>(new Set([currentUserId]))
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(buyIn) * 100)
    if (isNaN(cents) || cents <= 0) { setError('Enter a valid buy-in amount'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, defaultBuyInCents: cents, roundingMode, playerUserIds: Array.from(selectedIds) }),
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
      {/* Buy-in */}
      <div>
        <label className="block text-sm font-medium text-felt-200 mb-2">Default buy-in</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-felt-400 text-sm">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
            className={`${inputCls} pl-8`}
            placeholder="20.00"
            required
          />
        </div>
      </div>

      {/* Rounding mode */}
      <div>
        <label className="block text-sm font-medium text-felt-200 mb-2">Sub-$1 debt handling</label>
        <div className="grid grid-cols-2 gap-2">
          {(['BOUNCE', 'CARRY_FORWARD'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRounding(mode)}
              className={`rounded-xl border py-3 px-4 text-left transition-all ${
                roundingMode === mode
                  ? 'border-gold-400/50 bg-gold-400/8 text-gold-400'
                  : 'border-felt-600 text-felt-400 hover:border-felt-500 hover:text-felt-200'
              }`}
            >
              <span className="block text-sm font-semibold">
                {mode === 'BOUNCE' ? 'Bounce' : 'Carry Forward'}
              </span>
              <span className="block text-xs opacity-60 mt-0.5">
                {mode === 'BOUNCE' ? 'Two-step qualifying payment' : 'Roll into next session'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Players */}
      <div>
        <label className="block text-sm font-medium text-felt-200 mb-2">Starting players</label>
        <div className="bg-felt-800 rounded-xl border border-felt-600 overflow-hidden">
          {members.map((m, i) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-felt-700/50 transition-colors ${
                i < members.length - 1 ? 'border-b border-felt-600' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(m.id)}
                onChange={() => toggle(m.id)}
                className="accent-gold-400"
              />
              <span className="text-felt-100 text-sm">
                {m.displayName}
                {m.id === currentUserId && <span className="ml-1.5 text-xs text-felt-500">(you)</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-felt-500 mt-1.5">
          Guests and late arrivals can be added after starting.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || selectedIds.size === 0}
        className="w-full bg-gold-400 hover:bg-gold-300 disabled:bg-gold-400/40 text-felt-900 font-bold py-3 rounded-xl transition-all"
      >
        {loading ? 'Creating…' : 'Create Session'}
      </button>
    </form>
  )
}
