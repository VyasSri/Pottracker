import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: { _count: { select: { players: true } } },
  })

  if (!dbSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dbSession.hostId !== session.user.id)
    return NextResponse.json({ error: 'Only the host can start the session' }, { status: 403 })
  if (dbSession.status !== 'DRAFT')
    return NextResponse.json({ error: 'Session is not in DRAFT status' }, { status: 422 })
  if (dbSession._count.players < 2)
    return NextResponse.json({ error: 'Need at least 2 players to start' }, { status: 422 })

  const updated = await prisma.session.update({
    where: { id: params.id },
    data: { status: 'ACTIVE', startedAt: new Date() },
  })

  return NextResponse.json({ session: updated })
}
