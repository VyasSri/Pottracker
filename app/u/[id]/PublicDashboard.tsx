'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCents } from '@/lib/utils'

export type MonthlyBar  = { month: string; netCents: number }
export type GroupBar    = { groupName: string; netCents: number }
export type SessionRow  = {
  id: string
  groupName: string
  endedAt: string
  netCents: number
  buyInCents: number
}

interface Props {
  displayName: string
  allTimeNet: number
  roi: number | null
  sessionsPlayed: number
  longestStreak: number
  monthly: MonthlyBar[]
  byGroup: GroupBar[]
  sessions: SessionRow[]
}

const RED   = '#e05050'
const DARK  = '#8a1a1a'
const GREEN = '#34d399'

function CentsTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (!payload) return null
  const v = payload.value
  const color = v >= 0 ? GREEN : RED
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={color} fontSize={11}>
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

export default function PublicDashboard({
  displayName, allTimeNet, roi, sessionsPlayed, longestStreak,
  monthly, byGroup, sessions,
}: Props) {
  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'All-time net',
            value: (allTimeNet > 0 ? '+' : '') + formatCents(allTimeNet),
            color: allTimeNet >= 0 ? 'text-emerald-400' : 'text-red-400',
            bg: allTimeNet >= 0 ? 'bg-emerald-950/60 border-emerald-700/40' : 'bg-red-950/60 border-red-700/40',
          },
          {
            label: 'ROI',
            value: roi !== null ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '—',
            color: roi !== null && roi >= 0 ? 'text-gold-300' : 'text-red-400',
            bg: 'bg-felt-800 border-felt-600',
          },
          {
            label: 'Sessions',
            value: String(sessionsPlayed),
            color: 'text-felt-100',
            bg: 'bg-felt-800 border-felt-600',
          },
          {
            label: 'Best streak',
            value: longestStreak > 0 ? `${longestStreak}W` : '—',
            color: 'text-gold-400',
            bg: 'bg-felt-800 border-felt-600',
          },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <p className="text-xs text-felt-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Monthly earnings chart */}
      {monthly.length > 0 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-5 shadow-card">
          <h2 className="text-felt-100 font-semibold mb-4">Monthly earnings</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ left: 16, right: 8, top: 4, bottom: 4 }}>
              <XAxis
                dataKey="month"
                tick={{ fill: '#8a3a40', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={<CentsTick />} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<CentsTooltip />} cursor={{ fill: 'rgba(224,80,80,0.06)' }} />
              <Bar dataKey="netCents" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {monthly.map((entry, i) => (
                  <Cell key={i} fill={entry.netCents >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-group breakdown */}
      {byGroup.length > 1 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-5 shadow-card">
          <h2 className="text-felt-100 font-semibold mb-4">Net by group</h2>
          <ResponsiveContainer width="100%" height={Math.max(160, byGroup.length * 48)}>
            <BarChart
              data={byGroup}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                dataKey="netCents"
                tick={{ fill: '#8a3a40', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCents(v)}
              />
              <YAxis
                type="category"
                dataKey="groupName"
                tick={{ fill: '#d4a0a8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip content={<CentsTooltip />} cursor={{ fill: 'rgba(224,80,80,0.06)' }} />
              <Bar dataKey="netCents" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {byGroup.map((entry, i) => (
                  <Cell key={i} fill={entry.netCents >= 0 ? GREEN : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Session history */}
      {sessions.length > 0 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden shadow-card">
          <div className="px-5 py-4 border-b border-felt-600">
            <h2 className="text-felt-100 font-semibold">Session history</h2>
          </div>
          {sessions.map((s, i) => {
            const net = s.netCents
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between px-5 py-3.5 ${i < sessions.length - 1 ? 'border-b border-felt-700' : ''}`}
              >
                <div>
                  <p className="text-felt-100 text-sm font-medium">{s.groupName}</p>
                  <p className="text-felt-500 text-xs mt-0.5">
                    {new Date(s.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}buy-in {formatCents(s.buyInCents)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-felt-400'}`}>
                  {net > 0 ? '+' : ''}{formatCents(net)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="bg-felt-800 rounded-2xl border border-felt-600 p-10 text-center shadow-card">
          <p className="text-felt-400 text-sm">{displayName} hasn&apos;t played any settled sessions yet.</p>
        </div>
      )}
    </div>
  )
}
