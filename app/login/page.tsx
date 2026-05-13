'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', data.user.id)
        .maybeSingle()

      router.push(profile?.onboarding_complete ? '/dashboard' : '/onboarding')
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 relative">
      {/* Top gradient line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #5DDAB8 50%, transparent 100%)' }}
      />

      <div className="w-full max-w-[340px]">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="font-bold text-3xl text-text-primary mb-3">Welcome back</h1>
          <p className="text-[11px] uppercase tracking-[0.8px] text-vitalia-muted">
            Continue your journey
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-[22px]">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-card text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-body">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="vitalia-input"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-body">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="vitalia-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 py-3 text-white text-[13px] font-bold uppercase tracking-[0.6px] btn-vitalia disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[11px] mt-6 text-vitalia-muted">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-bold hover:underline text-teal"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
