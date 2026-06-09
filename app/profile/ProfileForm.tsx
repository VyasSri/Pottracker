'use client'

import { useState } from 'react'

interface ProfileFormProps {
  initialValues: {
    displayName: string
    zelleHandle: string | null
    avatarUrl: string | null
    dashboardPublic: boolean
  }
}

export default function ProfileForm({ initialValues }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialValues.displayName)
  const [zelleHandle, setZelleHandle] = useState(initialValues.zelleHandle ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialValues.avatarUrl ?? '')
  const [dashboardPublic, setDashboardPublic] = useState(initialValues.dashboardPublic)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMessage(null)

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName || undefined,
        zelleHandle: zelleHandle || undefined,
        avatarUrl: avatarUrl || undefined,
        dashboardPublic,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrorMessage((data as { error?: string }).error ?? 'Failed to save. Please try again.')
      setStatus('error')
      return
    }

    setStatus('saved')
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1.5">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg bg-[#0f1117] border border-gray-700 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="zelleHandle" className="block text-sm font-medium text-gray-300 mb-1.5">
          Zelle phone or email
        </label>
        <input
          id="zelleHandle"
          type="text"
          value={zelleHandle}
          onChange={(e) => setZelleHandle(e.target.value)}
          className="w-full rounded-lg bg-[#0f1117] border border-gray-700 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="e.g. +15125550100 or you@example.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          Used to pre-fill Zelle payment links for your group members.
        </p>
      </div>

      <div>
        <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-300 mb-1.5">
          Avatar URL <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <input
          id="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="w-full rounded-lg bg-[#0f1117] border border-gray-700 text-white px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="https://…"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="dashboardPublic"
          type="checkbox"
          checked={dashboardPublic}
          onChange={(e) => setDashboardPublic(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-700 bg-[#0f1117] accent-green-500 cursor-pointer"
        />
        <label htmlFor="dashboardPublic" className="text-sm text-gray-300 cursor-pointer">
          Make my stats dashboard public
          <span className="block text-xs text-gray-500 mt-0.5">
            Anyone with the link can view your personal stats page.
          </span>
        </label>
      </div>

      {status === 'error' && errorMessage && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      {status === 'saved' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          Profile saved successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition-colors"
      >
        {status === 'saving' ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
