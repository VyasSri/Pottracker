import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (group.createdById !== session.user.id) {
    return NextResponse.json(
      { error: 'Only the group creator can regenerate the invite code' },
      { status: 403 }
    )
  }

  let inviteCode: string
  let attempts = 0
  do {
    inviteCode = generateInviteCode()
    attempts++
    if (attempts > 10) throw new Error('Could not generate unique invite code')
  } while (await prisma.group.findUnique({ where: { inviteCode } }))

  const updated = await prisma.group.update({
    where: { id: params.id },
    data: { inviteCode },
  })

  return NextResponse.json({ inviteCode: updated.inviteCode })
}
