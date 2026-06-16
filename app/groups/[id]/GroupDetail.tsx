'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCents, formatDate } from '@/lib/utils'
import type { LeaderboardEntry, LeaderboardRange } from '@/lib/leaderboard'

type Member = {
  userId: string
  groupId: string
  role: string
  joinedAt: Date | string
  user: { id: string; displayName: string; avatarUrl: string | null; zelleHandle: string | null; isGuest: boolean }
}
type SessionSummary = {
  id: string
  status: string
  defaultBuyInCents: number
  createdAt: Date | string
  startedAt: Date | string | null
  endedAt: Date | string | null
  host: { id: string; displayName: string }
  _count: { players: number }
}
type Group = {
  id: string
  name: string
  inviteCode: string
  createdById: string
  isCreator: boolean
  createdBy: { id: string; displayName: string }
}

interface GroupDetailProps {
  group: Group
  members: Member[]
  sessions: SessionSummary[]
  leaderboards: Record<LeaderboardRange, LeaderboardEntry[]>
  currentUserRole: string
  currentUserId: string
  isGuest: boolean
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT:   'bg-felt-600/60 text-felt-300 border-felt-500',
  ACTIVE:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  ENDED:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  SETTLED: 'bg-gold-400/10 text-gold-400 border-gold-400/20',
}

const RANGE_LABELS: { value: LeaderboardRange; label: string }[] = [
  { value: 'all-time', label: 'All-time' },
  { value: 'year',     label: 'This year' },
  { value: 'month',    label: 'This month' },
]

const MEDALS = ['🥇', '🥈', '🥉']

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials =
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded-full bg-gold-400/15 border border-gold-400/25 text-gold-400 flex items-center justify-center text-sm font-bold uppercase flex-shrink-0">
      {initials}
    </div>
  )
}

export default function GroupDetail({
  group,
  members,
  sessions,
  leaderboards,
  currentUserId,
  isGuest,
}: GroupDetailProps) {
  const [tab, setTab]         = useState<'leaderboard' | 'members' | 'sessions'>('leaderboard')
  const [range, setRange]     = useState<LeaderboardRange>('all-time')
  const [inviteCode, setCode] = useState(group.inviteCode)
  const [copied, setCopied]   = useState(false)
  const [regen, setRegen]     = useState(false)
  const [memberList, setMemberList]         = useState(members)
  const [kickConfirm, setKickConfirm]       = useState<string | null>(null)
  const [kicking, setKicking]               = useState<string | null>(null)
  const [kickError, setKickError]           = useState('')
  const router = useRouter()

  const isCreator = group.isCreator

  async function kickMember(userId: string) {
    setKicking(userId)
    setKickError('')
    const res = await fetch(`/api/groups/${group.id}/members/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setMemberList((prev) => prev.filter((m) => m.userId !== userId))
      setKickConfirm(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setKickError((d as { error?: string }).error ?? 'Failed to remove member.')
    }
    setKicking(null)
  }

  const leaderboard = leaderboards[range]

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateCode() {
    if (!confirm('Regenerate the invite code? The old code will stop working immediately.')) return
    setRegen(true)
    const res = await fetch(`/api/groups/${group.id}/regenerate-invite`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setCode(data.inviteCode)
    }
    setRegen(false)
  }

  return (
    <div>
      {/* Invite code card */}
      <div className="bg-felt-800 rounded-2xl p-5 border border-felt-600 mb-6 shadow-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-felt-400 uppercase tracking-widest font-medium mb-1">
              Invite code
            </p>
            <p className="text-gold-400 font-mono text-2xl font-bold tracking-[0.3em]">
              {inviteCode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="rounded-lg border border-felt-500 hover:border-gold-400/50 text-felt-300 hover:text-gold-400 px-3 py-1.5 text-sm transition-all"
            >
              {copied ? '✓ Copied' : 'Copy code'}
            </button>
            {group.isCreator && (
              <button
                onClick={regenerateCode}
                disabled={regen}
                className="rounded-lg border border-felt-500 hover:border-felt-400 text-felt-400 hover:text-felt-200 px-3 py-1.5 text-sm transition-all disabled:opacity-50"
              >
                {regen ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-felt-800 rounded-xl p-1 border border-felt-600">
        {(['leaderboard', 'members', 'sessions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-all ${
              tab === t
                ? 'bg-gold-400 text-felt-900'
                : 'text-felt-400 hover:text-felt-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div>
          <div className="flex gap-1.5 mb-4">
            {RANGE_LABELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border ${
                  range === value
                    ? 'bg-gold-400/10 text-gold-400 border-gold-400/30'
                    : 'text-felt-400 border-felt-600 hover:text-felt-200 hover:border-felt-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {leaderboard.length === 0 ? (
            <div className="bg-felt-800 rounded-2xl p-10 text-center border border-felt-600 shadow-card">
              <p className="text-4xl mb-3 opacity-30">♠</p>
              <p className="text-felt-300">No settled sessions yet.</p>
              <p className="text-felt-500 text-sm mt-1">
                The leaderboard updates after sessions are settled.
              </p>
            </div>
          ) : (
            <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-felt-600">
                    <th className="text-left text-xs text-felt-400 uppercase tracking-wider font-semibold px-5 py-3 w-10">#</th>
                    <th className="text-left text-xs text-felt-400 uppercase tracking-wider font-semibold px-3 py-3">Player</th>
                    <th className="text-right text-xs text-felt-400 uppercase tracking-wider font-semibold px-4 py-3">Net P&amp;L</th>
                    <th className="text-right text-xs text-felt-400 uppercase tracking-wider font-semibold px-4 py-3 hidden sm:table-cell">ROI</th>
                    <th className="text-right text-xs text-felt-400 uppercase tracking-wider font-semibold px-5 py-3 hidden sm:table-cell">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr
                      key={entry.userId}
                      className={`border-b border-felt-600/50 last:border-0 transition-colors ${
                        entry.userId === currentUserId
                          ? 'bg-gold-400/5'
                          : i === 0
                          ? 'bg-gold-400/[0.03]'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-4 text-felt-400 text-sm">
                        {i < 3 ? MEDALS[i] : i + 1}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2.5">
                          <Initials name={entry.displayName} />
                          <span className="text-felt-100 text-sm font-medium">
                            {entry.displayName}
                            {entry.userId === currentUserId && (
                              <span className="ml-1.5 text-xs text-felt-500">(you)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`text-sm font-bold ${
                            entry.netCents > 0
                              ? 'text-emerald-400'
                              : entry.netCents < 0
                              ? 'text-red-400'
                              : 'text-felt-400'
                          }`}
                        >
                          {entry.netCents > 0 ? '+' : ''}
                          {formatCents(entry.netCents)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-felt-400 hidden sm:table-cell">
                        {entry.roi > 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-felt-400 hidden sm:table-cell">
                        {entry.sessionsPlayed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
          {kickError && (
            <p className="text-red-400 text-xs text-center px-5 py-2 border-b border-felt-600">{kickError}</p>
          )}
          {memberList.map((m, i) => (
            <div
              key={m.userId}
              className={`flex items-center justify-between px-5 py-4 ${
                i < memberList.length - 1 ? 'border-b border-felt-600' : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Initials name={m.user.displayName} />
                <div className="min-w-0">
                  <p className="text-felt-100 text-sm font-medium">
                    {m.user.displayName}
                    {m.userId === currentUserId && (
                      <span className="ml-1.5 text-xs text-felt-500">(you)</span>
                    )}
                  </p>
                  <p className="text-felt-500 text-xs mt-0.5">Joined {formatDate(m.joinedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.user.isGuest && (
                  <span className="text-xs font-semibold bg-felt-700 text-felt-400 border border-felt-600 rounded-full px-2.5 py-1">
                    Guest
                  </span>
                )}
                {m.userId === group.createdById && (
                  <span className="text-xs font-semibold bg-gold-400/10 text-gold-400 border border-gold-400/20 rounded-full px-2.5 py-1">
                    Creator
                  </span>
                )}
                {m.role === 'HOST_CAPABLE' && m.userId !== group.createdById && !m.user.isGuest && (
                  <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-1">
                    Host
                  </span>
                )}

                {/* Kick controls — only creator sees these, not on themselves */}
                {isCreator && m.userId !== currentUserId && m.userId !== group.createdById && (
                  kickConfirm === m.userId ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-felt-400">Remove?</span>
                      <button
                        onClick={() => kickMember(m.userId)}
                        disabled={kicking === m.userId}
                        className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg px-2.5 py-1 transition-all disabled:opacity-50"
                      >
                        {kicking === m.userId ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => { setKickConfirm(null); setKickError('') }}
                        className="text-xs text-felt-500 hover:text-felt-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setKickConfirm(m.userId); setKickError('') }}
                      className="text-xs text-felt-600 hover:text-red-400 border border-felt-700 hover:border-red-500/40 rounded-lg px-2.5 py-1 transition-all"
                    >
                      Remove
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div>
          {sessions.length === 0 ? (
            <div className="bg-felt-800 rounded-2xl p-10 text-center border border-felt-600 shadow-card">
              <p className="text-felt-300">No sessions yet.</p>
              <p className="text-felt-500 text-sm mt-1">Start a new session to track a game.</p>
            </div>
          ) : (
            <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < sessions.length - 1 ? 'border-b border-felt-600' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span
                        className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${
                          STATUS_STYLE[s.status] ?? STATUS_STYLE.DRAFT
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="text-felt-500 text-xs">
                        {s._count.players} player{s._count.players !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-felt-400 text-sm">
                      {s.host.displayName} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/sessions/${s.id}`)}
                    className="text-sm text-gold-400 hover:text-gold-300 transition-colors font-semibold"
                  >
                    View →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
