import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

const fullSchema = z.object({
  mode:        z.literal('full'),
  email:       z.string().email('Invalid email address'),
  password:    z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  inviteCode:  z.string().optional(),
})

const guestSchema = z.object({
  mode:        z.literal('guest'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  zelleHandle: z.string().min(1, 'Zelle phone or email is required'),
  inviteCode:  z.string().min(1, 'Invite code is required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body as { mode?: string }

  // ── Guest mode (no email/password) ─────────────────────────────────────────
  if (raw?.mode === 'guest') {
    const parsed = guestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
    }
    const { displayName, zelleHandle, inviteCode } = parsed.data

    const group = await prisma.group.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
      select: { id: true, name: true },
    })
    if (!group) {
      return NextResponse.json({ error: 'Invalid invite code — no group found.' }, { status: 404 })
    }

    // Generate internal credentials the guest will never type
    const generatedEmail    = `guest-${randomUUID()}@pottracker.app`
    const generatedPassword = `${randomUUID()}${randomUUID()}`
    const hashed            = await bcrypt.hash(generatedPassword, 12)

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email: generatedEmail, password: hashed, displayName, zelleHandle, isGuest: true },
        select: { id: true },
      })
      await tx.groupMember.create({
        data: { userId: newUser.id, groupId: group.id, role: 'MEMBER' },
      })
    })

    // Return generated credentials so the client can immediately sign in
    return NextResponse.json(
      { guestEmail: generatedEmail, guestPassword: generatedPassword, joinedGroup: group },
      { status: 201 }
    )
  }

  // ── Full account mode ───────────────────────────────────────────────────────
  const parsed = fullSchema.safeParse({ mode: 'full', ...(body as object) })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
  }
  const { email, password, displayName, inviteCode } = parsed.data

  let group: { id: string; name: string } | null = null
  if (inviteCode) {
    group = await prisma.group.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
      select: { id: true, name: true },
    })
    if (!group) {
      return NextResponse.json({ error: 'Invalid invite code — no group found.' }, { status: 404 })
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: { email, password: hashed, displayName },
      select: { id: true, email: true, displayName: true },
    })
    if (group) {
      await tx.groupMember.create({
        data: { userId: newUser.id, groupId: group.id, role: 'MEMBER' },
      })
    }
    return newUser
  })

  return NextResponse.json({ ...user, joinedGroup: group ?? null }, { status: 201 })
}
