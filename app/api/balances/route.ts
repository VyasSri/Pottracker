import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Find all SessionPlayer records for this user
  const myPlayers = await prisma.sessionPlayer.findMany({
    where: { userId },
    select: { id: true },
  })
  const myPlayerIds = myPlayers.map((p) => p.id)

  if (myPlayerIds.length === 0) return NextResponse.json({ balances: [] })

  const txs = await prisma.settlementTransaction.findMany({
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

  return NextResponse.json({ balances: txs })
}
