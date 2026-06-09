import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').optional(),
  zelleHandle: z.string().optional(),
  avatarUrl: z.string().url('Invalid URL').optional(),
  dashboardPublic: z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 422 }
    )
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      displayName: true,
      zelleHandle: true,
      avatarUrl: true,
      dashboardPublic: true,
    },
  })

  return NextResponse.json(updated)
}
