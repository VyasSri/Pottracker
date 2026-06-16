import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateSessionSchema = z.object({
  groupId: z.string(),
  defaultBuyInCents: z.number().int().positive(),
  roundingMode: z.enum(['BOUNCE', 'CARRY_FORWARD']).default('BOUNCE'),
  playerUserIds: z.array(z.string()).default([]),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.isGuest) return NextResponse.json({ error: 'Guests cannot create sessions.' }, { status: 403 })

  const body = await req.json()
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { groupId, defaultBuyInCents, roundingMode, playerUserIds } = parsed.data

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (playerUserIds.length > 0) {
    const memberships = await prisma.groupMember.findMany({
      where: { groupId, userId: { in: playerUserIds } },
    })
    if (memberships.length !== playerUserIds.length) {
      return NextResponse.json({ error: 'Some players are not group members' }, { status: 422 })
    }
  }

  const newSession = await prisma.session.create({
    data: {
      groupId,
      hostId: session.user.id,
      defaultBuyInCents,
      roundingMode,
      status: 'DRAFT',
      players: {
        create: playerUserIds.map((uid) => ({ userId: uid })),
      },
    },
  })

  return NextResponse.json({ session: newSession }, { status: 201 })
}
