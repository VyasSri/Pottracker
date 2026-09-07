import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const RecordResultsSchema = z.object({
  totalBuyInCents: z.number().int().positive(),
  cashOutCents: z.number().int().min(0),
  leftEarly: z.boolean().default(false),
  // Player-funded buy-in: another session player covered part/all of this buy-in.
  // null (or omitted) = self / bank funded. When set, this player owes the funder.
  fundedByPlayerId: z.string().nullable().optional(),
  fundedAmountCents: z.number().int().positive().nullable().optional(),
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
  const parsed = RecordResultsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { totalBuyInCents, cashOutCents, leftEarly } = parsed.data

  // Resolve player-funded buy-in, validating the funder and amount.
  let fundedByPlayerId: string | null = null
  let fundedAmountCents: number | null = null
  if (parsed.data.fundedByPlayerId) {
    if (parsed.data.fundedByPlayerId === params.playerId)
      return NextResponse.json({ error: 'A player cannot fund their own buy-in' }, { status: 422 })

    const funder = await prisma.sessionPlayer.findFirst({
      where: { id: parsed.data.fundedByPlayerId, sessionId: params.id },
      select: { id: true },
    })
    if (!funder)
      return NextResponse.json({ error: 'Funding player is not in this session' }, { status: 422 })

    // Default the covered amount to the full buy-in; must not exceed it.
    const amt = parsed.data.fundedAmountCents ?? totalBuyInCents
    if (amt <= 0 || amt > totalBuyInCents)
      return NextResponse.json(
        { error: 'Funded amount must be between $0.01 and the total buy-in' },
        { status: 422 }
      )

    fundedByPlayerId = funder.id
    fundedAmountCents = amt
  }

  // Sequential writes — interactive transactions are not supported with PgBouncer transaction mode
  await prisma.buyIn.deleteMany({ where: { sessionPlayerId: params.playerId } })
  await prisma.buyIn.create({ data: { sessionPlayerId: params.playerId, amountCents: totalBuyInCents } })

  const updated = await prisma.sessionPlayer.update({
    where: { id: params.playerId },
    data: { cashOutCents, leftEarly, fundedByPlayerId, fundedAmountCents },
    include: {
      user: { select: { id: true, displayName: true, zelleHandle: true } },
      buyIns: true,
    },
  })

  return NextResponse.json({ player: updated })
}
