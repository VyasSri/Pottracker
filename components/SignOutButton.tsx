'use client'

import { signOut } from 'next-auth/react'

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-felt-300 hover:text-felt-100 text-sm border border-felt-500 hover:border-felt-400 rounded-lg px-3 py-1.5 transition-all"
    >
      Sign out
    </button>
  )
}
