'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinGroupForm() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setStatus('joining')
    setError(null)

    const res = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code.trim().toUpperCase() }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to join group')
      setStatus('error')
      return
    }

    const group = await res.json()
    router.push(`/groups/${group.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleJoin} className="flex gap-3">
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-character code"
          maxLength={6}
          className="flex-1 rounded-lg bg-[#0f1117] border border-gray-700 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono uppercase tracking-widest"
        />
        <button
          type="submit"
          disabled={status === 'joining' || code.trim().length < 6}
          className="rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 text-sm transition-colors whitespace-nowrap"
        >
          {status === 'joining' ? 'Joining…' : 'Join group'}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
