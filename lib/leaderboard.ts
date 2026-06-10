export type LeaderboardRange = 'all-time' | 'year' | 'month'

export type LeaderboardEntry = {
  userId: string
  displayName: string
  netCents: number
  totalBuyInCents: number
  sessionsPlayed: number
  roi: number
}

type SettledSession = {
  endedAt: Date | null
  players: {
    userId: string | null
    user: { id: string; displayName: string } | null
    cashOutCents: number | null
    buyIns: { amountCents: number }[]
  }[]
}

export function computeLeaderboard(
  sessions: SettledSession[],
  range: LeaderboardRange = 'all-time'
): LeaderboardEntry[] {
  const now = new Date()
  const filtered = sessions.filter((s) => {
    if (range === 'all-time') return true
    if (!s.endedAt) return false
    const end = new Date(s.endedAt)
    if (range === 'year') return end.getFullYear() === now.getFullYear()
    // month
    return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth()
  })

  const statsMap = new Map<
    string,
    { userId: string; displayName: string; netCents: number; totalBuyInCents: number; sessionsPlayed: number }
  >()

  for (const s of filtered) {
    for (const player of s.players) {
      if (!player.userId || !player.user) continue
      const buyInTotal = player.buyIns.reduce((sum, b) => sum + b.amountCents, 0)
      const net = (player.cashOutCents ?? 0) - buyInTotal

      const existing = statsMap.get(player.userId)
      if (existing) {
        existing.netCents += net
        existing.totalBuyInCents += buyInTotal
        existing.sessionsPlayed += 1
      } else {
        statsMap.set(player.userId, {
          userId: player.userId,
          displayName: player.user.displayName,
          netCents: net,
          totalBuyInCents: buyInTotal,
          sessionsPlayed: 1,
        })
      }
    }
  }

  return Array.from(statsMap.values())
    .sort((a, b) => b.netCents - a.netCents)
    .map((entry) => ({
      ...entry,
      roi:
        entry.totalBuyInCents > 0
          ? Math.round((entry.netCents / entry.totalBuyInCents) * 10000) / 100
          : 0,
    }))
}
