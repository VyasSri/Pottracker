'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'upgrade-prompt-dismissed'

export default function UpgradePrompt({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [visible, setVisible]   = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    try {
      const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      if (!dismissed.includes(sessionId)) setVisible(true)
    } catch { setVisible(true) }
  }, [sessionId])

  function dismiss() {
    try {
      const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed, sessionId]))
    } catch {}
    setVisible(false)
  }

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/profile/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    setLoading(false)
    // Send to login with email pre-filled and a success notice
    router.push(`/login?email=${encodeURIComponent(email)}&upgraded=1`)
  }

  if (!visible) return null

  const inputCls = 'w-full rounded-lg bg-felt-900 border border-felt-600 text-felt-50 px-3 py-2 text-sm placeholder-felt-500 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-felt-800 rounded-2xl border border-gold-400/30 shadow-card w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-felt-50 font-semibold text-lg">You&apos;re all settled up 🎉</h2>
            <p className="text-felt-400 text-sm mt-1">
              Create a full account to track your stats over time.
            </p>
          </div>
          <button onClick={dismiss} className="text-felt-500 hover:text-felt-200 text-2xl leading-none ml-3 transition-colors">
            ×
          </button>
        </div>

        <form onSubmit={handleUpgrade} className="space-y-3">
          <div>
            <label className="block text-xs text-felt-400 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className={inputCls} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-xs text-felt-400 uppercase tracking-wider mb-1.5">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls} placeholder="At least 8 characters" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={dismiss}
              className="flex-1 border border-felt-600 hover:border-felt-500 text-felt-400 hover:text-felt-200 rounded-lg py-2 text-sm transition-all">
              Maybe later
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-felt-900 font-bold rounded-lg py-2 text-sm transition-all">
              {loading ? 'Upgrading…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
