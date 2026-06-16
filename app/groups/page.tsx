import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import CreateGroupModal from './CreateGroupModal'
import JoinGroupForm from './JoinGroupForm'

export default async function GroupsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: { _count: { select: { members: true, sessions: true } } },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return (
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-felt-50">Groups</h1>
            <p className="text-felt-400 mt-1 text-sm">Your poker groups</p>
          </div>
          <CreateGroupModal />
        </div>

        {memberships.length === 0 ? (
          <div className="bg-felt-800 rounded-2xl p-12 text-center border border-felt-600 mb-6 shadow-card">
            <div className="text-5xl mb-4 opacity-30 font-display">♠</div>
            <p className="text-felt-100 font-semibold text-lg mb-1">No groups yet</p>
            <p className="text-felt-400 text-sm">
              Create a group to get started, or join one below with an invite code.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {memberships.map((m) => (
              <Link
                key={m.group.id}
                href={`/groups/${m.group.id}`}
                className="flex items-center justify-between bg-felt-800 rounded-xl px-5 py-4 border border-felt-600 hover:border-gold-400/40 hover:shadow-card-hover transition-all group"
              >
                <div>
                  <h2 className="text-felt-100 font-semibold group-hover:text-gold-400 transition-colors">
                    {m.group.name}
                  </h2>
                  <p className="text-felt-400 text-sm mt-0.5">
                    {m.group._count.members} member{m.group._count.members !== 1 ? 's' : ''} ·{' '}
                    {m.group._count.sessions} session{m.group._count.sessions !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {m.role === 'HOST_CAPABLE' && (
                    <span className="text-xs font-semibold bg-gold-400/10 text-gold-400 border border-gold-400/20 rounded-full px-2.5 py-1">
                      Host
                    </span>
                  )}
                  <svg
                    className="w-4 h-4 text-felt-500 group-hover:text-gold-400 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="bg-felt-800 rounded-2xl p-6 border border-felt-600 shadow-card">
          <h2 className="text-felt-100 font-semibold mb-1">Join a group</h2>
          <p className="text-felt-400 text-sm mb-4">Enter an invite code shared by the group host.</p>
          <JoinGroupForm />
        </div>
      </div>
    </main>
  )
}
