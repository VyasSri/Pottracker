import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const BuyInSchema = z.object({
  amountCents: z.number().int().positive(),
})

export async function POST(
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
  if (player.leftEarly)
    return NextResponse.json({ error: 'Player has already left the session' }, { status: 422 })
  if (player.cashOutCents !== null)
    return NextResponse.json({ error: 'Player has already cashed out' }, { status: 422 })

  const body = await req.json()
  const parsed = BuyInSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const buyIn = await prisma.buyIn.create({
    data: { sessionPlayerId: params.playerId, amountCents: parsed.data.amountCents },
  })

  return NextResponse.json({ buyIn }, { status: 201 })
}
