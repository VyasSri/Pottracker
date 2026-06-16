import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; txId: string } }
) {
  const authSession = await getSession()
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tx = await prisma.settlementTransaction.findUnique({
    where: { id: params.txId },
    include: {
      fromPlayer: { include: { user: { select: { id: true, displayName: true, zelleHandle: true } } } },
      toPlayer:   { include: { user: { select: { id: true, displayName: true, zelleHandle: true } } } },
      session:    { select: { id: true, groupId: true } },
    },
  })

  if (!tx || tx.sessionId !== params.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPayer = tx.fromPlayer.userId === authSession.user.id
  const isPayee = tx.toPlayer.userId === authSession.user.id

  if (!isPayer && !isPayee)
    return NextResponse.json({ error: 'Not a participant in this transaction' }, { status: 403 })

  if (isPayer && tx.payerConfirmed)
    return NextResponse.json({ error: 'Already confirmed' }, { status: 422 })
  if (isPayee && tx.payeeConfirmed)
    return NextResponse.json({ error: 'Already confirmed' }, { status: 422 })

  const updateData: { payerConfirmed?: boolean; payeeConfirmed?: boolean; confirmedAt?: Date } = {}

  if (isPayer) {
    updateData.payerConfirmed = true
    const willBeFullyConfirmed = tx.payeeConfirmed
    if (willBeFullyConfirmed) updateData.confirmedAt = new Date()
  } else {
    updateData.payeeConfirmed = true
    const willBeFullyConfirmed = tx.payerConfirmed
    if (willBeFullyConfirmed) updateData.confirmedAt = new Date()
  }

  await prisma.$transaction(async (db) => {
    const updated = await db.settlementTransaction.update({
      where: { id: params.txId },
      data: updateData,
    })

    // Alert payee when payer marks "I sent it"
    if (isPayer && tx.toPlayer.userId) {
      const payerName = tx.fromPlayer.user?.displayName ?? 'Someone'
      await db.alert.create({
        data: {
          userId: tx.toPlayer.userId,
          type: 'PAYMENT_CONFIRMED',
          title: 'Payment sent to you',
          body: `${payerName} marked a payment as sent. Please confirm receipt.`,
          link: `/sessions/${params.id}`,
        },
      })
    }

    // Check if all transactions in this session are fully confirmed → SETTLED
    const allTxs = await db.settlementTransaction.findMany({
      where: { sessionId: params.id },
      select: { payerConfirmed: true, payeeConfirmed: true, id: true },
    })

    const allConfirmed = allTxs.every(
      (t) => t.id === params.txId
        ? (updated.payerConfirmed && updated.payeeConfirmed)
        : (t.payerConfirmed && t.payeeConfirmed)
    )

    if (allConfirmed) {
      await db.session.update({
        where: { id: params.id },
        data: { status: 'SETTLED' },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
