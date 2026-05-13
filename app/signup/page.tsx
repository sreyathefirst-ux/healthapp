'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
      // Create user record
      await supabase.from('users').insert({ id: data.user.id, onboarding_complete: false })
      router.push('/onboarding')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <svg viewBox="0 0 100 130" width="48" height="62">
              <defs>
                <linearGradient id="signupLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#6FD8A0', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#B48FE8', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <path d="M 50 5 Q 78 18 85 48 Q 88 75 75 108 Q 50 128 50 128 Q 50 128 25 108 Q 12 75 15 48 Q 22 18 50 5 Z" fill="url(#signupLeafGrad)" />
              <path d="M 50 10 Q 51 38 50 70 Q 49 100 50 128" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
            </svg>
          </div>
          <h1 className="font-script text-4xl text-vitalia-gradient">Join Vitalia</h1>
          <p className="text-text-secondary mt-2 text-sm">Start your personalized health journey</p>
        </div>

        <Card>
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-accent-coral/20 text-text-secondary px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#A8D5BA' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#A8D5BA' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm transition-colors"
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" loading={loading} className="w-full mt-2">
              Create Account
            </Button>
          </form>
        </Card>

        <p className="text-center text-text-secondary text-sm mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
