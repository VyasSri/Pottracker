import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CashOutSchema = z.object({
  cashOutCents: z.number().int().min(0),
  leftEarly: z.boolean().default(false),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [dbSession, player] = await Promise.all([
    prisma.session.findUnique({ where: { id: params.id } }),
    prisma.sessionPlayer.findUnique({ where: { id: params.playerId } }),
  ])

  if (!dbSession || !player) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dbSession.hostId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (dbSession.status !== 'ACTIVE')
    return NextResponse.json({ error: 'Session is not ACTIVE' }, { status: 422 })

  const body = await req.json()
  const parsed = CashOutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updated = await prisma.sessionPlayer.update({
    where: { id: params.playerId },
    data: {
      cashOutCents: parsed.data.cashOutCents,
      leftEarly: parsed.data.leftEarly,
    },
    include: {
      user: { select: { id: true, displayName: true, zelleHandle: true } },
      buyIns: true,
    },
  })

  return NextResponse.json({ player: updated })
}
