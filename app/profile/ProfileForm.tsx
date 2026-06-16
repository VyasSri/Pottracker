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

const inputCls =
  'w-full rounded-lg bg-felt-900 border border-felt-500 text-felt-50 px-4 py-2.5 text-sm placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors'

export default function ProfileForm({ initialValues }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(initialValues.displayName)
  const [zelleHandle, setZelleHandle] = useState(initialValues.zelleHandle ?? '')
  const [avatarUrl, setAvatarUrl]     = useState(initialValues.avatarUrl ?? '')
  const [dashboardPublic, setPublic]  = useState(initialValues.dashboardPublic)
  const [status, setStatus]           = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg(null)

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
      setErrorMsg((data as { error?: string }).error ?? 'Failed to save. Please try again.')
      setStatus('error')
      return
    }

    setStatus('saved')
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-felt-200 mb-1.5">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="zelleHandle" className="block text-sm font-medium text-felt-200 mb-1.5">
          Zelle phone or email
        </label>
        <input
          id="zelleHandle"
          type="text"
          value={zelleHandle}
          onChange={(e) => setZelleHandle(e.target.value)}
          className={inputCls}
          placeholder="e.g. +15125550100 or you@example.com"
        />
        <p className="mt-1.5 text-xs text-felt-500">
          Used to pre-fill Zelle payment links for group members.
        </p>
      </div>

      <div>
        <label htmlFor="avatarUrl" className="block text-sm font-medium text-felt-200 mb-1.5">
          Avatar URL <span className="text-felt-500 font-normal">(optional)</span>
        </label>
        <input
          id="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className={inputCls}
          placeholder="https://…"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          id="dashboardPublic"
          type="checkbox"
          checked={dashboardPublic}
          onChange={(e) => setPublic(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-felt-500 bg-felt-900 accent-gold-400 cursor-pointer"
        />
        <div>
          <p className="text-sm text-felt-200">Make my stats dashboard public</p>
          <p className="text-xs text-felt-500 mt-0.5">
            Anyone with the link can view your personal stats page.
          </p>
        </div>
      </label>

      {status === 'error' && errorMsg && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}
      {status === 'saved' && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">
          Profile saved successfully.
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-lg bg-gold-400 hover:bg-gold-300 disabled:opacity-60 disabled:cursor-not-allowed text-felt-900 font-bold py-2.5 text-sm transition-all"
      >
        {status === 'saving' ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}
