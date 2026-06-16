'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateGroupModal() {
  const [open, setOpen]     = useState(false)
  const [name, setName]     = useState('')
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle')
  const [error, setError]   = useState<string | null>(null)
  const router = useRouter()

  function close() { setOpen(false); setName(''); setStatus('idle'); setError(null) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setStatus('creating'); setError(null)

    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to create group')
      setStatus('error')
      return
    }

    const group = await res.json()
    close()
    router.push(`/groups/${group.id}`)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gold-400 hover:bg-gold-300 text-felt-900 font-bold px-4 py-2 text-sm transition-all"
      >
        Create group
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="bg-felt-800 rounded-2xl shadow-card p-8 w-full max-w-md border border-felt-600">
            <h2 className="text-xl font-bold text-felt-50 mb-1">Create a group</h2>
            <p className="text-felt-400 text-sm mb-6">
              You&apos;ll get a shareable invite code once the group is created.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-felt-200 mb-1.5">
                  Group name
                </label>
                <input
                  id="groupName"
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tuesday Night Poker"
                  className="w-full rounded-lg bg-felt-900 border border-felt-500 text-felt-50 px-4 py-2.5 text-sm placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-lg border border-felt-500 hover:border-felt-400 text-felt-300 hover:text-felt-100 py-2.5 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'creating'}
                  className="flex-1 rounded-lg bg-gold-400 hover:bg-gold-300 disabled:opacity-60 disabled:cursor-not-allowed text-felt-900 font-bold py-2.5 text-sm transition-all"
                >
                  {status === 'creating' ? 'Creating…' : 'Create group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
