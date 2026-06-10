'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'

type BuyIn = { id: string; amountCents: number }
type PlayerUser = { id: string; displayName: string; zelleHandle: string | null }
type Player = {
  id: string
  userId: string | null
  guestName: string | null
  leftEarly: boolean
  cashOutCents: number | null
  user: PlayerUser | null
  buyIns: BuyIn[]
}
type TxPlayer = {
  id: string
  userId: string | null
  guestName: string | null
  user: PlayerUser | null
}
type SettlementTx = {
  id: string
  fromPlayerId: string
  toPlayerId: string
  amountCents: number
  kind: string
  bounceGroupId: string | null
  payerConfirmed: boolean
  payeeConfirmed: boolean
  fromPlayer: TxPlayer
  toPlayer: TxPlayer
}
type Session = {
  id: string
  groupId: string
  hostId: string
  status: string
  defaultBuyInCents: number
  roundingMode: string
  group: { id: string; name: string }
  host: { id: string; displayName: string }
  players: Player[]
  settlementTransactions: SettlementTx[]
}
type GroupMember = { id: string; displayName: string }

function pName(p: Pick<Player, 'user' | 'guestName'>): string {
  return p.user?.displayName ?? p.guestName ?? 'Unknown'
}
function buyInTotal(p: Player): number {
  return p.buyIns.reduce((sum, b) => sum + b.amountCents, 0)
}
function txName(p: TxPlayer): string {
  return p.user?.displayName ?? p.guestName ?? 'Unknown'
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  ACTIVE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ENDED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  SETTLED: 'bg-green-500/10 text-green-400 border-green-500/30',
}

// ─── Add Player Modal ────────────────────────────────────────────────────────

function AddPlayerModal({
  sessionId,
  existing,
  groupMembers,
  onClose,
  onAdded,
}: {
  sessionId: string
  existing: Set<string>
  groupMembers: GroupMember[]
  onClose: () => void
  onAdded: () => Promise<void>
}) {
  const [mode, setMode] = useState<'member' | 'guest'>('member')
  const [userId, setUserId] = useState('')
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const available = groupMembers.filter((m) => !existing.has(m.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const body = mode === 'member' ? { userId } : { guestName: guestName.trim() }
    const res = await fetch(`/api/sessions/${sessionId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to add player')
      setLoading(false)
      return
    }
    await onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-700 w-full max-w-sm p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Add Player</h2>
        <div className="flex gap-1 mb-4 bg-[#0f1117] rounded-lg p-1">
          {(['member', 'guest'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === m ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'member' ? 'Group member' : 'Guest'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'member' ? (
            available.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-3">
                All group members are already in this session.
              </p>
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-green-500 transition-colors"
              >
                <option value="">Select a member…</option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            )
          ) : (
            <input
              type="text"
              placeholder="Guest name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={50}
              required
              className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
            />
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                (mode === 'member' && (!userId || available.length === 0)) ||
                (mode === 'guest' && !guestName.trim())
              }
              className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Cash Out Modal ──────────────────────────────────────────────────────────

function CashOutModal({
  player,
  sessionId,
  onClose,
  onDone,
}: {
  player: Player
  sessionId: string
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const total = buyInTotal(player)
  const [amount, setAmount] = useState((total / 100).toFixed(2))
  const [leftEarly, setLeftEarly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(amount) * 100)
    if (isNaN(cents) || cents < 0) {
      setError('Enter a valid amount')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/sessions/${sessionId}/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashOutCents: cents, leftEarly }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to record cash out')
      setLoading(false)
      return
    }
    await onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1a1f2e] rounded-2xl border border-gray-700 w-full max-w-sm p-6">
        <h2 className="text-white font-semibold text-lg mb-1">Cash Out</h2>
        <p className="text-gray-400 text-sm mb-5">{pName(player)}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#0f1117] border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white focus:outline-none focus:border-green-500 transition-colors"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Buy-in total: {formatCents(total)}</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={leftEarly}
              onChange={(e) => setLeftEarly(e.target.checked)}
              className="accent-green-500"
            />
            <span className="text-sm text-gray-300">Player is leaving early</span>
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SessionView({
  session: init,
  groupMembers,
  isHost,
  currentUserId,
}: {
  session: Session
  groupMembers: GroupMember[]
  isHost: boolean
  currentUserId: string
}) {
  const [session, setSession] = useState(init)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [cashOutTarget, setCashOutTarget] = useState<Player | null>(null)
  const [buyInLoading, setBuyInLoading] = useState<string | null>(null)
  const [startLoading, setStartLoading] = useState(false)
  const [endLoading, setEndLoading] = useState(false)
  const [endError, setEndError] = useState('')

  async function refresh() {
    const res = await fetch(`/api/sessions/${session.id}`)
    if (res.ok) {
      const data = await res.json()
      setSession(data.session)
    }
  }

  async function startSession() {
    setStartLoading(true)
    await fetch(`/api/sessions/${session.id}/start`, { method: 'POST' })
    await refresh()
    setStartLoading(false)
  }

  async function recordBuyIn(playerId: string) {
    setBuyInLoading(playerId)
    await fetch(`/api/sessions/${session.id}/players/${playerId}/buyin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: session.defaultBuyInCents }),
    })
    await refresh()
    setBuyInLoading(null)
  }

  async function endSession() {
    setEndLoading(true)
    setEndError('')
    const res = await fetch(`/api/sessions/${session.id}/end`, { method: 'POST' })
    if (res.ok) {
      await refresh()
    } else {
      const data = await res.json()
      if (data.discrepancyCents !== undefined) {
        const abs = Math.abs(data.discrepancyCents)
        const dir = data.discrepancyCents > 0 ? 'over' : 'short'
        setEndError(
          `Chip conservation failed: cash-outs are ${formatCents(abs)} ${dir} vs buy-ins.`
        )
      } else if (data.playerName) {
        setEndError(`${data.playerName} hasn't cashed out yet.`)
      } else {
        setEndError(data.error ?? 'Failed to end session')
      }
    }
    setEndLoading(false)
  }

  const { players, settlementTransactions } = session
  const totalBuyIns = players.reduce((sum, p) => sum + buyInTotal(p), 0)
  const totalCashOuts = players.reduce((sum, p) => sum + (p.cashOutCents ?? 0), 0)
  const uncashed = totalBuyIns - totalCashOuts
  const discrepancy = totalCashOuts - totalBuyIns
  const allCashedOut = players.length > 0 && players.every((p) => p.cashOutCents !== null)
  const existingUserIds = new Set(players.filter((p) => p.userId).map((p) => p.userId!))

  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-6">
          <Link href="/groups" className="hover:text-gray-300 transition-colors">
            Groups
          </Link>
          <span>/</span>
          <Link
            href={`/groups/${session.groupId}`}
            className="hover:text-gray-300 transition-colors"
          >
            {session.group.name}
          </Link>
          <span>/</span>
          <span className="text-gray-300">Session</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className={`text-xs font-medium rounded-full px-3 py-1 border ${
              STATUS_BADGE[session.status] ?? STATUS_BADGE.DRAFT
            }`}
          >
            {session.status}
          </span>
          <div>
            <p className="text-white font-semibold">
              Hosted by {session.host.displayName}
              {session.host.id === currentUserId && (
                <span className="text-gray-500 font-normal text-sm ml-1">(you)</span>
              )}
            </p>
            <p className="text-gray-500 text-xs">
              Default buy-in: {formatCents(session.defaultBuyInCents)} ·{' '}
              {session.roundingMode === 'BOUNCE' ? 'Bounce mode' : 'Carry-forward mode'}
            </p>
          </div>
        </div>

        {/* ── DRAFT ──────────────────────────────────────────── */}
        {session.status === 'DRAFT' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Players ({players.length})
              </h2>
              {isHost && (
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors"
                >
                  + Add player
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-8 text-center">
                <p className="text-gray-400 text-sm">No players yet.</p>
              </div>
            ) : (
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
                {players.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-5 py-4 ${
                      i < players.length - 1 ? 'border-b border-gray-800' : ''
                    }`}
                  >
                    <span className="text-white text-sm">{pName(p)}</span>
                    {!p.userId && (
                      <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">
                        Guest
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isHost && (
              <div className="pt-2">
                {players.length < 2 && (
                  <p className="text-gray-500 text-sm text-center mb-3">
                    Need at least 2 players to start.
                  </p>
                )}
                <button
                  onClick={startSession}
                  disabled={startLoading || players.length < 2}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:bg-green-500/40 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {startLoading ? 'Starting…' : 'Start Session'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE ─────────────────────────────────────────── */}
        {session.status === 'ACTIVE' && (
          <div className="space-y-4">
            {/* Chip tracker */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buy-ins</p>
                <p className="text-white font-semibold">{formatCents(totalBuyIns)}</p>
              </div>
              <div className="bg-[#1a1f2e] rounded-xl border border-gray-800 p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cashed out</p>
                <p className="text-white font-semibold">{formatCents(totalCashOuts)}</p>
              </div>
              <div
                className={`rounded-xl border p-4 text-center ${
                  uncashed === 0
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-[#1a1f2e] border-gray-800'
                }`}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Remaining</p>
                <p
                  className={`font-semibold ${
                    uncashed === 0 ? 'text-green-400' : 'text-white'
                  }`}
                >
                  {formatCents(uncashed)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Players</h2>
              {isHost && (
                <button
                  onClick={() => setShowAddPlayer(true)}
                  className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors"
                >
                  + Add player
                </button>
              )}
            </div>

            <div className="space-y-2">
              {players.map((p) => {
                const total = buyInTotal(p)
                const net = (p.cashOutCents ?? 0) - total
                const cashedOut = p.cashOutCents !== null

                return (
                  <div
                    key={p.id}
                    className={`bg-[#1a1f2e] rounded-xl border border-gray-800 p-4 ${
                      cashedOut ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium text-sm">{pName(p)}</span>
                          {!p.userId && (
                            <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">
                              Guest
                            </span>
                          )}
                          {p.leftEarly && (
                            <span className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
                              Left early
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-1">
                          Buy-ins: {formatCents(total)}
                          {p.buyIns.length > 1 && (
                            <span className="ml-1 text-gray-600">({p.buyIns.length}×)</span>
                          )}
                          {cashedOut && (
                            <>
                              <span className="mx-1 text-gray-600">·</span>
                              <span>Cash out: {formatCents(p.cashOutCents!)}</span>
                              <span
                                className={`ml-1 font-medium ${
                                  net >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                ({net >= 0 ? '+' : ''}
                                {formatCents(net)})
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {isHost && !cashedOut && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => recordBuyIn(p.id)}
                            disabled={buyInLoading === p.id}
                            className="text-xs border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                          >
                            {buyInLoading === p.id
                              ? '…'
                              : `Rebuy ${formatCents(session.defaultBuyInCents)}`}
                          </button>
                          <button
                            onClick={() => setCashOutTarget(p)}
                            className="text-xs bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            Cash out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {isHost && (
              <div className="pt-2 space-y-2">
                {!allCashedOut && (
                  <p className="text-gray-500 text-sm text-center">
                    Record cash-outs for all players before ending.
                  </p>
                )}
                {allCashedOut && discrepancy !== 0 && (
                  <p className="text-red-400 text-sm text-center">
                    Chip conservation: {formatCents(Math.abs(discrepancy))}{' '}
                    {discrepancy > 0 ? 'over' : 'short'}. Correct a cash-out to proceed.
                  </p>
                )}
                {endError && <p className="text-red-400 text-sm text-center">{endError}</p>}
                <button
                  onClick={endSession}
                  disabled={endLoading || !allCashedOut || discrepancy !== 0}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 disabled:opacity-40 border border-yellow-500/30 text-yellow-400 font-semibold py-3 rounded-xl transition-colors"
                >
                  {endLoading ? 'Ending session…' : 'End Session'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ENDED / SETTLED ────────────────────────────────── */}
        {(session.status === 'ENDED' || session.status === 'SETTLED') && (
          <div className="space-y-6">
            {/* Final P&L */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Final Results</h2>
              <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
                {[...players]
                  .sort(
                    (a, b) =>
                      (b.cashOutCents ?? 0) -
                      buyInTotal(b) -
                      ((a.cashOutCents ?? 0) - buyInTotal(a))
                  )
                  .map((p, i) => {
                    const total = buyInTotal(p)
                    const net = (p.cashOutCents ?? 0) - total
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-5 py-4 ${
                          i < players.length - 1 ? 'border-b border-gray-800' : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{pName(p)}</span>
                            {!p.userId && (
                              <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">
                                Guest
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {formatCents(total)} in · {formatCents(p.cashOutCents ?? 0)} out
                          </p>
                        </div>
                        <span
                          className={`font-semibold text-sm ${
                            net > 0
                              ? 'text-green-400'
                              : net < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {net > 0 ? '+' : ''}
                          {formatCents(net)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Settlement plan */}
            {settlementTransactions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-3">Settlement</h2>
                <div className="space-y-2">
                  {settlementTransactions.map((tx) => {
                    const from = txName(tx.fromPlayer)
                    const to = txName(tx.toPlayer)
                    const fromIsGuest = !tx.fromPlayer.userId
                    const toIsGuest = !tx.toPlayer.userId
                    const isGuest = fromIsGuest || toIsGuest
                    const isBounce = tx.kind !== 'STANDARD'

                    return (
                      <div
                        key={tx.id}
                        className={`bg-[#1a1f2e] rounded-xl border p-4 ${
                          isBounce
                            ? 'border-yellow-500/20'
                            : isGuest
                            ? 'border-purple-500/20'
                            : 'border-gray-800'
                        }`}
                      >
                        {isBounce && (
                          <p className="text-xs text-yellow-500 font-medium uppercase tracking-wide mb-2">
                            {tx.kind === 'BOUNCE_QUALIFIER' ? '↓ Step 1 of 2' : '↑ Step 2 of 2'}
                          </p>
                        )}
                        {isGuest && (
                          <p className="text-xs text-purple-400 font-medium mb-2">
                            Host collects / distributes in person
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white text-sm">
                            <span className="font-medium">{from}</span>
                            <span className="text-gray-500 mx-1.5">→</span>
                            <span className="font-medium">{to}</span>
                          </p>
                          <span className="text-green-400 font-semibold text-sm flex-shrink-0">
                            {formatCents(tx.amountCents)}
                          </span>
                        </div>
                        {isBounce && (
                          <p className="text-gray-500 text-xs mt-1.5">
                            {tx.kind === 'BOUNCE_QUALIFIER'
                              ? `${from} sends ${to} $1.00 first — this qualifies the return payment.`
                              : `${from} then sends ${to} ${formatCents(tx.amountCents)}, settling the debt and returning the $1.00.`}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {session.status === 'ENDED' && (
                  <p className="text-gray-600 text-xs text-center mt-3">
                    Payment confirmations available in the next step.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddPlayer && (
        <AddPlayerModal
          sessionId={session.id}
          existing={existingUserIds}
          groupMembers={groupMembers}
          onClose={() => setShowAddPlayer(false)}
          onAdded={async () => {
            setShowAddPlayer(false)
            await refresh()
          }}
        />
      )}

      {cashOutTarget && (
        <CashOutModal
          player={cashOutTarget}
          sessionId={session.id}
          onClose={() => setCashOutTarget(null)}
          onDone={async () => {
            setCashOutTarget(null)
            await refresh()
          }}
        />
      )}
    </main>
  )
}
