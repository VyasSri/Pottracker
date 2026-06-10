import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const joinSchema = z.object({
  inviteCode: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = joinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 422 })
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: parsed.data.inviteCode.trim().toUpperCase() },
  })

  if (!group) {
    return NextResponse.json({ error: 'Invalid invite code — no group found' }, { status: 404 })
  }

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
  })

  if (existing) {
    return NextResponse.json({ error: 'You are already a member of this group' }, { status: 409 })
  }

  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      role: 'MEMBER',
    },
  })

  return NextResponse.json(group)
}
