import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { settle } from '@/lib/settle'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      players: {
        include: {
          buyIns: true,
          user: { select: { id: true, displayName: true } },
        },
      },
    },
  })

  if (!dbSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dbSession.hostId !== session.user.id)
    return NextResponse.json({ error: 'Only the host can end a session' }, { status: 403 })
  if (dbSession.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Session is not ACTIVE' }, { status: 422 })

  // Chip conservation check
  let totalBuyIns = 0
  let totalCashOuts = 0

  for (const player of dbSession.players) {
    if (player.cashOutCents === null) {
      return NextResponse.json(
        {
          error: 'All players must have a cash-out recorded before ending',
          playerId: player.id,
          playerName: player.user?.displayName ?? player.guestName,
        },
        { status: 422 }
      )
    }
    totalBuyIns += player.buyIns.reduce((sum, b) => sum + b.amountCents, 0)
    totalCashOuts += player.cashOutCents
  }

  if (totalBuyIns !== totalCashOuts) {
    return NextResponse.json(
      {
        error: 'Chip conservation failed',
        discrepancyCents: totalCashOuts - totalBuyIns,
        totalBuyInCents: totalBuyIns,
        totalCashOutCents: totalCashOuts,
      },
      { status: 422 }
    )
  }

  // Build net positions keyed by SessionPlayer ID
  const playerNets = dbSession.players.map((p) => ({
    id: p.id,
    userId: p.userId,
    netCents: (p.cashOutCents ?? 0) - p.buyIns.reduce((sum, b) => sum + b.amountCents, 0),
  }))

  // Fold in carried balances if CARRY_FORWARD mode
  let priorCarried: { debtorId: string; creditorId: string; amountCents: number }[] = []
  if (dbSession.roundingMode === 'CARRY_FORWARD') {
    const carried = await prisma.carriedBalance.findMany({
      where: { groupId: dbSession.groupId },
    })
    const userToPlayer = new Map(
      playerNets.filter((p) => p.userId).map((p) => [p.userId!, p.id])
    )
    priorCarried = carried
      .filter((cb) => userToPlayer.has(cb.debtorUserId) && userToPlayer.has(cb.creditorUserId))
      .map((cb) => ({
        debtorId: userToPlayer.get(cb.debtorUserId)!,
        creditorId: userToPlayer.get(cb.creditorUserId)!,
        amountCents: cb.amountCents,
      }))
  }

  const plan = settle(
    playerNets.map((p) => ({ id: p.id, netCents: p.netCents })),
    {
      roundingMode: dbSession.roundingMode as 'BOUNCE' | 'CARRY_FORWARD',
      priorCarriedBalances: priorCarried.length > 0 ? priorCarried : undefined,
    }
  )

  // Build SESSION_ENDED alerts for all registered players
  const alertData = playerNets
    .filter((p) => p.userId)
    .map((p) => {
      const sign = p.netCents >= 0 ? '+' : ''
      const formatted = `${sign}$${(Math.abs(p.netCents) / 100).toFixed(2)}`
      return {
        userId: p.userId!,
        type: 'SESSION_ENDED',
        title: 'Session ended',
        body: `Your net: ${formatted}`,
        link: `/sessions/${params.id}`,
      }
    })

  const playerToUser = new Map(playerNets.filter((p) => p.userId).map((p) => [p.id, p.userId!]))

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: params.id },
      data: { status: 'ENDED', endedAt: new Date() },
    })

    for (const txn of plan.transactions) {
      await tx.settlementTransaction.create({
        data: {
          sessionId: params.id,
          fromPlayerId: txn.fromId,
          toPlayerId: txn.toId,
          amountCents: txn.amountCents,
          kind: txn.kind,
          bounceGroupId: txn.bounceGroupId ?? null,
        },
      })
    }

    if (dbSession.roundingMode === 'CARRY_FORWARD') {
      const userIds = playerNets.filter((p) => p.userId).map((p) => p.userId!)
      await tx.carriedBalance.deleteMany({
        where: {
          groupId: dbSession.groupId,
          debtorUserId: { in: userIds },
          creditorUserId: { in: userIds },
        },
      })
      for (const cb of plan.newCarriedBalances) {
        const debtorUserId = playerToUser.get(cb.debtorId)
        const creditorUserId = playerToUser.get(cb.creditorId)
        if (debtorUserId && creditorUserId) {
          await tx.carriedBalance.create({
            data: {
              groupId: dbSession.groupId,
              debtorUserId,
              creditorUserId,
              amountCents: cb.amountCents,
            },
          })
        }
      }
    }

    if (alertData.length > 0) {
      await tx.alert.createMany({ data: alertData })
    }
  })

  return NextResponse.json({ ok: true })
}
