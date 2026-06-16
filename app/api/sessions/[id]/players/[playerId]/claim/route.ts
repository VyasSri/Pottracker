import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  const authSession = await getSession()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = await prisma.sessionPlayer.findUnique({
    where: { id: params.playerId },
    include: {
      buyIns: true,
      session: {
        select: {
          id: true,
          groupId: true,
          status: true,
          settlementTransactions: {
            include: {
              fromPlayer: { select: { id: true, userId: true } },
              toPlayer:   { select: { id: true, userId: true } },
            },
          },
        },
      },
    },
  })

  if (!sp || sp.sessionId !== params.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (sp.userId !== null)
    return NextResponse.json({ error: 'This guest slot is already claimed.' }, { status: 409 })

  // Must be a member of the group
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: authSession.user.id, groupId: sp.session.groupId } },
  })
  if (!membership)
    return NextResponse.json({ error: 'You are not a member of this group.' }, { status: 403 })

  // Must not already be a player in this session
  const alreadyIn = await prisma.sessionPlayer.findFirst({
    where: { sessionId: params.id, userId: authSession.user.id },
  })
  if (alreadyIn)
    return NextResponse.json({ error: 'You already have a player record in this session.' }, { status: 409 })

  const buyIn  = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
  const net    = (sp.cashOutCents ?? 0) - buyIn
  const sign   = net >= 0 ? '+' : ''
  const fmtNet = `${sign}$${(Math.abs(net) / 100).toFixed(2)}`

  const alerts: { type: string; title: string; body: string; link: string }[] = []

  if (sp.session.status === 'ENDED' || sp.session.status === 'SETTLED') {
    alerts.push({
      type:  'SESSION_ENDED',
      title: 'Session result (claimed)',
      body:  `You were linked to a past session. Your net: ${fmtNet}`,
      link:  `/sessions/${params.id}`,
    })

    // Alert for any pending transactions they're involved in where the other side already confirmed
    for (const tx of sp.session.settlementTransactions) {
      const isPayer = tx.fromPlayer.id === sp.id
      const isPayee = tx.toPlayer.id === sp.id

      if (isPayer && tx.payeeConfirmed && !tx.payerConfirmed) {
        alerts.push({
          type:  'PAYMENT_CONFIRMED',
          title: 'Payment awaiting your confirmation',
          body:  `You owe $${(tx.amountCents / 100).toFixed(2)} — tap "I sent it" to confirm.`,
          link:  `/sessions/${params.id}`,
        })
      }
      if (isPayee && tx.payerConfirmed && !tx.payeeConfirmed) {
        alerts.push({
          type:  'PAYMENT_CONFIRMED',
          title: 'Payment sent to you',
          body:  `Someone marked a payment as sent. Tap "I received it" to confirm.`,
          link:  `/sessions/${params.id}`,
        })
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionPlayer.update({
      where: { id: params.playerId },
      data:  { userId: authSession.user.id },
    })

    if (alerts.length > 0) {
      await tx.alert.createMany({
        data: alerts.map((a) => ({ ...a, userId: authSession.user.id })),
      })
    }
  })

  return NextResponse.json({ ok: true })
}
