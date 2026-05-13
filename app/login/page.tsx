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

      router.push(profile?.onboarding_complete ? '/' : '/onboarding')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 relative"
      style={{ background: 'linear-gradient(180deg, #FDFCFA 0%, #F9F8F6 100%)' }}
    >
      {/* Thin accent line at top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #A8D5BA 50%, transparent 100%)' }}
      />

      <div className="w-full max-w-[340px]">
        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="font-script text-5xl text-vitalia-gradient mb-3">Welcome</h1>
          <p className="text-[11px] uppercase tracking-[0.8px]" style={{ color: '#8B8B9A' }}>
            Continue your journey
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-[22px]">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-[10px] text-sm border border-red-100">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[11px] font-bold uppercase tracking-[0.5px]"
              style={{ color: '#A8D5BA' }}
            >
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
            <label
              className="text-[11px] font-bold uppercase tracking-[0.5px]"
              style={{ color: '#A8D5BA' }}
            >
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
            className="w-full mt-5 py-3 rounded-[10px] text-white text-[13px] font-bold uppercase tracking-[0.6px] btn-vitalia disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-[11px] mt-6" style={{ color: '#8B8B9A' }}>
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-bold hover:underline"
            style={{ color: '#A8D5BA' }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
