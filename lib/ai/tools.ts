import { prisma } from '@/lib/prisma'
import type Groq from 'groq-sdk'

export const toolDefinitions: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_my_stats',
      description:
        "Get the user's all-time poker statistics: net P&L in dollars, ROI percentage, total sessions played, and longest winning streak.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_session_history',
      description:
        "Get recent settled poker sessions for the user with net result, buy-in amount, group name, and date. Use this to answer questions about specific sessions, trends over time, or performance on particular nights.",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max sessions to return (default 20, max 50)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_group_breakdown',
      description:
        "Get the user's net P&L, ROI, and sessions played broken down per group. Use this for questions like 'which group am I most profitable in' or 'how do I perform across groups'.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_outstanding_balances',
      description:
        'Get pending (unconfirmed) settlement transactions — amounts the user currently owes to others or is owed by others.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
]

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  switch (name) {
    case 'get_my_stats': {
      const plays = await prisma.sessionPlayer.findMany({
        where: { userId, session: { status: 'SETTLED' } },
        include: {
          buyIns: true,
          session: { select: { endedAt: true } },
        },
        orderBy: { session: { endedAt: 'asc' } },
      })

      const totalBuyIn = plays.reduce(
        (s, sp) => s + sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0),
        0
      )
      const totalNet = plays.reduce((s, sp) => {
        const bi = sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0)
        return s + (sp.cashOutCents ?? 0) - bi
      }, 0)
      const roi = totalBuyIn > 0 ? Math.round((totalNet / totalBuyIn) * 10000) / 100 : null

      let maxStreak = 0
      let cur = 0
      for (const sp of plays) {
        const bi = sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0)
        const net = (sp.cashOutCents ?? 0) - bi
        if (net > 0) {
          cur++
          if (cur > maxStreak) maxStreak = cur
        } else {
          cur = 0
        }
      }

      return {
        totalSessions: plays.length,
        allTimeNetDollars: totalNet / 100,
        allTimeBuyInDollars: totalBuyIn / 100,
        roiPercent: roi,
        longestWinStreak: maxStreak,
      }
    }

    case 'get_session_history': {
      const limit = Math.min(Number(args.limit ?? 20), 50)
      const plays = await prisma.sessionPlayer.findMany({
        where: { userId, session: { status: 'SETTLED' } },
        include: {
          buyIns: true,
          session: {
            include: { group: { select: { name: true } } },
          },
        },
        orderBy: { session: { endedAt: 'desc' } },
        take: limit,
      })

      return plays.map((sp) => {
        const bi = sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0)
        const net = (sp.cashOutCents ?? 0) - bi
        return {
          group: sp.session.group.name,
          date: sp.session.endedAt?.toISOString().split('T')[0] ?? null,
          buyInDollars: bi / 100,
          netDollars: net / 100,
          result: net > 0 ? 'win' : net < 0 ? 'loss' : 'breakeven',
        }
      })
    }

    case 'get_group_breakdown': {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        include: { group: { select: { id: true, name: true } } },
      })

      const rows = await Promise.all(
        memberships.map(async (m) => {
          const plays = await prisma.sessionPlayer.findMany({
            where: { userId, session: { groupId: m.group.id, status: 'SETTLED' } },
            include: { buyIns: true },
          })
          const bi = plays.reduce(
            (s, sp) => s + sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0),
            0
          )
          const net = plays.reduce((s, sp) => {
            const b = sp.buyIns.reduce((b, bi) => b + bi.amountCents, 0)
            return s + (sp.cashOutCents ?? 0) - b
          }, 0)
          return {
            group: m.group.name,
            sessions: plays.length,
            netDollars: net / 100,
            roiPercent: bi > 0 ? Math.round((net / bi) * 10000) / 100 : null,
          }
        })
      )

      return rows
    }

    case 'get_outstanding_balances': {
      const myPlayers = await prisma.sessionPlayer.findMany({
        where: { userId },
        select: { id: true },
      })
      const myPlayerIds = myPlayers.map((p) => p.id)

      if (myPlayerIds.length === 0) return { iOwe: [], owedToMe: [] }

      const pending = await prisma.settlementTransaction.findMany({
        where: {
          OR: [
            { fromPlayerId: { in: myPlayerIds } },
            { toPlayerId: { in: myPlayerIds } },
          ],
          payerConfirmed: false,
          payeeConfirmed: false,
        },
        include: {
          fromPlayer: {
            include: { user: { select: { displayName: true } } },
          },
          toPlayer: {
            include: { user: { select: { displayName: true } } },
          },
          session: { select: { group: { select: { name: true } } } },
        },
      })

      const iOwe = pending
        .filter((tx) => myPlayerIds.includes(tx.fromPlayerId))
        .map((tx) => ({
          to: tx.toPlayer.user?.displayName ?? tx.toPlayer.guestName ?? 'Unknown',
          amountDollars: tx.amountCents / 100,
          group: tx.session.group.name,
          kind: tx.kind,
        }))

      const owedToMe = pending
        .filter((tx) => myPlayerIds.includes(tx.toPlayerId))
        .map((tx) => ({
          from: tx.fromPlayer.user?.displayName ?? tx.fromPlayer.guestName ?? 'Unknown',
          amountDollars: tx.amountCents / 100,
          group: tx.session.group.name,
          kind: tx.kind,
        }))

      return { iOwe, owedToMe }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
