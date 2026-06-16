import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase()
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true, sessions: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return NextResponse.json(
    memberships.map((m) => ({
      ...m.group,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  )
}

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(50),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.isGuest) return NextResponse.json({ error: 'Guests cannot create groups.' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
  }

  let inviteCode: string
  let attempts = 0
  do {
    inviteCode = generateInviteCode()
    attempts++
    if (attempts > 10) throw new Error('Could not generate unique invite code')
  } while (await prisma.group.findUnique({ where: { inviteCode } }))

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      createdById: session.user.id,
      members: {
        create: {
          userId: session.user.id,
          role: 'HOST_CAPABLE',
        },
      },
    },
  })

  return NextResponse.json(group, { status: 201 })
}
