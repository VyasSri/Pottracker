import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PublicDashboard from './PublicDashboard'
import type { MonthlyBar, GroupBar, SessionRow } from './PublicDashboard'

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, displayName: true, dashboardPublic: true },
  })

  if (!user || !user.dashboardPublic) notFound()

  const plays = await prisma.sessionPlayer.findMany({
    where: { userId: user.id, session: { status: 'SETTLED' } },
    include: {
      buyIns: true,
      session: {
        select: { id: true, endedAt: true, group: { select: { id: true, name: true } } },
      },
    },
    orderBy: { session: { endedAt: 'asc' } },
  })

  // ── Core stats ──────────────────────────────────────────────────────────────
  let allTimeNet    = 0
  let allTimeBuyIn  = 0

  const sessionRows: SessionRow[] = []

  for (const sp of plays) {
    const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    const net   = (sp.cashOutCents ?? 0) - buyIn
    allTimeNet   += net
    allTimeBuyIn += buyIn

    if (sp.session.endedAt) {
      sessionRows.push({
        id:         sp.session.id,
        groupName:  sp.session.group.name,
        endedAt:    sp.session.endedAt.toISOString(),
        netCents:   net,
        buyInCents: buyIn,
      })
    }
  }

  const roi = allTimeBuyIn > 0
    ? Math.round((allTimeNet / allTimeBuyIn) * 10000) / 100
    : null

  // ── Longest positive streak ─────────────────────────────────────────────────
  let longestStreak = 0
  let currentStreak = 0
  for (const row of sessionRows) {
    if (row.netCents > 0) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  // ── Monthly earnings ────────────────────────────────────────────────────────
  const monthMap = new Map<string, number>()
  for (const row of sessionRows) {
    const d     = new Date(row.endedAt)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) ?? 0) + row.netCents)
  }
  const monthly: MonthlyBar[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, netCents]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      netCents,
    }))

  // ── Per-group breakdown ─────────────────────────────────────────────────────
  const groupMap = new Map<string, number>()
  for (const row of sessionRows) {
    groupMap.set(row.groupName, (groupMap.get(row.groupName) ?? 0) + row.netCents)
  }
  const byGroup: GroupBar[] = Array.from(groupMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([groupName, netCents]) => ({ groupName, netCents }))

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-felt-900"
              style={{ background: 'linear-gradient(135deg, #e05050, #c53030)' }}
            >
              {user.displayName[0].toUpperCase()}
            </div>
            <h1 className="font-display text-3xl font-bold text-felt-50">{user.displayName}</h1>
          </div>
          <p className="text-felt-500 text-sm ml-13">Public stats dashboard</p>
        </div>

        <PublicDashboard
          displayName={user.displayName}
          allTimeNet={allTimeNet}
          roi={roi}
          sessionsPlayed={sessionRows.length}
          longestStreak={longestStreak}
          monthly={monthly}
          byGroup={byGroup}
          sessions={[...sessionRows].reverse()}
        />
      </div>
    </main>
  )
}
