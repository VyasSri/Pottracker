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
        include: {
          _count: { select: { members: true, sessions: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Groups</h1>
            <p className="text-gray-400 mt-1 text-sm">Your poker groups</p>
          </div>
          <CreateGroupModal />
        </div>

        {memberships.length === 0 ? (
          <div className="bg-[#1a1f2e] rounded-2xl p-12 text-center border border-gray-800 mb-6">
            <div className="text-4xl mb-4">♠️</div>
            <p className="text-white font-medium text-lg mb-1">No groups yet</p>
            <p className="text-gray-500 text-sm">
              Create a group to get started, or join one below with an invite code.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {memberships.map((m) => (
              <Link
                key={m.group.id}
                href={`/groups/${m.group.id}`}
                className="flex items-center justify-between bg-[#1a1f2e] rounded-xl px-5 py-4 border border-gray-800 hover:border-gray-600 transition-colors group"
              >
                <div>
                  <h2 className="text-white font-semibold group-hover:text-green-400 transition-colors">
                    {m.group.name}
                  </h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {m.group._count.members} member
                    {m.group._count.members !== 1 ? 's' : ''} ·{' '}
                    {m.group._count.sessions} session
                    {m.group._count.sessions !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {m.role === 'HOST_CAPABLE' && (
                    <span className="text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2.5 py-1">
                      Host
                    </span>
                  )}
                  <svg
                    className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="bg-[#1a1f2e] rounded-2xl p-6 border border-gray-800">
          <h2 className="text-white font-semibold mb-1">Join a group</h2>
          <p className="text-gray-500 text-sm mb-4">Enter an invite code shared by the group host.</p>
          <JoinGroupForm />
        </div>
      </div>
    </main>
  )
}
