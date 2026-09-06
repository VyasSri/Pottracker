import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCents } from '@/lib/utils'
import ClaimSessions from './ClaimSessions'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const groupIds = (await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  })).map((m) => m.groupId)

  const unclaimedGuests = groupIds.length > 0
    ? await prisma.sessionPlayer.findMany({
        where: {
          userId: null,
          session: { groupId: { in: groupIds }, status: { in: ['ENDED', 'SETTLED'] } },
        },
        include: {
          buyIns: true,
          session: { select: { id: true, status: true, endedAt: true, group: { select: { id: true, name: true } } } },
        },
        orderBy: { session: { endedAt: 'desc' } },
      })
    : []

  const claimSlots = unclaimedGuests.map((sp) => {
    const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    return {
      sessionPlayerId: sp.id,
      sessionId:       sp.session.id,
      sessionStatus:   sp.session.status,
      endedAt:         sp.session.endedAt?.toISOString() ?? null,
      groupId:         sp.session.group.id,
      groupName:       sp.session.group.name,
      guestName:       sp.guestName,
      netCents:        (sp.cashOutCents ?? 0) - buyIn,
      buyInCents:      buyIn,
    }
  })

  const [memberships, recentSessions] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: { group: { include: { _count: { select: { members: true, sessions: true } } } } },
      orderBy: { joinedAt: 'desc' },
      take: 5,
    }),
    prisma.sessionPlayer.findMany({
      where: { userId: session.user.id },
      include: { session: { include: { group: { select: { id: true, name: true } } } }, buyIns: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  const isGuest = session.user.isGuest ?? false
  const settledPlays = recentSessions.filter((sp) => sp.session.status === 'SETTLED')

  const allTimePlays = isGuest ? [] : await prisma.sessionPlayer.findMany({
    where: { userId: session.user.id, session: { status: 'SETTLED' } },
    include: { buyIns: true },
  })

  const allTimeNet = allTimePlays.reduce((sum, sp) => {
    const b = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
    return sum + (sp.cashOutCents ?? 0) - b
  }, 0)
  const allTimeBuyIn = allTimePlays.reduce((sum, sp) => sum + sp.buyIns.reduce((s, b) => s + b.amountCents, 0), 0)
  const roi = allTimeBuyIn > 0 ? Math.round((allTimeNet / allTimeBuyIn) * 10000) / 100 : null

  return (
    <main className="min-h-[100dvh] px-5 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-felt-50">
            Welcome back, {session.user.name ?? 'Player'}
          </h1>
          <p className="text-felt-400 text-sm mt-1">Your poker overview at a glance.</p>
        </div>

        {/* Zelle nudge */}
        {!session.user.zelleHandle && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-amber-800 text-sm">Add your Zelle handle so group members can pay you.</p>
            <Link href="/profile" className="text-amber-900 hover:text-amber-700 text-sm font-semibold whitespace-nowrap transition-colors">Set up →</Link>
          </div>
        )}

        {/* Guest locked stats banner */}
        {isGuest && (
          <div className="bg-felt-800 border border-felt-600 rounded-xl px-5 py-4 mb-8 flex items-center justify-between gap-4 shadow-card">
            <div>
              <p className="text-felt-100 text-sm font-semibold">All-time stats are locked</p>
              <p className="text-felt-400 text-xs mt-0.5">Create a full account to track your net P&amp;L, ROI, and session history.</p>
            </div>
            <Link href="/signup" className="flex-shrink-0 text-xs font-semibold bg-gold-400 hover:bg-gold-300 text-white rounded-lg px-3.5 py-2 transition-colors">
              Upgrade
            </Link>
          </div>
        )}

        {/* All-time stat strip . one panel, hairline-divided */}
        {!isGuest && allTimePlays.length > 0 && (
          <div className="grid grid-cols-3 bg-felt-800 border border-felt-600 rounded-2xl shadow-card mb-8 divide-x divide-felt-600">
            <div className="px-5 py-5">
              <p className="text-felt-400 text-xs font-medium mb-1.5">All-time net</p>
              <p className={`text-xl sm:text-2xl font-semibold tnum ${allTimeNet > 0 ? 'text-gold-400' : allTimeNet < 0 ? 'text-red-600' : 'text-felt-100'}`}>
                {allTimeNet > 0 ? '+' : ''}{formatCents(allTimeNet)}
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-felt-400 text-xs font-medium mb-1.5">ROI</p>
              <p className={`text-xl sm:text-2xl font-semibold tnum ${roi === null ? 'text-felt-300' : roi >= 0 ? 'text-gold-400' : 'text-red-600'}`}>
                {roi !== null ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '·'}
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="text-felt-400 text-xs font-medium mb-1.5">Sessions</p>
              <p className="text-xl sm:text-2xl font-semibold tnum text-felt-100">{allTimePlays.length}</p>
            </div>
          </div>
        )}

        {/* Claim guest sessions */}
        <ClaimSessions initial={claimSlots} />

        {/* Groups */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-felt-50 font-semibold text-lg tracking-tight">Your groups</h2>
          <Link href="/groups" className="text-gold-400 hover:text-gold-300 text-sm font-medium transition-colors">View all →</Link>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-felt-800 rounded-2xl p-10 text-center border border-felt-600 shadow-card mb-6">
            <p className="text-felt-200 text-sm mb-4">No groups yet. Start one and invite your table.</p>
            <Link href="/groups" className="inline-block rounded-lg bg-gold-400 hover:bg-gold-300 text-white font-semibold px-5 py-2.5 text-sm transition-colors">
              Create or join a group
            </Link>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {memberships.map((m) => (
              <Link key={m.group.id} href={`/groups/${m.group.id}`}
                className="flex items-center justify-between bg-felt-800 rounded-xl px-5 py-4 border border-felt-600 hover:border-gold-400/50 hover:shadow-card transition-all group">
                <div>
                  <p className="text-felt-50 text-sm font-semibold group-hover:text-gold-400 transition-colors">{m.group.name}</p>
                  <p className="text-felt-400 text-xs mt-0.5">{m.group._count.members} members · {m.group._count.sessions} sessions</p>
                </div>
                <svg className="w-4 h-4 text-felt-500 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Recent sessions */}
        {settledPlays.length > 0 && (
          <>
            <h2 className="text-felt-50 font-semibold text-lg tracking-tight mb-3">Recent results</h2>
            <div className="bg-felt-800 rounded-2xl border border-felt-600 shadow-card overflow-hidden divide-y divide-felt-600">
              {settledPlays.map((sp) => {
                const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
                const net = (sp.cashOutCents ?? 0) - buyIn
                return (
                  <div key={sp.id} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-felt-100 text-sm font-medium">{sp.session.group.name}</p>
                      <p className="text-felt-400 text-xs mt-0.5">Buy-in: <span className="tnum">{formatCents(buyIn)}</span></p>
                    </div>
                    <span className={`text-sm font-semibold tnum ${net > 0 ? 'text-gold-400' : net < 0 ? 'text-red-600' : 'text-felt-400'}`}>
                      {net > 0 ? '+' : ''}{formatCents(net)}
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
