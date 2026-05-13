'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-green-50 flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-[340px]">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/leaf-logo.png" alt="Vitalia" width={48} height={50} />
          </div>
          <h1 className="font-black text-2xl tracking-[2px] uppercase text-text-primary">VITALIA</h1>
          <p className="text-text-secondary mt-2 text-sm">Start your personalized health journey</p>
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
            className="w-full py-3 text-white text-[13px] font-bold uppercase tracking-[0.6px] btn-vitalia disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-[11px] mt-6 text-vitalia-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-bold hover:underline text-teal">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
