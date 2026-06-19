import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import StatsView from './StatsView'
import type { MonthlyBar, GroupBar, SessionRow, BalanceRow } from './StatsView'

export default async function StatsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const userId = session.user.id

  // ── Personal play history ────────────────────────────────────────────────
  const plays = await prisma.sessionPlayer.findMany({
    where: { userId, session: { status: 'SETTLED' } },
    include: {
      buyIns: true,
      session: {
        select: {
          id: true,
          endedAt: true,
          group: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { session: { endedAt: 'asc' } },
  })

  let allTimeNet   = 0
  let allTimeBuyIn = 0
  const sessionRows: SessionRow[] = []

  for (const sp of plays) {
    const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    const net   = (sp.cashOutCents ?? 0) - buyIn
    allTimeNet   += net
    allTimeBuyIn += buyIn
    if (sp.session.endedAt) {
      sessionRows.push({
        id:        sp.session.id,
        groupName: sp.session.group.name,
        groupId:   sp.session.group.id,
        endedAt:   sp.session.endedAt.toISOString(),
        netCents:  net,
        buyInCents: buyIn,
      })
    }
  }

  const roi = allTimeBuyIn > 0
    ? Math.round((allTimeNet / allTimeBuyIn) * 10000) / 100
    : null

  // ── Longest positive streak ──────────────────────────────────────────────
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

  // ── Monthly earnings ─────────────────────────────────────────────────────
  const monthMap = new Map<string, number>()
  for (const row of sessionRows) {
    const d   = new Date(row.endedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) ?? 0) + row.netCents)
  }
  const monthly: MonthlyBar[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, netCents]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      netCents,
    }))

  // ── Per-group breakdown ──────────────────────────────────────────────────
  const groupMap = new Map<string, number>()
  for (const row of sessionRows) {
    groupMap.set(row.groupName, (groupMap.get(row.groupName) ?? 0) + row.netCents)
  }
  const byGroup: GroupBar[] = Array.from(groupMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([groupName, netCents]) => ({ groupName, netCents }))

  // ── My Balances ──────────────────────────────────────────────────────────
  const myPlayers = await prisma.sessionPlayer.findMany({
    where: { userId },
    select: { id: true },
  })
  const myPlayerIds = myPlayers.map((p) => p.id)

  const txs = myPlayerIds.length > 0
    ? await prisma.settlementTransaction.findMany({
        where: {
          OR: [
            { fromPlayerId: { in: myPlayerIds } },
            { toPlayerId:   { in: myPlayerIds } },
          ],
        },
        include: {
          session: {
            select: {
              id: true,
              status: true,
              endedAt: true,
              group: { select: { id: true, name: true } },
            },
          },
          fromPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
          toPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const balances: BalanceRow[] = txs.map((tx) => ({
    id:            tx.id,
    sessionId:     tx.session.id,
    sessionStatus: tx.session.status,
    sessionEndedAt: tx.session.endedAt?.toISOString() ?? null,
    groupName:     tx.session.group.name,
    groupId:       tx.session.group.id,
    amountCents:   tx.amountCents,
    kind:          tx.kind,
    bounceGroupId: tx.bounceGroupId,
    payerConfirmed: tx.payerConfirmed,
    payeeConfirmed: tx.payeeConfirmed,
    confirmedAt:   tx.confirmedAt?.toISOString() ?? null,
    createdAt:     tx.createdAt.toISOString(),
    fromName:      tx.fromPlayer.user?.displayName ?? tx.fromPlayer.guestName ?? 'Unknown',
    fromUserId:    tx.fromPlayer.userId,
    fromZelle:     tx.fromPlayer.user?.zelleHandle ?? null,
    toName:        tx.toPlayer.user?.displayName ?? tx.toPlayer.guestName ?? 'Unknown',
    toUserId:      tx.toPlayer.userId,
    toZelle:       tx.toPlayer.user?.zelleHandle ?? null,
  }))

  return (
    <StatsView
      allTimeNet={allTimeNet}
      roi={roi}
      sessionsPlayed={sessionRows.length}
      longestStreak={longestStreak}
      monthly={monthly}
      byGroup={byGroup}
      sessions={[...sessionRows].reverse()}
      balances={balances}
      currentUserId={userId}
    />
  )
}
