'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function RootPage() {
  const router = useRouter()
  const signupRef = useRef<HTMLDivElement>(null)

  // Signup form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.replace('/dashboard')
    }
    checkAuth()
  }, [router])

  function scrollToSignup() {
    signupRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">

      {/* ── Section 1: Intro ───────────────────────────────────────── */}
      <section className="h-screen snap-start flex flex-col items-center justify-center px-8 text-center relative bg-gradient-to-br from-slate-50 via-purple-50 to-green-50 flex-shrink-0">
        {/* Breathing circle */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-16">
          <div
            className="absolute inset-0 rounded-full border-2 animate-breathe"
            style={{ borderColor: '#10b981' }}
          />
          <div
            className="absolute inset-0 rounded-full border animate-breathe-2"
            style={{ borderColor: '#9333ea' }}
          />
          <div className="relative z-10">
            <Image src="/leaf-logo.png" alt="Vitalia" width={85} height={88} />
          </div>
        </div>

        <h1 className="font-black text-3xl tracking-[3px] uppercase text-text-primary animate-vitalia-in mb-8">
          VITALIA
        </h1>

        <p className="text-[11px] uppercase tracking-[1px] mb-3 animate-fade-in-up-1 text-vitalia-muted">
          Your health companion
        </p>
        <p className="text-[13px] leading-relaxed max-w-[260px] animate-fade-in-up-2 text-text-secondary">
          AI-powered insights tailored to your unique biology. Start your wellness journey.
        </p>

        <button
          onClick={scrollToSignup}
          className="mt-14 px-8 py-3 text-white text-sm font-bold uppercase tracking-[0.6px] btn-vitalia animate-fade-in-up-2"
        >
          Get Started
        </button>

        {/* Bouncing scroll indicator */}
        <button
          onClick={scrollToSignup}
          className="absolute bottom-10 text-center animate-scroll-bounce focus:outline-none"
        >
          <p className="text-[10px] font-semibold tracking-[1.5px] mb-2 text-vitalia-dim">
            SCROLL DOWN
          </p>
          <span className="text-lg text-lavender">↓</span>
        </button>
      </section>

      {/* ── Section 2: Create Account ─────────────────────────────── */}
      <section
        ref={signupRef}
        className="h-screen snap-start flex flex-col items-center justify-center px-8 bg-gradient-to-br from-slate-50 via-purple-50 to-green-50 flex-shrink-0"
      >
        <div className="w-full max-w-[340px]">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <Image src="/leaf-logo.png" alt="Vitalia" width={40} height={42} />
            </div>
            <h2 className="font-black text-2xl tracking-[2px] uppercase text-text-primary">VITALIA</h2>
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
      </section>

    </div>
  )
}
