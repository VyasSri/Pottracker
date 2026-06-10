import { getSession } from '@/lib/auth'
import Link from 'next/link'

export default async function Nav() {
  const session = await getSession()
  if (!session) return null

  return (
    <nav className="bg-[#0a0d14] border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-green-500 font-bold text-lg tracking-tight">
          Poker Ledger
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/groups"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Groups
          </Link>
          <Link
            href="/profile"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Profile
          </Link>
        </div>
      </div>
    </nav>
  )
}
