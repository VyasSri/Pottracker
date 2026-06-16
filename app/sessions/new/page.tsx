import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import NewSessionForm from './NewSessionForm'

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: { groupId?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.isGuest) redirect('/groups')

  const groupId = searchParams.groupId
  if (!groupId) notFound()

  const [membership, group, members] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    }),
    prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true } }),
    prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { joinedAt: 'asc' },
    }),
  ])

  if (!membership || !group) notFound()

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 text-felt-400 text-sm mb-6">
          <Link href="/groups" className="hover:text-felt-100 transition-colors">Groups</Link>
          <span>/</span>
          <Link href={`/groups/${groupId}`} className="hover:text-felt-100 transition-colors">
            {group.name}
          </Link>
          <span>/</span>
          <span className="text-felt-100">New Session</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-felt-50 mb-8">New Session</h1>

        <NewSessionForm
          groupId={groupId}
          members={members.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
          currentUserId={session.user.id}
        />
      </div>
    </main>
  )
}
