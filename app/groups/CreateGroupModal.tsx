'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateGroupModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleClose() {
    setOpen(false)
    setName('')
    setStatus('idle')
    setError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setStatus('creating')
    setError(null)

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
    handleClose()
    router.push(`/groups/${group.id}`)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 text-sm transition-colors"
      >
        Create group
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-[#1a1f2e] rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-1">Create a group</h2>
            <p className="text-gray-400 text-sm mb-6">
              You'll get a shareable invite code once the group is created.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="groupName"
                  className="block text-sm font-medium text-gray-300 mb-1.5"
                >
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
                  className="w-full rounded-lg bg-[#0f1117] border border-gray-700 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-gray-700 text-gray-300 hover:text-white py-2.5 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'creating'}
                  className="flex-1 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition-colors"
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
