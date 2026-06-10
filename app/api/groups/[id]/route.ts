import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeLeaderboard, type LeaderboardRange } from '@/lib/leaderboard'

const VALID_RANGES: LeaderboardRange[] = ['all-time', 'year', 'month']

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: id } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rawRange = req.nextUrl.searchParams.get('range') ?? 'all-time'
  const range: LeaderboardRange = VALID_RANGES.includes(rawRange as LeaderboardRange)
    ? (rawRange as LeaderboardRange)
    : 'all-time'

  const [group, members, sessions, settledSessions] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    }),
    prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true, zelleHandle: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.session.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        host: { select: { id: true, displayName: true } },
        _count: { select: { players: true } },
      },
    }),
    prisma.session.findMany({
      where: { groupId: id, status: 'SETTLED' },
      include: {
        players: {
          include: {
            user: { select: { id: true, displayName: true } },
            buyIns: true,
          },
        },
      },
    }),
  ])

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leaderboard = computeLeaderboard(settledSessions, range)

  return NextResponse.json({
    group: { ...group, isCreator: group.createdById === session.user.id },
    members,
    sessions,
    leaderboard,
    currentUserRole: membership.role,
  })
}
