import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbSession = await prisma.session.findUnique({ where: { id: params.id } })
  if (!dbSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dbSession.hostId !== session.user.id)
    return NextResponse.json({ error: 'Only the host can delete a session' }, { status: 403 })
  if (dbSession.status === 'SETTLED')
    return NextResponse.json({ error: 'Cannot delete a settled session' }, { status: 422 })

  await prisma.$transaction(async (tx) => {
    const playerIds = (
      await tx.sessionPlayer.findMany({ where: { sessionId: params.id }, select: { id: true } })
    ).map((p) => p.id)

    await tx.settlementTransaction.deleteMany({ where: { sessionId: params.id } })
    if (playerIds.length > 0) {
      await tx.buyIn.deleteMany({ where: { sessionPlayerId: { in: playerIds } } })
      await tx.sessionPlayer.deleteMany({ where: { id: { in: playerIds } } })
    }
    await tx.session.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      group: { select: { id: true, name: true } },
      host: { select: { id: true, displayName: true } },
      players: {
        include: {
          user: { select: { id: true, displayName: true, zelleHandle: true } },
          buyIns: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      settlementTransactions: {
        include: {
          fromPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
          toPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!dbSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: dbSession.groupId } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: dbSession.groupId },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({
    session: dbSession,
    groupMembers: groupMembers.map((m) => ({ id: m.userId, displayName: m.user.displayName })),
    isHost: dbSession.hostId === session.user.id,
  })
}
