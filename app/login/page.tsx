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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 relative"
      style={{ background: 'linear-gradient(180deg, #DEFAEE 0%, #E2F0FC 38%, #EBE5FD 72%, #F1F5F9 100%)' }}
    >
      <div className="w-full max-w-[360px] bg-white rounded-[26px] border border-vitalia-border shadow-card-lg p-9">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-[18px] mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)' }}
          />
          <h1 className="font-display font-semibold text-[27px] tracking-[-0.01em] text-text-primary mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-text-secondary">Continue where you left off.</p>
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
            className="w-full mt-5 py-3.5 text-white text-[15px] font-bold tracking-[0.2px] btn-vitalia disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[13.5px] mt-6 text-vitalia-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-bold hover:underline text-green-deep">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
