import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SessionView from './SessionView'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const dbSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      group: { select: { id: true, name: true } },
      host: { select: { id: true, displayName: true } },
      players: {
        include: {
          user: { select: { id: true, displayName: true, zelleHandle: true } },
          buyIns: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      settlementTransactions: {
        include: {
          fromPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
          toPlayer: {
            include: { user: { select: { id: true, displayName: true, zelleHandle: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!dbSession) notFound()

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: dbSession.groupId } },
  })
  if (!membership) notFound()

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: dbSession.groupId },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <SessionView
      session={dbSession}
      groupMembers={groupMembers.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
      isHost={dbSession.hostId === session.user.id}
      currentUserId={session.user.id}
    />
  )
}
