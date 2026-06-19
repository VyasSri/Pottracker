'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

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

function AvatarUploader({
  avatarUrl,
  displayName,
  onUploaded,
}: {
  avatarUrl: string | null
  displayName: string
  onUploaded: (url: string) => void
}) {
  const [preview, setPreview]   = useState<string | null>(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return

    setPreview(URL.createObjectURL(file))
    setError(null)
    setUploading(true)

    const form = new FormData()
    form.append('avatar', file)

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Upload failed')
      setPreview(avatarUrl) // revert
    } else {
      onUploaded(data.avatarUrl)
    }
    setUploading(false)
  }, [avatarUrl, onUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploading,
  })

  const initials = (displayName || 'P')[0].toUpperCase()

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar preview */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold text-felt-900 flex-shrink-0 ring-2 ring-felt-600"
          style={{ background: 'linear-gradient(135deg, #e05050, #c53030)' }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-gold-400 bg-gold-400/5'
            : 'border-felt-500 hover:border-felt-400 hover:bg-felt-800/50'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-gold-400 text-sm font-medium">Drop it here…</p>
        ) : (
          <>
            <p className="text-felt-300 text-sm">Drag & drop an image, or <span className="text-gold-400 font-medium">click to browse</span></p>
            <p className="text-felt-600 text-xs mt-1">PNG, JPG, GIF, WebP · max 5 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

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
      {/* Avatar */}
      <div>
        <p className="text-sm font-medium text-felt-200 mb-3">Profile picture</p>
        <AvatarUploader
          avatarUrl={avatarUrl || null}
          displayName={displayName}
          onUploaded={(url) => setAvatarUrl(url)}
        />
      </div>

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
