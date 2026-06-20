import { prisma } from '../lib/prisma'

// ── Helpers ──────────────────────────────────────────────────────────────────

function playerNetCents(player: {
  cashOutCents: number | null
  buyIns: { amountCents: number }[]
}): number {
  const buyInTotal = player.buyIns.reduce((s, b) => s + b.amountCents, 0)
  return (player.cashOutCents ?? 0) - buyInTotal
}

function longestPositiveStreak(nets: number[]): number {
  let max = 0, cur = 0
  for (const n of nets) {
    n > 0 ? (cur++, max = Math.max(max, cur)) : (cur = 0)
  }
  return max
}

// ── Tool schemas (for MCP ListTools response) ────────────────────────────────

export const MCP_TOOLS = [
  {
    name: 'get_current_user',
    description:
      'Returns the profile and ID of the configured user. Call this first to get the userId needed by other tools.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_groups',
    description: 'Lists all poker groups the user belongs to, including group ID and name.',
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string', description: 'User ID from get_current_user' } },
      required: ['userId'],
    },
  },
  {
    name: 'get_my_stats',
    description:
      'Returns aggregate stats for a user: net P/L (cents + dollars), ROI %, sessions played, and longest win streak.',
    inputSchema: {
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: ['userId'],
    },
  },
  {
    name: 'get_session_history',
    description:
      'Returns paginated session history for a user with per-session net P/L. Optionally filter by group.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        groupId: { type: 'string', description: 'Filter to one group (optional)' },
        limit: { type: 'number', description: 'Max results (1–50, default 20)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_group_leaderboard',
    description:
      'Returns members of a group ranked by net P/L. Optionally filter to sessions ending after a date (ISO 8601).',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        since: { type: 'string', description: 'ISO 8601 date — only include sessions ending after this date (optional)' },
      },
      required: ['groupId'],
    },
  },
  {
    name: 'get_settlement',
    description:
      'Returns the full settlement plan for a session: who owes whom, amounts, confirmation status, and bounce pairs.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
] as const

export type ToolName = (typeof MCP_TOOLS)[number]['name']

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_current_user': {
      const userId = process.env.POKER_MCP_USER_ID
      if (!userId) throw new Error('POKER_MCP_USER_ID env var is not set')
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, displayName: true, email: true, zelleHandle: true, createdAt: true },
      })
      return user
    }

    case 'list_groups': {
      const userId = String(args.userId)
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        include: { group: { select: { id: true, name: true, createdAt: true } } },
        orderBy: { joinedAt: 'asc' },
      })
      return memberships.map((m) => ({ id: m.group.id, name: m.group.name, role: m.role, joinedAt: m.joinedAt }))
    }

    case 'get_my_stats': {
      const userId = String(args.userId)
      const players = await prisma.sessionPlayer.findMany({
        where: { userId, session: { status: { in: ['ENDED', 'SETTLED'] } } },
        include: { buyIns: true },
        orderBy: { session: { endedAt: 'asc' } },
      })
      const nets = players.map(playerNetCents)
      const totalBuyInCents = players.flatMap((p) => p.buyIns).reduce((s, b) => s + b.amountCents, 0)
      const totalNetCents = nets.reduce((s, n) => s + n, 0)
      return {
        sessionsPlayed: players.length,
        totalNetCents,
        totalNetDollars: (totalNetCents / 100).toFixed(2),
        totalBuyInCents,
        roiPercent: totalBuyInCents > 0 ? ((totalNetCents / totalBuyInCents) * 100).toFixed(1) : '0.0',
        longestWinStreak: longestPositiveStreak(nets),
      }
    }

    case 'get_session_history': {
      const userId = String(args.userId)
      const groupId = args.groupId ? String(args.groupId) : undefined
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)))
      const offset = Math.max(0, Number(args.offset ?? 0))
      const players = await prisma.sessionPlayer.findMany({
        where: {
          userId,
          session: {
            status: { in: ['ENDED', 'SETTLED'] },
            ...(groupId ? { groupId } : {}),
          },
        },
        include: {
          buyIns: true,
          session: { include: { group: { select: { id: true, name: true } } } },
        },
        orderBy: { session: { endedAt: 'desc' } },
        skip: offset,
        take: limit,
      })
      return players.map((p) => {
        const net = playerNetCents(p)
        return {
          sessionId: p.sessionId,
          groupId: p.session.groupId,
          groupName: p.session.group.name,
          status: p.session.status,
          endedAt: p.session.endedAt,
          netCents: net,
          netDollars: (net / 100).toFixed(2),
          totalBuyInCents: p.buyIns.reduce((s, b) => s + b.amountCents, 0),
        }
      })
    }

    case 'get_group_leaderboard': {
      const groupId = String(args.groupId)
      const since = args.since ? new Date(String(args.since)) : undefined
      const members = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              sessionPlayers: {
                where: {
                  session: {
                    groupId,
                    status: { in: ['ENDED', 'SETTLED'] },
                    ...(since ? { endedAt: { gte: since } } : {}),
                  },
                },
                include: { buyIns: true },
              },
            },
          },
        },
      })
      const ranked = members
        .map((m) => {
          const nets = m.user.sessionPlayers.map(playerNetCents)
          const totalNetCents = nets.reduce((s, n) => s + n, 0)
          const totalBuyInCents = m.user.sessionPlayers
            .flatMap((p) => p.buyIns)
            .reduce((s, b) => s + b.amountCents, 0)
          return {
            userId: m.userId,
            displayName: m.user.displayName,
            role: m.role,
            sessionsPlayed: nets.length,
            totalNetCents,
            totalNetDollars: (totalNetCents / 100).toFixed(2),
            roiPercent:
              totalBuyInCents > 0 ? ((totalNetCents / totalBuyInCents) * 100).toFixed(1) : '0.0',
          }
        })
        .sort((a, b) => b.totalNetCents - a.totalNetCents)
      return ranked.map((r, i) => ({ rank: i + 1, ...r }))
    }

    case 'get_settlement': {
      const sessionId = String(args.sessionId)
      const [session, transactions] = await Promise.all([
        prisma.session.findUniqueOrThrow({
          where: { id: sessionId },
          select: { status: true, endedAt: true, group: { select: { name: true } } },
        }),
        prisma.settlementTransaction.findMany({
          where: { sessionId },
          include: {
            fromPlayer: { select: { guestName: true, user: { select: { displayName: true } } } },
            toPlayer: { select: { guestName: true, user: { select: { displayName: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ])
      const name = (p: { guestName: string | null; user: { displayName: string } | null }) =>
        p.user?.displayName ?? p.guestName ?? 'Guest'
      return {
        sessionId,
        groupName: session.group.name,
        sessionStatus: session.status,
        endedAt: session.endedAt,
        transactions: transactions.map((t) => ({
          id: t.id,
          from: name(t.fromPlayer),
          to: name(t.toPlayer),
          amountCents: t.amountCents,
          amountDollars: (t.amountCents / 100).toFixed(2),
          kind: t.kind,
          bounceGroupId: t.bounceGroupId ?? undefined,
          payerConfirmed: t.payerConfirmed,
          payeeConfirmed: t.payeeConfirmed,
          fullyConfirmed: t.payerConfirmed && t.payeeConfirmed,
        })),
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
