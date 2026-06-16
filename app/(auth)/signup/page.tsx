'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Mode = 'full' | 'guest'

export default function SignupPage() {
  const router = useRouter()
  const [mode, setMode]             = useState<Mode>('full')

  // full account fields
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [inviteCode, setInviteCode]   = useState('')

  // guest-only fields
  const [guestName, setGuestName]       = useState('')
  const [zelleHandle, setZelleHandle]   = useState('')
  const [guestCode, setGuestCode]       = useState('')

  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputCls =
    'w-full rounded-lg bg-felt-900 border border-felt-500 text-felt-50 px-4 py-2.5 text-sm placeholder-felt-400 focus:outline-none focus:ring-1 focus:ring-gold-400 focus:border-gold-400 transition-colors'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let signinEmail: string
    let signinPassword: string

    if (mode === 'guest') {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'guest',
          displayName: guestName,
          zelleHandle,
          inviteCode: guestCode,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Something went wrong.')
        setLoading(false)
        return
      }

      const data = await res.json()
      signinEmail    = data.guestEmail
      signinPassword = data.guestPassword
    } else {
      const body: Record<string, string> = { mode: 'full', displayName, email, password }
      if (inviteCode.trim()) body.inviteCode = inviteCode.trim()

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Something went wrong.')
        setLoading(false)
        return
      }

      signinEmail    = email
      signinPassword = password
    }

    const result = await signIn('credentials', {
      email: signinEmail,
      password: signinPassword,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Account created but sign-in failed. Try the login page.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      {/* Mode toggle */}
      <div className="flex bg-felt-900 rounded-lg p-1 mb-6">
        {(['full', 'guest'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
              mode === m
                ? 'bg-gold-400 text-felt-900'
                : 'text-felt-400 hover:text-felt-100'
            }`}
          >
            {m === 'full' ? 'Create account' : 'Join as guest'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Guest mode ── */}
        {mode === 'guest' && (
          <>
            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Group invite code
              </label>
              <input
                type="text"
                required
                value={guestCode}
                onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="e.g. AB12CD"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Your name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className={inputCls}
                placeholder="Poker Pete"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Zelle phone or email
              </label>
              <input
                type="text"
                required
                value={zelleHandle}
                onChange={(e) => setZelleHandle(e.target.value)}
                className={inputCls}
                placeholder="+15125550100 or you@example.com"
              />
              <p className="text-felt-500 text-xs mt-1.5">
                Used so group members can send you Zelle payments directly.
              </p>
            </div>

            <div className="bg-felt-900/60 border border-felt-700 rounded-lg px-4 py-3 text-xs text-felt-400">
              Guest accounts are tied to this browser session. To log back in later, add an email from your profile after joining.
            </div>
          </>
        )}

        {/* ── Full account mode ── */}
        {mode === 'full' && (
          <>
            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Display name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                placeholder="Poker Pete"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-felt-200 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="border-t border-felt-700 pt-4">
              <label className="block text-xs text-felt-500 uppercase tracking-wider mb-1.5">
                Invite code <span className="normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="Join a group at signup"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gold-400 hover:bg-gold-300 disabled:opacity-60 disabled:cursor-not-allowed text-felt-900 font-bold py-2.5 text-sm transition-all"
        >
          {loading
            ? 'Setting up…'
            : mode === 'guest'
              ? 'Join as Guest'
              : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-felt-400">
        Already have an account?{' '}
        <Link href="/login" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </>
  )
}
