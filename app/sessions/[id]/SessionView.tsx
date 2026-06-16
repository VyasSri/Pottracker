'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCents } from '@/lib/utils'
import { zelleDeepLink, zelleInstructions } from '@/lib/zelle'

type BuyIn    = { id: string; amountCents: number }
type PUser    = { id: string; displayName: string; zelleHandle: string | null }
type Player   = {
  id: string; userId: string | null; guestName: string | null
  leftEarly: boolean; cashOutCents: number | null
  user: PUser | null; buyIns: BuyIn[]
}
type TxPlayer = { id: string; userId: string | null; guestName: string | null; user: PUser | null }
type STx      = {
  id: string; fromPlayerId: string; toPlayerId: string; amountCents: number
  kind: string; bounceGroupId: string | null; payerConfirmed: boolean; payeeConfirmed: boolean
  fromPlayer: TxPlayer; toPlayer: TxPlayer
}
type Session  = {
  id: string; groupId: string; hostId: string; status: string
  defaultBuyInCents: number; roundingMode: string
  group: { id: string; name: string }
  host: { id: string; displayName: string }
  players: Player[]
  settlementTransactions: STx[]
}
type GM = { id: string; displayName: string }

function pName(p: Pick<Player, 'user' | 'guestName'>) { return p.user?.displayName ?? p.guestName ?? 'Unknown' }
function txName(p: TxPlayer) { return p.user?.displayName ?? p.guestName ?? 'Unknown' }
function buyTotal(p: Player)  { return p.buyIns.reduce((s, b) => s + b.amountCents, 0) }

const STATUS_BADGE: Record<string, string> = {
  DRAFT:   'bg-felt-600/60 text-felt-300 border-felt-500',
  ACTIVE:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  ENDED:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  SETTLED: 'bg-gold-400/10 text-gold-400 border-gold-400/30',
}

const inputCls = 'w-full bg-felt-950 border border-felt-500 rounded-lg px-4 py-2.5 text-felt-50 placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors text-sm'

// ─── Add Player Modal ────────────────────────────────────────────────────────
function AddPlayerModal({ sessionId, existing, groupMembers, onClose, onAdded }: {
  sessionId: string; existing: Set<string>; groupMembers: GM[]
  onClose: () => void; onAdded: () => Promise<void>
}) {
  const [mode, setMode]     = useState<'member' | 'guest'>('member')
  const [userId, setUserId] = useState('')
  const [guest, setGuest]   = useState('')
  const [loading, setL]     = useState(false)
  const [error, setE]       = useState('')
  const available           = groupMembers.filter((m) => !existing.has(m.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setL(true); setE('')
    const body = mode === 'member' ? { userId } : { guestName: guest.trim() }
    const res  = await fetch(`/api/sessions/${sessionId}/players`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); setE(d.error ?? 'Failed'); setL(false); return }
    await onAdded()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-felt-800 rounded-2xl border border-felt-600 shadow-card w-full max-w-sm p-6">
        <h2 className="text-felt-50 font-semibold text-lg mb-4">Add Player</h2>
        <div className="flex gap-1 mb-4 bg-felt-900 rounded-lg p-1">
          {(['member', 'guest'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${mode === m ? 'bg-gold-400 text-felt-900' : 'text-felt-400 hover:text-felt-100'}`}>
              {m === 'member' ? 'Group member' : 'Guest'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'member' ? (
            available.length === 0
              ? <p className="text-felt-500 text-sm text-center py-3">All members are already in this session.</p>
              : <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={inputCls}>
                  <option value="">Select a member…</option>
                  {available.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
          ) : (
            <input type="text" placeholder="Guest name" value={guest} onChange={(e) => setGuest(e.target.value)}
              maxLength={50} required className={inputCls} />
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-felt-500 hover:border-felt-400 text-felt-300 rounded-lg py-2.5 text-sm font-medium transition-all">Cancel</button>
            <button type="submit"
              disabled={loading || (mode === 'member' && (!userId || !available.length)) || (mode === 'guest' && !guest.trim())}
              className="flex-1 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-felt-900 rounded-lg py-2.5 text-sm font-bold transition-all">
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Record Results Modal ────────────────────────────────────────────────────
function RecordResultsModal({ player, sessionId, defaultBuyInCents, onClose, onDone }: {
  player: Player; sessionId: string; defaultBuyInCents: number
  onClose: () => void; onDone: () => Promise<void>
}) {
  const existingTotal             = buyTotal(player)
  const prefill                   = existingTotal > 0 ? existingTotal : defaultBuyInCents
  const [invested, setInvested]   = useState((prefill / 100).toFixed(2))
  const [cashOut, setCashOut]     = useState((player.cashOutCents != null ? player.cashOutCents / 100 : 0).toFixed(2))
  const [leftEarly, setLeftEarly] = useState(player.leftEarly)
  const [loading, setL]           = useState(false)
  const [error, setE]             = useState('')

  const investedCents = Math.round(parseFloat(invested) * 100)
  const cashOutCents  = Math.round(parseFloat(cashOut) * 100)
  const netCents      = isNaN(investedCents) || isNaN(cashOutCents) ? null : cashOutCents - investedCents

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(investedCents) || investedCents <= 0) { setE('Enter a valid buy-in amount'); return }
    if (isNaN(cashOutCents) || cashOutCents < 0)    { setE('Enter a valid cash-out amount'); return }
    setL(true); setE('')
    const res = await fetch(`/api/sessions/${sessionId}/players/${player.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalBuyInCents: investedCents, cashOutCents, leftEarly }),
    })
    if (!res.ok) { const d = await res.json(); setE(d.error ?? 'Failed'); setL(false); return }
    await onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-felt-800 rounded-2xl border border-felt-600 shadow-card w-full max-w-sm p-6">
        <h2 className="text-felt-50 font-semibold text-lg mb-1">Record Results</h2>
        <p className="text-felt-400 text-sm mb-5">{pName(player)}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-felt-400 uppercase tracking-wider mb-1.5">Total invested (buy-ins + rebuys)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-felt-400 text-sm">$</span>
              <input type="number" min="0.01" step="0.01" value={invested}
                onChange={(e) => setInvested(e.target.value)} required
                className={`${inputCls} pl-8`} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-felt-400 uppercase tracking-wider mb-1.5">Final stack (cash out)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-felt-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" value={cashOut}
                onChange={(e) => setCashOut(e.target.value)} required
                className={`${inputCls} pl-8`} />
            </div>
          </div>
          {netCents !== null && (
            <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-center border ${netCents >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              Net: {netCents >= 0 ? '+' : ''}{formatCents(netCents)}
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={leftEarly} onChange={(e) => setLeftEarly(e.target.checked)} className="accent-gold-400" />
            <span className="text-sm text-felt-300">Player is leaving early</span>
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-felt-500 hover:border-felt-400 text-felt-300 rounded-lg py-2.5 text-sm font-medium transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-felt-900 rounded-lg py-2.5 text-sm font-bold transition-all">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Settlement Panel ────────────────────────────────────────────────────────
function SettlementPanel({ transactions, sessionId, sessionStatus, currentUserId, onRefresh }: {
  transactions: STx[]
  sessionId: string
  sessionStatus: string
  currentUserId: string
  onRefresh: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  async function confirm(txId: string) {
    setConfirming(txId)
    setErrors((e) => ({ ...e, [txId]: '' }))
    const res = await fetch(`/api/sessions/${sessionId}/transactions/${txId}/confirm`, { method: 'POST' })
    if (!res.ok) {
      const d = await res.json()
      setErrors((e) => ({ ...e, [txId]: d.error ?? 'Failed' }))
    } else {
      await onRefresh()
    }
    setConfirming(null)
  }

  const allSettled = transactions.every((t) => t.payerConfirmed && t.payeeConfirmed)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-felt-100 font-semibold text-lg">Settlement</h2>
        {sessionStatus === 'SETTLED' && (
          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
            All settled ✓
          </span>
        )}
      </div>
      <div className="space-y-3">
        {transactions.map((tx) => {
          const from     = txName(tx.fromPlayer)
          const to       = txName(tx.toPlayer)
          const isBounce = tx.kind !== 'STANDARD'
          const isGuest  = !tx.fromPlayer.userId || !tx.toPlayer.userId
          const isPayer  = tx.fromPlayer.userId === currentUserId
          const isPayee  = tx.toPlayer.userId === currentUserId
          const fullyConfirmed = tx.payerConfirmed && tx.payeeConfirmed
          const payeeHandle = tx.toPlayer.user?.zelleHandle

          return (
            <div key={tx.id} className={`bg-felt-800 rounded-xl border p-4 shadow-card ${
              fullyConfirmed
                ? 'border-emerald-500/30 opacity-70'
                : isBounce
                  ? 'border-amber-500/25'
                  : isGuest
                    ? 'border-gold-400/20'
                    : 'border-felt-600'
            }`}>
              {isBounce && (
                <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-2">
                  {tx.kind === 'BOUNCE_QUALIFIER' ? '↓ Step 1 of 2' : '↑ Step 2 of 2'}
                </p>
              )}
              {isGuest && !isBounce && (
                <p className="text-xs text-gold-400 font-semibold mb-2">Host handles in person</p>
              )}

              {/* Transaction summary row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-felt-100 text-sm">
                  <span className="font-semibold">{from}</span>
                  <span className="text-felt-500 mx-1.5">→</span>
                  <span className="font-semibold">{to}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold text-sm">{formatCents(tx.amountCents)}</span>
                  {fullyConfirmed && <span className="text-emerald-400 text-xs">✓</span>}
                </div>
              </div>

              {isBounce && (
                <p className="text-felt-500 text-xs mb-2">
                  {tx.kind === 'BOUNCE_QUALIFIER'
                    ? `${from} sends ${to} $1.00 first — this qualifies the return payment.`
                    : `${from} then sends ${to} ${formatCents(tx.amountCents)}, clearing the debt and returning the $1.00.`}
                </p>
              )}

              {/* Confirmation status pills */}
              <div className="flex flex-wrap items-center gap-2 mt-1 mb-3">
                <span className={`text-xs rounded-full px-2.5 py-0.5 border ${
                  tx.payerConfirmed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-felt-700 border-felt-600 text-felt-500'
                }`}>
                  {from} sent {tx.payerConfirmed ? '✓' : '…'}
                </span>
                <span className={`text-xs rounded-full px-2.5 py-0.5 border ${
                  tx.payeeConfirmed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-felt-700 border-felt-600 text-felt-500'
                }`}>
                  {to} received {tx.payeeConfirmed ? '✓' : '…'}
                </span>
              </div>

              {/* Action buttons */}
              {!fullyConfirmed && (
                <div className="space-y-2">
                  {/* Zelle link for payer */}
                  {isPayer && !tx.payerConfirmed && payeeHandle && (
                    <div className="flex flex-col gap-1.5">
                      <a
                        href={zelleDeepLink(payeeHandle, tx.amountCents)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center text-sm font-semibold bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg py-2 transition-all"
                      >
                        Open Zelle →
                      </a>
                      <p className="text-felt-500 text-xs text-center">
                        {zelleInstructions(payeeHandle, tx.amountCents)}
                      </p>
                    </div>
                  )}
                  {isPayer && !tx.payerConfirmed && !payeeHandle && (
                    <p className="text-felt-500 text-xs text-center bg-felt-700 rounded-lg py-2 px-3">
                      {to} hasn&apos;t set a Zelle handle — coordinate directly.
                    </p>
                  )}

                  {/* Confirm buttons */}
                  {isPayer && !tx.payerConfirmed && (
                    <button
                      onClick={() => confirm(tx.id)}
                      disabled={confirming === tx.id}
                      className="w-full text-sm font-bold bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-felt-900 rounded-lg py-2 transition-all"
                    >
                      {confirming === tx.id ? 'Confirming…' : 'I sent it ✓'}
                    </button>
                  )}
                  {isPayee && tx.payerConfirmed && !tx.payeeConfirmed && (
                    <button
                      onClick={() => confirm(tx.id)}
                      disabled={confirming === tx.id}
                      className="w-full text-sm font-bold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg py-2 transition-all disabled:opacity-50"
                    >
                      {confirming === tx.id ? 'Confirming…' : 'I received it ✓'}
                    </button>
                  )}
                  {isPayee && !tx.payerConfirmed && (
                    <p className="text-felt-500 text-xs text-center">Waiting for {from} to send…</p>
                  )}
                  {isPayer && tx.payerConfirmed && !tx.payeeConfirmed && (
                    <p className="text-felt-500 text-xs text-center">Waiting for {to} to confirm receipt…</p>
                  )}
                  {errors[tx.id] && <p className="text-red-400 text-xs text-center">{errors[tx.id]}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!allSettled && sessionStatus === 'ENDED' && (
        <p className="text-felt-600 text-xs text-center mt-3">Session settles automatically when all payments are confirmed.</p>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function SessionView({ session: init, groupMembers, isHost, currentUserId }: {
  session: Session; groupMembers: GM[]; isHost: boolean; currentUserId: string
}) {
  const [session, setSes]           = useState(init)
  const [showAdd, setShowAdd]       = useState(false)
  const [recordFor, setRecordFor]   = useState<Player | null>(null)
  const [startLoad, setStartLoad]   = useState(false)
  const [endLoad, setEndLoad]       = useState(false)
  const [endError, setEndError]     = useState('')
  const [confirmDelete, setConfirm] = useState(false)
  const [deleteLoad, setDeleteLoad] = useState(false)
  const [deleteError, setDeleteErr] = useState('')

  async function refresh() {
    const res = await fetch(`/api/sessions/${session.id}`)
    if (res.ok) setSes((await res.json()).session)
  }
  async function startSession() {
    setStartLoad(true)
    await fetch(`/api/sessions/${session.id}/start`, { method: 'POST' })
    await refresh(); setStartLoad(false)
  }
  async function deleteSession() {
    setDeleteLoad(true); setDeleteErr('')
    const res = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.href = `/groups/${session.groupId}`
    } else {
      const d = await res.json()
      setDeleteErr(d.error ?? 'Failed to delete session')
      setDeleteLoad(false)
    }
  }
  async function endSession() {
    setEndLoad(true); setEndError('')
    const res = await fetch(`/api/sessions/${session.id}/end`, { method: 'POST' })
    if (res.ok) { await refresh() } else {
      const d = await res.json()
      if (d.discrepancyCents !== undefined) {
        const abs = Math.abs(d.discrepancyCents)
        setEndError(`Conservation check: cash-outs are ${formatCents(abs)} ${d.discrepancyCents > 0 ? 'over' : 'short'}.`)
      } else if (d.playerName) {
        setEndError(`${d.playerName}'s results haven't been recorded yet.`)
      } else {
        setEndError(d.error ?? 'Failed to end session')
      }
    }
    setEndLoad(false)
  }

  const { players, settlementTransactions } = session
  const totalBuyIns  = players.reduce((s, p) => s + buyTotal(p), 0)
  const totalCashOut = players.reduce((s, p) => s + (p.cashOutCents ?? 0), 0)
  const uncashed     = totalBuyIns - totalCashOut
  const discrepancy  = totalCashOut - totalBuyIns
  const allCashedOut = players.length > 0 && players.every((p) => p.cashOutCents !== null)
  const existingIds  = new Set(players.filter((p) => p.userId).map((p) => p.userId!))

  return (
    <main className="min-h-screen bg-felt-900 px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-felt-400 text-sm mb-6 min-w-0">
          <Link href="/groups" className="hover:text-felt-100 transition-colors flex-shrink-0">Groups</Link>
          <span>/</span>
          <Link href={`/groups/${session.groupId}`} className="hover:text-felt-100 transition-colors truncate max-w-[120px] sm:max-w-none">{session.group.name}</Link>
          <span>/</span>
          <span className="text-felt-100 flex-shrink-0">Session</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-7">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold rounded-full px-3 py-1 border flex-shrink-0 ${STATUS_BADGE[session.status] ?? STATUS_BADGE.DRAFT}`}>
              {session.status}
            </span>
            <div>
              <p className="text-felt-100 font-semibold">
                Hosted by {session.host.displayName}
                {session.host.id === currentUserId && <span className="text-felt-500 font-normal text-sm ml-1">(you)</span>}
              </p>
              <p className="text-felt-500 text-xs">
                Default buy-in: {formatCents(session.defaultBuyInCents)} · {session.roundingMode === 'BOUNCE' ? 'Bounce mode' : 'Carry-forward mode'}
              </p>
            </div>
          </div>

          {isHost && (session.status === 'DRAFT' || session.status === 'ACTIVE') && (
            <div className="flex-shrink-0">
              {!confirmDelete ? (
                <button onClick={() => setConfirm(true)}
                  className="text-xs text-felt-500 hover:text-red-400 border border-felt-600 hover:border-red-500/40 rounded-lg px-3 py-1.5 transition-all">
                  Delete session
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-400">Are you sure?</span>
                    <button onClick={deleteSession} disabled={deleteLoad}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
                      {deleteLoad ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button onClick={() => { setConfirm(false); setDeleteErr('') }}
                      className="text-xs text-felt-500 hover:text-felt-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                  {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DRAFT ── */}
        {session.status === 'DRAFT' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-felt-100 font-semibold text-lg">Players ({players.length})</h2>
              {isHost && (
                <button onClick={() => setShowAdd(true)}
                  className="text-sm text-gold-400 hover:text-gold-300 font-semibold transition-colors">
                  + Add player
                </button>
              )}
            </div>
            {players.length === 0 ? (
              <div className="bg-felt-800 rounded-2xl border border-felt-600 p-8 text-center shadow-card">
                <p className="text-felt-400 text-sm">No players yet.</p>
              </div>
            ) : (
              <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
                {players.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-2 px-5 py-4 ${i < players.length - 1 ? 'border-b border-felt-600' : ''}`}>
                    <span className="text-felt-100 text-sm">{pName(p)}</span>
                    {!p.userId && <span className="text-xs text-felt-500 bg-felt-700 rounded-full px-2 py-0.5">Guest</span>}
                  </div>
                ))}
              </div>
            )}
            {isHost && (
              <div className="pt-2">
                {players.length < 2 && <p className="text-felt-500 text-sm text-center mb-3">Need at least 2 players to start.</p>}
                <button onClick={startSession} disabled={startLoad || players.length < 2}
                  className="w-full bg-gold-400 hover:bg-gold-300 disabled:bg-gold-400/30 text-felt-900 font-bold py-3 rounded-xl transition-all">
                  {startLoad ? 'Starting…' : '▶ Start Session'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE ── */}
        {session.status === 'ACTIVE' && (
          <div className="space-y-4">
            {/* Chip tracker */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Buy-ins',    value: formatCents(totalBuyIns),  color: 'text-felt-100' },
                { label: 'Cashed out', value: formatCents(totalCashOut), color: 'text-felt-100' },
                { label: 'Remaining',  value: formatCents(uncashed),     color: uncashed === 0 ? 'text-emerald-400' : 'text-felt-100' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`bg-felt-800 rounded-xl border ${uncashed === 0 && label === 'Remaining' ? 'border-emerald-500/30' : 'border-felt-600'} p-4 text-center shadow-card`}>
                  <p className="text-xs text-felt-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className={`font-bold text-lg ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-felt-100 font-semibold text-lg">Players</h2>
              {isHost && (
                <button onClick={() => setShowAdd(true)}
                  className="text-sm text-gold-400 hover:text-gold-300 font-semibold transition-colors">
                  + Add player
                </button>
              )}
            </div>

            <div className="space-y-2">
              {players.map((p) => {
                const total     = buyTotal(p)
                const net       = (p.cashOutCents ?? 0) - total
                const recorded  = p.cashOutCents !== null
                return (
                  <div key={p.id} className={`bg-felt-800 rounded-xl border border-felt-600 p-4 transition-all ${recorded ? 'opacity-60' : 'hover:border-felt-500'} shadow-card`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-felt-100 font-semibold text-sm">{pName(p)}</span>
                          {!p.userId && <span className="text-xs text-felt-500 bg-felt-700 rounded-full px-2 py-0.5">Guest</span>}
                          {p.leftEarly && <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">Left early</span>}
                        </div>
                        {recorded ? (
                          <p className="text-felt-500 text-xs mt-1">
                            {formatCents(total)} in · {formatCents(p.cashOutCents!)} out
                            <span className={`ml-1 font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ({net >= 0 ? '+' : ''}{formatCents(net)})
                            </span>
                          </p>
                        ) : (
                          <p className="text-felt-600 text-xs mt-1">Results not yet recorded</p>
                        )}
                      </div>
                      {isHost && (
                        <button onClick={() => setRecordFor(p)}
                          className={`text-xs rounded-lg px-2.5 py-1.5 transition-all flex-shrink-0 ${recorded ? 'border border-felt-500 hover:border-felt-400 text-felt-400 hover:text-felt-100' : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'}`}>
                          {recorded ? 'Edit' : 'Record results'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {isHost && (
              <div className="pt-2 space-y-2">
                {!allCashedOut && <p className="text-felt-500 text-sm text-center">Record results for all players first.</p>}
                {allCashedOut && discrepancy !== 0 && (
                  <p className="text-amber-400 text-sm text-center">
                    Totals don&apos;t balance: {formatCents(Math.abs(discrepancy))} {discrepancy > 0 ? 'over' : 'short'}. Edit a player&apos;s results to fix.
                  </p>
                )}
                {endError && <p className="text-red-400 text-sm text-center">{endError}</p>}
                <button onClick={endSession} disabled={endLoad || !allCashedOut || discrepancy !== 0}
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 border border-amber-500/30 text-amber-400 font-bold py-3 rounded-xl transition-all">
                  {endLoad ? 'Ending session…' : '■ End Session'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ENDED / SETTLED ── */}
        {(session.status === 'ENDED' || session.status === 'SETTLED') && (
          <div className="space-y-6">
            <div>
              <h2 className="text-felt-100 font-semibold text-lg mb-3">Final Results</h2>
              <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
                {[...players]
                  .sort((a, b) => ((b.cashOutCents ?? 0) - buyTotal(b)) - ((a.cashOutCents ?? 0) - buyTotal(a)))
                  .map((p, i) => {
                    const total = buyTotal(p)
                    const net   = (p.cashOutCents ?? 0) - total
                    return (
                      <div key={p.id} className={`flex items-center justify-between px-5 py-4 ${i < players.length - 1 ? 'border-b border-felt-600' : ''}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-felt-100 font-medium text-sm">{pName(p)}</span>
                            {!p.userId && <span className="text-xs text-felt-500 bg-felt-700 rounded-full px-2 py-0.5">Guest</span>}
                          </div>
                          <p className="text-felt-500 text-xs mt-0.5">{formatCents(total)} in · {formatCents(p.cashOutCents ?? 0)} out</p>
                        </div>
                        <span className={`font-bold text-sm ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-felt-400'}`}>
                          {net > 0 ? '+' : ''}{formatCents(net)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {settlementTransactions.length > 0 && (
              <SettlementPanel
                transactions={settlementTransactions}
                sessionId={session.id}
                sessionStatus={session.status}
                currentUserId={currentUserId}
                onRefresh={refresh}
              />
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <AddPlayerModal sessionId={session.id} existing={existingIds} groupMembers={groupMembers}
          onClose={() => setShowAdd(false)} onAdded={async () => { setShowAdd(false); await refresh() }} />
      )}
      {recordFor && (
        <RecordResultsModal player={recordFor} sessionId={session.id} defaultBuyInCents={session.defaultBuyInCents}
          onClose={() => setRecordFor(null)} onDone={async () => { setRecordFor(null); await refresh() }} />
      )}
    </main>
  )
}
