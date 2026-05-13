'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/dashboard')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center relative overflow-hidden">
      {/* Breathing circle with leaf logo */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-16">
        <div
          className="absolute inset-0 rounded-full border-2 animate-breathe"
          style={{ borderColor: '#6FD8A0' }}
        />
        <div
          className="absolute inset-0 rounded-full border animate-breathe-2"
          style={{ borderColor: '#B48FE8' }}
        />
        <div className="relative z-10">
          <Image src="/leaf-logo.svg" alt="Vitalia" width={85} height={110} />
        </div>
      </div>

      {/* Wordmark */}
      <h1 className="font-black text-3xl tracking-[3px] uppercase text-text-primary animate-vitalia-in mb-8">
        VITALIA
      </h1>

      <p className="text-[11px] uppercase tracking-[1px] mb-3 animate-fade-in-up-1 text-vitalia-muted">
        Your health companion
      </p>
      <p className="text-[13px] leading-relaxed max-w-[260px] animate-fade-in-up-2 text-text-secondary">
        AI-powered insights tailored to your unique biology. Start your wellness journey.
      </p>

      <a
        href="/signup"
        className="mt-14 px-8 py-3 text-white text-sm font-bold uppercase tracking-[0.6px] btn-vitalia animate-fade-in-up-2"
      >
        Get Started
      </a>

      <div className="absolute bottom-10 text-center animate-scroll-bounce">
        <p className="text-[10px] font-semibold tracking-[1.5px] mb-2 text-vitalia-dim">
          SCROLL DOWN
        </p>
        <a href="/signup" className="text-lg text-lavender">↓</a>
      </div>
    </div>
  )
}
