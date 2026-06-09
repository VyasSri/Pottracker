import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {session.user.name ?? 'Player'}
        </h1>
        <p className="text-gray-400 text-lg">Dashboard — coming soon</p>
      </div>
    </main>
  )
}
