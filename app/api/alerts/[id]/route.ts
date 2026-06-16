import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alert = await prisma.alert.findUnique({ where: { id: params.id } })
  if (!alert || alert.userId !== session.user.id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!alert.readAt) {
    await prisma.alert.update({
      where: { id: params.id },
      data: { readAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}
