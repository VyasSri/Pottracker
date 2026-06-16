import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const group = await prisma.group.findUnique({ where: { id: params.id } })
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (group.createdById !== session.user.id)
    return NextResponse.json({ error: 'Only the group creator can remove members.' }, { status: 403 })

  if (params.userId === session.user.id)
    return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 422 })

  if (params.userId === group.createdById)
    return NextResponse.json({ error: 'Cannot remove the group creator.' }, { status: 422 })

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: params.userId, groupId: params.id } },
  })
  if (!membership) return NextResponse.json({ error: 'Member not found.' }, { status: 404 })

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: params.userId, groupId: params.id } },
  })

  return NextResponse.json({ ok: true })
}
