import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const AddPlayerSchema = z
  .object({
    userId: z.string().optional(),
    guestName: z.string().min(1).max(50).optional(),
  })
  .refine((d) => d.userId || d.guestName, {
    message: 'Either userId or guestName is required',
  })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: { players: { select: { userId: true } } },
  })

  if (!dbSession) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dbSession.hostId !== session.user.id)
    return NextResponse.json({ error: 'Only the host can add players' }, { status: 403 })
  if (!['DRAFT', 'ACTIVE'].includes(dbSession.status))
    return NextResponse.json({ error: 'Cannot add players to this session' }, { status: 422 })

  const body = await req.json()
  const parsed = AddPlayerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { userId, guestName } = parsed.data

  if (userId) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: dbSession.groupId } },
    })
    if (!membership)
      return NextResponse.json({ error: 'User is not a group member' }, { status: 422 })

    if (dbSession.players.some((p) => p.userId === userId))
      return NextResponse.json({ error: 'Player already in session' }, { status: 409 })
  }

  const player = await prisma.sessionPlayer.create({
    data: {
      sessionId: params.id,
      userId: userId ?? null,
      guestName: guestName ?? null,
    },
    include: {
      user: { select: { id: true, displayName: true, zelleHandle: true } },
      buyIns: true,
    },
  })

  return NextResponse.json({ player }, { status: 201 })
}
