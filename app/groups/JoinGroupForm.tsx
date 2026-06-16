'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinGroupForm() {
  const [code, setCode]     = useState('')
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle')
  const [error, setError]   = useState<string | null>(null)
  const router = useRouter()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setStatus('joining'); setError(null)

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
          placeholder="6-character code"
          maxLength={6}
          className="flex-1 rounded-lg bg-felt-900 border border-felt-500 text-felt-50 px-4 py-2.5 text-sm placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors font-mono uppercase tracking-[0.2em]"
        />
        <button
          type="submit"
          disabled={status === 'joining' || code.trim().length < 6}
          className="rounded-lg bg-gold-400 hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed text-felt-900 font-bold px-5 py-2.5 text-sm transition-all whitespace-nowrap"
        >
          {status === 'joining' ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
