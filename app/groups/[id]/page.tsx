import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeLeaderboard } from '@/lib/leaderboard'
import GroupDetail from './GroupDetail'

export default async function GroupPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = params

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: id } },
  })
  if (!membership) notFound()

  const [group, members, sessions, settledSessions] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    }),
    prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, zelleHandle: true } },
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

  if (!group) notFound()

  const leaderboards = {
    'all-time': computeLeaderboard(settledSessions, 'all-time'),
    year: computeLeaderboard(settledSessions, 'year'),
    month: computeLeaderboard(settledSessions, 'month'),
  }

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-felt-400 text-sm mb-6">
          <Link href="/groups" className="hover:text-felt-100 transition-colors">Groups</Link>
          <span>/</span>
          <span className="text-felt-100">{group.name}</span>
        </div>

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-felt-50">{group.name}</h1>
            <p className="text-felt-400 text-sm mt-1">
              {members.length} member{members.length !== 1 ? 's' : ''} ·{' '}
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href={`/sessions/new?groupId=${id}`}
            className="flex-shrink-0 bg-gold-400 hover:bg-gold-300 text-felt-900 font-bold px-4 py-2 rounded-lg text-sm transition-all"
          >
            + New Session
          </Link>
        </div>

        <GroupDetail
          group={{ ...group, isCreator: group.createdById === session.user.id }}
          members={members}
          sessions={sessions}
          leaderboards={leaderboards}
          currentUserRole={membership.role}
          currentUserId={session.user.id}
        />
      </div>
    </main>
  )
}
