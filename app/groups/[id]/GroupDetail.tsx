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
  user: {
    id: string
    displayName: string
    avatarUrl: string | null
    zelleHandle: string | null
  }
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
}

const SESSION_STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  ACTIVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  ENDED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  SETTLED: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const RANGE_LABELS: { value: LeaderboardRange; label: string }[] = [
  { value: 'all-time', label: 'All-time' },
  { value: 'year', label: 'This year' },
  { value: 'month', label: 'This month' },
]

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2)
  return (
    <div className="w-9 h-9 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-semibold uppercase flex-shrink-0">
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
}: GroupDetailProps) {
  const [tab, setTab] = useState<'leaderboard' | 'members' | 'sessions'>('leaderboard')
  const [range, setRange] = useState<LeaderboardRange>('all-time')
  const [inviteCode, setInviteCode] = useState(group.inviteCode)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const router = useRouter()

  const leaderboard = leaderboards[range]

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateCode() {
    if (!confirm('Regenerate the invite code? The old code will stop working immediately.')) return
    setRegenerating(true)
    const res = await fetch(`/api/groups/${group.id}/regenerate-invite`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setInviteCode(data.inviteCode)
    }
    setRegenerating(false)
  }

  return (
    <div>
      {/* Invite code card */}
      <div className="bg-[#1a1f2e] rounded-2xl p-5 border border-gray-800 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
              Invite code
            </p>
            <p className="text-white font-mono text-2xl font-bold tracking-widest">{inviteCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-3 py-1.5 text-sm transition-colors"
            >
              {copied ? 'Copied!' : 'Copy code'}
            </button>
            {group.isCreator && (
              <button
                onClick={regenerateCode}
                disabled={regenerating}
                className="rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1a1f2e] rounded-xl p-1 border border-gray-800">
        {(['leaderboard', 'members', 'sessions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-green-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        <div>
          {/* Date range filter */}
          <div className="flex gap-1 mb-4">
            {RANGE_LABELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                  range === value
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'text-gray-500 border-gray-800 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {leaderboard.length === 0 ? (
            <div className="bg-[#1a1f2e] rounded-2xl p-10 text-center border border-gray-800">
              <p className="text-gray-400">No settled sessions{range !== 'all-time' ? ` for ${RANGE_LABELS.find(r => r.value === range)?.label.toLowerCase()}` : ''} yet.</p>
              <p className="text-gray-500 text-sm mt-1">
                The leaderboard updates after sessions are settled.
              </p>
            </div>
          ) : (
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3 w-8">
                      #
                    </th>
                    <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-3 py-3">
                      Player
                    </th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider font-medium px-4 py-3">
                      Net P&amp;L
                    </th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider font-medium px-4 py-3 hidden sm:table-cell">
                      ROI
                    </th>
                    <th className="text-right text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3 hidden sm:table-cell">
                      Sessions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr
                      key={entry.userId}
                      className={`border-b border-gray-800/50 last:border-0 ${
                        entry.userId === currentUserId ? 'bg-green-500/5' : ''
                      }`}
                    >
                      <td className="px-5 py-4 text-gray-500 text-sm">{i + 1}</td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2.5">
                          <Initials name={entry.displayName} />
                          <span className="text-white text-sm font-medium">
                            {entry.displayName}
                            {entry.userId === currentUserId && (
                              <span className="ml-1.5 text-xs text-gray-500">(you)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            entry.netCents > 0
                              ? 'text-green-400'
                              : entry.netCents < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {entry.netCents > 0 ? '+' : ''}
                          {formatCents(entry.netCents)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-400 hidden sm:table-cell">
                        {entry.roi > 0 ? '+' : ''}
                        {entry.roi.toFixed(1)}%
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-400 hidden sm:table-cell">
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
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
          {members.map((m, i) => (
            <div
              key={m.userId}
              className={`flex items-center justify-between px-5 py-4 ${
                i < members.length - 1 ? 'border-b border-gray-800' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Initials name={m.user.displayName} />
                <div>
                  <p className="text-white text-sm font-medium">
                    {m.user.displayName}
                    {m.userId === currentUserId && (
                      <span className="ml-1.5 text-xs text-gray-500">(you)</span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Joined {formatDate(m.joinedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.userId === group.createdById && (
                  <span className="text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full px-2.5 py-1">
                    Creator
                  </span>
                )}
                {m.role === 'HOST_CAPABLE' && (
                  <span className="text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2.5 py-1">
                    Host
                  </span>
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
            <div className="bg-[#1a1f2e] rounded-2xl p-10 text-center border border-gray-800">
              <p className="text-gray-400">No sessions yet.</p>
              <p className="text-gray-500 text-sm mt-1">Start a new session to track a game.</p>
            </div>
          ) : (
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
              {sessions.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < sessions.length - 1 ? 'border-b border-gray-800' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span
                        className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${
                          SESSION_STATUS_STYLE[s.status] ?? SESSION_STATUS_STYLE.DRAFT
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {s._count.players} player{s._count.players !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Host: {s.host.displayName} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/sessions/${s.id}`)}
                    className="text-sm text-green-400 hover:text-green-300 transition-colors font-medium"
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
