import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)
  if (groupIds.length === 0) return NextResponse.json({ guests: [] })

  const guests = await prisma.sessionPlayer.findMany({
    where: {
      userId: null,
      session: {
        groupId: { in: groupIds },
        status: { in: ['ENDED', 'SETTLED'] },
      },
    },
    include: {
      buyIns: true,
      session: {
        select: {
          id: true,
          status: true,
          endedAt: true,
          group: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { session: { endedAt: 'desc' } },
  })

  const result = guests.map((sp) => {
    const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    const net   = (sp.cashOutCents ?? 0) - buyIn
    return {
      sessionPlayerId: sp.id,
      sessionId:       sp.session.id,
      sessionStatus:   sp.session.status,
      endedAt:         sp.session.endedAt,
      groupId:         sp.session.group.id,
      groupName:       sp.session.group.name,
      guestName:       sp.guestName,
      netCents:        net,
      buyInCents:      buyIn,
    }
  })

  return NextResponse.json({ guests: result })
}
