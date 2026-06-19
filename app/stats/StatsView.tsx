'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCents } from '@/lib/utils'
import { zelleDeepLink, zelleInstructions } from '@/lib/zelle'

export type MonthlyBar  = { month: string; netCents: number }
export type GroupBar    = { groupName: string; netCents: number }
export type SessionRow  = {
  id: string; groupName: string; groupId: string
  endedAt: string; netCents: number; buyInCents: number
}
export type BalanceRow = {
  id: string
  sessionId: string
  sessionStatus: string
  sessionEndedAt: string | null
  groupName: string
  groupId: string
  amountCents: number
  kind: string
  bounceGroupId: string | null
  payerConfirmed: boolean
  payeeConfirmed: boolean
  confirmedAt: string | null
  createdAt: string
  fromName: string
  fromUserId: string | null
  fromZelle: string | null
  toName: string
  toUserId: string | null
  toZelle: string | null
}

interface Props {
  allTimeNet: number
  roi: number | null
  sessionsPlayed: number
  longestStreak: number
  monthly: MonthlyBar[]
  byGroup: GroupBar[]
  sessions: SessionRow[]
  balances: BalanceRow[]
  currentUserId: string
}

const GREEN = '#34d399'
const RED   = '#e05050'

function CentsTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (!payload) return null
  const v = payload.value
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={v >= 0 ? GREEN : RED} fontSize={11}>
      {v >= 0 ? '+' : ''}{formatCents(v)}
    </text>
  )
}

function CentsTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="bg-felt-800 border border-felt-600 rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="text-felt-400 mb-1">{label}</p>
      <p className={`font-bold ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {v >= 0 ? '+' : ''}{formatCents(v)}
      </p>
    </div>
  )
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)    return 'just now'
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ── Balances Tab ─────────────────────────────────────────────────────────────
function BalancesTab({ balances, currentUserId }: { balances: BalanceRow[]; currentUserId: string }) {
  const pending  = balances.filter((b) => !(b.payerConfirmed && b.payeeConfirmed))
  const settled  = balances.filter((b) => b.payerConfirmed && b.payeeConfirmed)

  function BalanceCard({ b }: { b: BalanceRow }) {
    const iAmPayer  = b.fromUserId === currentUserId
    const iAmPayee  = b.toUserId === currentUserId
    const fullyDone = b.payerConfirmed && b.payeeConfirmed
    const isBounce  = b.kind !== 'STANDARD'
    const payeeZelle = b.toZelle

    return (
      <div className={`bg-felt-800 rounded-xl border p-4 ${
        fullyDone
          ? 'border-felt-600 opacity-60'
          : isBounce
            ? 'border-amber-500/25'
            : 'border-felt-600'
      }`}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            {isBounce && (
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">
                {b.kind === 'BOUNCE_QUALIFIER' ? 'Bounce — Step 1 of 2' : 'Bounce — Step 2 of 2'}
              </p>
            )}
            <p className="text-felt-100 text-sm font-semibold">
              <span className={iAmPayer ? 'text-red-300' : 'text-emerald-300'}>{b.fromName}</span>
              <span className="text-felt-500 mx-1.5">→</span>
              <span className={iAmPayee ? 'text-emerald-300' : 'text-felt-100'}>{b.toName}</span>
            </p>
            {iAmPayer && !fullyDone && <p className="text-red-400 text-xs mt-0.5">You owe this</p>}
            {iAmPayee && !fullyDone && <p className="text-emerald-400 text-xs mt-0.5">Owed to you</p>}
          </div>
          <span className="text-emerald-400 font-bold text-base flex-shrink-0">{formatCents(b.amountCents)}</span>
        </div>

        {/* Session + group link */}
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/sessions/${b.sessionId}`}
            className="text-xs text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors">
            {b.groupName} session →
          </Link>
          {b.sessionEndedAt && (
            <span className="text-felt-600 text-xs">· ended {timeAgo(b.sessionEndedAt)}</span>
          )}
        </div>

        {/* Bounce explanation */}
        {isBounce && (
          <p className="text-felt-500 text-xs mb-3 leading-relaxed">
            {b.kind === 'BOUNCE_QUALIFIER'
              ? `${b.fromName} sends ${b.toName} $1.00 first — this qualifies the return payment.`
              : `${b.fromName} then sends ${b.toName} ${formatCents(b.amountCents)}, clearing the original debt and returning the $1.00.`}
          </p>
        )}

        {/* Confirmation status */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs rounded-full px-2.5 py-0.5 border ${
            b.payerConfirmed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-felt-700 border-felt-600 text-felt-500'
          }`}>
            {b.fromName} sent {b.payerConfirmed ? '✓' : '…'}
          </span>
          <span className={`text-xs rounded-full px-2.5 py-0.5 border ${
            b.payeeConfirmed
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-felt-700 border-felt-600 text-felt-500'
          }`}>
            {b.toName} received {b.payeeConfirmed ? '✓' : '…'}
          </span>
        </div>

        {/* Timestamps */}
        <div className="space-y-0.5 mb-3">
          <p className="text-felt-600 text-xs">Created {formatTs(b.createdAt)}</p>
          {b.confirmedAt && (
            <p className="text-emerald-700 text-xs">Fully confirmed {formatTs(b.confirmedAt)}</p>
          )}
        </div>

        {/* Zelle action for payer */}
        {iAmPayer && !b.payerConfirmed && (
          <div className="space-y-1.5">
            {payeeZelle ? (
              <>
                <a href={zelleDeepLink(payeeZelle, b.amountCents)} target="_blank" rel="noopener noreferrer"
                  className="block w-full text-center text-sm font-semibold bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-lg py-2 transition-all">
                  Open Zelle →
                </a>
                <p className="text-felt-500 text-xs text-center">{zelleInstructions(payeeZelle, b.amountCents)}</p>
              </>
            ) : (
              <p className="text-felt-500 text-xs text-center bg-felt-700 rounded-lg py-2 px-3">
                {b.toName} hasn&apos;t set a Zelle handle — coordinate directly.
              </p>
            )}
            <Link href={`/sessions/${b.sessionId}`}
              className="block w-full text-center text-xs font-semibold border border-felt-500 hover:border-gold-400/50 text-felt-300 hover:text-gold-400 rounded-lg py-2 transition-all">
              Confirm payment in session →
            </Link>
          </div>
        )}

        {iAmPayee && b.payerConfirmed && !b.payeeConfirmed && (
          <Link href={`/sessions/${b.sessionId}`}
            className="block w-full text-center text-xs font-semibold border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 rounded-lg py-2 transition-all">
            Confirm receipt in session →
          </Link>
        )}

        {iAmPayee && !b.payerConfirmed && !fullyDone && (
          <p className="text-felt-500 text-xs text-center">Waiting for {b.fromName} to send…</p>
        )}
        {iAmPayer && b.payerConfirmed && !b.payeeConfirmed && (
          <p className="text-felt-500 text-xs text-center">Waiting for {b.toName} to confirm receipt…</p>
        )}
      </div>
    )
  }

  if (balances.length === 0) {
    return (
      <div className="bg-felt-800 rounded-2xl border border-felt-600 p-12 text-center shadow-card">
        <p className="text-4xl font-display text-felt-600 mb-3">♦</p>
        <p className="text-felt-400 text-sm">No payment history yet.</p>
        <p className="text-felt-500 text-xs mt-1">Balances appear here after sessions are ended.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="text-felt-200 font-semibold text-sm uppercase tracking-wider mb-3">
            Pending ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((b) => <BalanceCard key={b.id} b={b} />)}
          </div>
        </div>
      )}
      {settled.length > 0 && (
        <div>
          <h3 className="text-felt-500 font-semibold text-sm uppercase tracking-wider mb-3">
            Settled ({settled.length})
          </h3>
          <div className="space-y-3">
            {settled.map((b) => <BalanceCard key={b.id} b={b} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ allTimeNet, roi, sessionsPlayed, longestStreak, monthly, byGroup, sessions }: Omit<Props, 'balances' | 'currentUserId'>) {
  if (sessionsPlayed === 0) {
    return (
      <div className="bg-felt-800 rounded-2xl border border-felt-600 p-12 text-center shadow-card">
        <p className="text-4xl font-display text-felt-600 mb-3">♠</p>
        <p className="text-felt-400 text-sm">No settled sessions yet.</p>
        <p className="text-felt-500 text-xs mt-1">Stats appear after your first session settles.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 relative overflow-hidden ${allTimeNet >= 0 ? 'bg-emerald-950/60 border-emerald-700/40' : 'bg-red-950/60 border-red-700/40'}`}>
          <div className={`absolute inset-0 opacity-10 ${allTimeNet >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <p className="text-xs text-felt-400 uppercase tracking-wider mb-1 relative z-10">All-time net</p>
          <p className={`text-xl font-bold relative z-10 ${allTimeNet >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {allTimeNet > 0 ? '+' : ''}{formatCents(allTimeNet)}
          </p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-950/60 border-amber-700/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-400/10" />
          <p className="text-xs text-amber-300 uppercase tracking-wider mb-1 relative z-10">ROI</p>
          <p className={`text-xl font-bold relative z-10 ${roi !== null && roi >= 0 ? 'text-amber-300' : 'text-red-400'}`}>
            {roi !== null ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl border p-4 bg-indigo-950/60 border-indigo-700/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-400/10" />
          <p className="text-xs text-indigo-300 uppercase tracking-wider mb-1 relative z-10">Sessions</p>
          <p className="text-xl font-bold text-indigo-200 relative z-10">{sessionsPlayed}</p>
        </div>
        <div className="rounded-xl border p-4 bg-felt-800 border-felt-600">
          <p className="text-xs text-felt-400 uppercase tracking-wider mb-1">Best streak</p>
          <p className="text-xl font-bold text-gold-400">{longestStreak > 0 ? `${longestStreak}W` : '—'}</p>
        </div>
      </div>

      {/* Monthly earnings */}
      {monthly.length > 0 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-5 shadow-card">
          <h3 className="text-felt-100 font-semibold mb-4">Monthly earnings</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ left: 16, right: 8, top: 4, bottom: 4 }}>
              <XAxis dataKey="month" tick={{ fill: '#8a3a40', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={<CentsTick />} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<CentsTooltip />} cursor={{ fill: 'rgba(224,80,80,0.06)' }} />
              <Bar dataKey="netCents" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {monthly.map((entry, i) => <Cell key={i} fill={entry.netCents >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-group breakdown */}
      {byGroup.length > 1 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-5 shadow-card">
          <h3 className="text-felt-100 font-semibold mb-4">Net by group</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, byGroup.length * 48)}>
            <BarChart data={byGroup} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" dataKey="netCents" tick={{ fill: '#8a3a40', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCents(v)} />
              <YAxis type="category" dataKey="groupName" tick={{ fill: '#d4a0a8', fontSize: 12 }} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<CentsTooltip />} cursor={{ fill: 'rgba(224,80,80,0.06)' }} />
              <Bar dataKey="netCents" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {byGroup.map((entry, i) => <Cell key={i} fill={entry.netCents >= 0 ? GREEN : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Session history */}
      <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-felt-600">
          <h3 className="text-felt-100 font-semibold">Session history</h3>
        </div>
        {sessions.map((s, i) => (
          <Link key={s.id} href={`/sessions/${s.id}`}
            className={`flex items-center justify-between px-5 py-3.5 hover:bg-felt-700 transition-colors ${i < sessions.length - 1 ? 'border-b border-felt-700' : ''}`}>
            <div>
              <p className="text-felt-100 text-sm font-medium">{s.groupName}</p>
              <p className="text-felt-500 text-xs mt-0.5">
                {new Date(s.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}buy-in {formatCents(s.buyInCents)}
              </p>
            </div>
            <span className={`text-sm font-bold ${s.netCents > 0 ? 'text-emerald-400' : s.netCents < 0 ? 'text-red-400' : 'text-felt-400'}`}>
              {s.netCents > 0 ? '+' : ''}{formatCents(s.netCents)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function StatsView(props: Props) {
  const [tab, setTab] = useState<'stats' | 'balances'>('stats')
  const pendingCount  = props.balances.filter((b) => !(b.payerConfirmed && b.payeeConfirmed)).length

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="font-display text-3xl font-bold text-felt-50 mb-1">My Stats</h1>
          <p className="text-felt-400 text-sm">Your personal ledger across all groups.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-felt-800 rounded-xl p-1 border border-felt-600">
          {([
            { key: 'stats',    label: 'Stats & History' },
            { key: 'balances', label: `My Balances${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === key ? 'bg-gold-400 text-felt-900' : 'text-felt-400 hover:text-felt-100'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'stats' && (
          <StatsTab
            allTimeNet={props.allTimeNet}
            roi={props.roi}
            sessionsPlayed={props.sessionsPlayed}
            longestStreak={props.longestStreak}
            monthly={props.monthly}
            byGroup={props.byGroup}
            sessions={props.sessions}
          />
        )}
        {tab === 'balances' && (
          <BalancesTab balances={props.balances} currentUserId={props.currentUserId} />
        )}
      </div>
    </main>
  )
}
