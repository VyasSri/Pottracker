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

  const settledPlays = recentSessions.filter((sp) => sp.session.status === 'SETTLED')
  const allTimePlays = await prisma.sessionPlayer.findMany({
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
    <main className="min-h-screen bg-felt-900 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-felt-50 mb-1">
            Welcome back, {session.user.name ?? 'Player'} 👋
          </h1>
          <p className="text-felt-400 text-sm">Here&apos;s your poker overview.</p>
        </div>

        {/* Zelle nudge */}
        {!session.user.zelleHandle && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-6 flex items-center justify-between gap-4">
            <p className="text-amber-400 text-sm">Add your Zelle handle so group members can pay you.</p>
            <Link href="/profile" className="text-amber-400 hover:text-amber-300 text-sm font-semibold whitespace-nowrap transition-colors">Set up →</Link>
          </div>
        )}

        {/* Stat cards — each has its own color identity */}
        {allTimePlays.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {/* Net P&L — green/red */}
            <div className={`rounded-xl p-5 border relative overflow-hidden ${
              allTimeNet >= 0
                ? 'bg-emerald-950/60 border-emerald-700/40'
                : 'bg-red-950/60 border-red-700/40'
            }`}>
              <div className={`absolute inset-0 opacity-10 ${allTimeNet >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <p className="text-xs uppercase tracking-wider font-semibold mb-2 relative z-10" style={{ color: allTimeNet >= 0 ? '#6ee7b7' : '#fca5a5' }}>All-time net</p>
              <p className={`text-2xl font-bold relative z-10 ${allTimeNet >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {allTimeNet > 0 ? '+' : ''}{formatCents(allTimeNet)}
              </p>
            </div>

            {/* ROI — gold */}
            <div className="bg-amber-950/60 border border-amber-700/40 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-400/10" />
              <p className="text-amber-300 text-xs uppercase tracking-wider font-semibold mb-2 relative z-10">ROI</p>
              <p className={`text-2xl font-bold relative z-10 ${roi !== null && roi >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                {roi !== null ? `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
              </p>
            </div>

            {/* Sessions — indigo */}
            <div className="bg-indigo-950/60 border border-indigo-700/40 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-indigo-400/10" />
              <p className="text-indigo-300 text-xs uppercase tracking-wider font-semibold mb-2 relative z-10">Sessions</p>
              <p className="text-2xl font-bold text-indigo-200 relative z-10">{allTimePlays.length}</p>
            </div>
          </div>
        )}

        {/* Claim guest sessions */}
        <ClaimSessions initial={claimSlots} />

        {/* Groups */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-felt-100 font-semibold text-lg">Your groups</h2>
          <Link href="/groups" className="text-gold-400 hover:text-gold-300 text-sm font-semibold transition-colors">View all →</Link>
        </div>

        {memberships.length === 0 ? (
          <div className="bg-felt-800 rounded-xl p-8 text-center border border-felt-600 mb-6">
            <p className="text-4xl mb-3 font-display text-felt-500">♠</p>
            <p className="text-felt-200 text-sm mb-4">No groups yet.</p>
            <Link href="/groups" className="inline-block rounded-lg bg-gold-400 hover:bg-gold-300 text-felt-900 font-bold px-5 py-2 text-sm transition-all">
              Create or join a group
            </Link>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {memberships.map((m) => (
              <Link key={m.group.id} href={`/groups/${m.group.id}`}
                className="flex items-center justify-between bg-felt-800 rounded-xl px-5 py-4 border border-felt-600 hover:border-gold-500/50 hover:bg-felt-700 transition-all group">
                <div>
                  <p className="text-felt-100 text-sm font-semibold group-hover:text-gold-400 transition-colors">{m.group.name}</p>
                  <p className="text-felt-400 text-xs mt-0.5">{m.group._count.members} members · {m.group._count.sessions} sessions</p>
                </div>
                <svg className="w-4 h-4 text-felt-500 group-hover:text-gold-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Recent sessions */}
        {settledPlays.length > 0 && (
          <>
            <h2 className="text-felt-100 font-semibold text-lg mb-3">Recent results</h2>
            <div className="bg-felt-800 rounded-2xl border border-felt-600 overflow-hidden">
              {settledPlays.map((sp, i) => {
                const buyIn = sp.buyIns.reduce((s, b) => s + b.amountCents, 0)
                const net = (sp.cashOutCents ?? 0) - buyIn
                return (
                  <div key={sp.id} className={`flex items-center justify-between px-5 py-4 ${i < settledPlays.length - 1 ? 'border-b border-felt-600' : ''}`}>
                    <div>
                      <p className="text-felt-100 text-sm font-medium">{sp.session.group.name}</p>
                      <p className="text-felt-400 text-xs mt-0.5">Buy-in: {formatCents(buyIn)}</p>
                    </div>
                    <span className={`text-sm font-bold ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-felt-400'}`}>
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
