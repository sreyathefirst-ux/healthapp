'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').insert({ id: data.user.id, onboarding_complete: false })
      router.push('/onboarding')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: 'linear-gradient(180deg, #DEFAEE 0%, #E2F0FC 38%, #EBE5FD 72%, #F1F5F9 100%)' }}
    >
      <div className="w-full max-w-[360px] bg-white rounded-[26px] border border-vitalia-border shadow-card-lg p-9">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-[18px] mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)' }}
          />
          <h1 className="font-display font-semibold text-[27px] tracking-[-0.01em] text-text-primary mb-1">
            Create your account
          </h1>
          <p className="text-text-secondary text-sm">Start your personalized health journey.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-[22px]">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-card text-sm border border-red-100">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-body">Email</label>
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
            <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-text-body">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="vitalia-input"
              placeholder="At least 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-white text-[15px] font-bold tracking-[0.2px] btn-vitalia disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-[13.5px] mt-6 text-vitalia-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-bold hover:underline text-green-deep">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
