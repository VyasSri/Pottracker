import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCents } from '@/lib/utils'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [memberships, recentSessions] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: {
        group: {
          include: { _count: { select: { members: true, sessions: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: 5,
    }),
    prisma.sessionPlayer.findMany({
      where: { userId: session.user.id },
      include: {
        session: {
          include: { group: { select: { id: true, name: true } } },
        },
        buyIns: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  // Compute quick stats from settled sessions
  const settledPlays = recentSessions.filter((sp) => sp.session.status === 'SETTLED')
  const allTimePlays = await prisma.sessionPlayer.findMany({
    where: { userId: session.user.id, session: { status: 'SETTLED' } },
    include: { buyIns: true },
  })

  const allTimeNet = allTimePlays.reduce((sum, sp) => {
    const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    return sum + (sp.cashOutCents ?? 0) - buyIn
  }, 0)

  const allTimeBuyIn = allTimePlays.reduce((sum, sp) => {
    return sum + sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
  }, 0)

  const roi =
    allTimeBuyIn > 0 ? Math.round((allTimeNet / allTimeBuyIn) * 10000) / 100 : null

  const hasProfile = !!session.user.zelleHandle

  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1">
          Welcome back, {session.user.name ?? 'Player'}
        </h1>
        <p className="text-gray-400 text-sm mb-8">Here's your poker overview.</p>

        {/* Setup nudge */}
        {!hasProfile && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-yellow-400 text-sm">
              Add your Zelle handle to your profile so group members can pay you.
            </p>
            <Link
              href="/profile"
              className="text-yellow-400 hover:text-yellow-300 text-sm font-medium whitespace-nowrap transition-colors"
            >
              Set up →
            </Link>
          </div>
        )}

        {/* Stats strip */}
        {allTimePlays.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
                All-time net
              </p>
              <p
                className={`text-xl font-bold ${
                  allTimeNet > 0
                    ? 'text-green-400'
                    : allTimeNet < 0
                    ? 'text-red-400'
                    : 'text-white'
                }`}
              >
                {allTimeNet > 0 ? '+' : ''}
                {formatCents(allTimeNet)}
              </p>
            </div>
            <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
                ROI
              </p>
              <p
                className={`text-xl font-bold ${
                  roi !== null && roi > 0
                    ? 'text-green-400'
                    : roi !== null && roi < 0
                    ? 'text-red-400'
                    : 'text-white'
                }`}
              >
                {roi !== null ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="bg-[#1a1f2e] rounded-xl p-4 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-1">
                Sessions
              </p>
              <p className="text-xl font-bold text-white">{allTimePlays.length}</p>
            </div>
          </div>
        )}

        {/* Groups section */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Your groups</h2>
          <Link href="/groups" className="text-green-400 hover:text-green-300 text-sm transition-colors">
            View all →
          </Link>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-[#1a1f2e] rounded-xl p-8 text-center border border-gray-800 mb-6">
            <p className="text-gray-400 text-sm mb-3">No groups yet.</p>
            <Link
              href="/groups"
              className="inline-block rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 text-sm transition-colors"
            >
              Create or join a group
            </Link>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {memberships.map((m) => (
              <Link
                key={m.group.id}
                href={`/groups/${m.group.id}`}
                className="flex items-center justify-between bg-[#1a1f2e] rounded-xl px-4 py-3.5 border border-gray-800 hover:border-gray-600 transition-colors group"
              >
                <div>
                  <p className="text-white text-sm font-medium group-hover:text-green-400 transition-colors">
                    {m.group.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {m.group._count.members} members · {m.group._count.sessions} sessions
                  </p>
                </div>
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Recent sessions */}
        {settledPlays.length > 0 && (
          <>
            <h2 className="text-white font-semibold mb-3">Recent sessions</h2>
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
              {settledPlays.map((sp, i) => {
                const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
                const net = (sp.cashOutCents ?? 0) - buyIn
                return (
                  <div
                    key={sp.id}
                    className={`flex items-center justify-between px-5 py-4 ${
                      i < settledPlays.length - 1 ? 'border-b border-gray-800' : ''
                    }`}
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{sp.session.group.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Buy-in: {formatCents(buyIn)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}
                    >
                      {net > 0 ? '+' : ''}
                      {formatCents(net)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
