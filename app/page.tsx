'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Clock, ShieldCheck, Sparkles, HeartPulse, ChevronDown } from 'lucide-react'

// ── Shared constants ─────────────────────────────────────────────────────────

const GRAD = 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)'

// ── Auth form field ──────────────────────────────────────────────────────────

function AuthInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: '#969C95',
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="vitalia-input"
      />
    </div>
  )
}

// ── Sliding auth card (create ⇄ sign in ⇄ reset) ────────────────────────────

function AuthCard({
  mode,
  setMode,
  onSignup,
  onLogin,
  loading,
  error,
}: {
  mode: 'create' | 'signin' | 'reset'
  setMode: (m: 'create' | 'signin' | 'reset') => void
  onSignup: (email: string, password: string) => void
  onLogin: (email: string, password: string) => void
  loading: boolean
  error: string
}) {
  const [cEmail, setCEmail] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [sEmail, setSEmail] = useState('')
  const [sPassword, setSPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const onSecond = mode === 'signin' || mode === 'reset'

  const switchLink: React.CSSProperties = { color: '#04976A', fontWeight: 700, cursor: 'pointer' }
  const headStyle: React.CSSProperties = {
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    fontSize: 27,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    margin: '0 0 6px',
    color: '#16201B',
  }
  const subStyle: React.CSSProperties = { fontSize: 14, color: '#6C736C', margin: '0 0 22px', lineHeight: 1.5 }
  const primaryBtn: React.CSSProperties = {
    background: GRAD,
    borderRadius: 13,
    padding: '14px 20px',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(resetEmail)
    setResetSent(true)
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 408,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 26,
        border: '1px solid #E2E8F0',
        boxShadow: '0 24px 60px rgba(36,40,30,.14)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '200%',
          alignItems: 'stretch',
          transform: onSecond ? 'translateX(-50%)' : 'none',
          transition: 'transform .46s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* PANEL 1 — Create account */}
        <div style={{ width: '50%', flex: '0 0 50%', padding: '36px 38px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={headStyle}>Create your account</h2>
          <p style={subStyle}>Start your personalized health journey today.</p>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100 mb-4">{error}</div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); onSignup(cEmail, cPassword) }}
            className="flex flex-col gap-4"
          >
            <AuthInput label="Email" type="email" value={cEmail} onChange={setCEmail} placeholder="you@example.com" autoComplete="email" />
            <AuthInput label="Password" type="password" value={cPassword} onChange={setCPassword} placeholder="At least 6 characters" autoComplete="new-password" />
            <button type="submit" disabled={loading} style={{ ...primaryBtn, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Creating account…' : 'Create account'}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <p style={{ fontSize: 13.5, color: '#969C95', textAlign: 'center', marginTop: 18 }}>
            Already have an account? <span onClick={() => setMode('signin')} style={switchLink}>Sign in</span>
          </p>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <ShieldCheck size={14} style={{ color: '#969C95', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: '#B0B5AE', lineHeight: 1.5 }}>
              Your data is encrypted, never sold, and used only to improve your care.
            </p>
          </div>
        </div>

        {/* PANEL 2 — Sign in / Reset */}
        <div style={{ width: '50%', flex: '0 0 50%', padding: '36px 38px', display: 'flex', flexDirection: 'column' }}>
          {mode !== 'reset' ? (
            <>
              <h2 style={headStyle}>Welcome back</h2>
              <p style={subStyle}>Continue where you left off.</p>

              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100 mb-4">{error}</div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); onLogin(sEmail, sPassword) }}
                className="flex flex-col gap-4"
              >
                <AuthInput label="Email" type="email" value={sEmail} onChange={setSEmail} placeholder="you@example.com" autoComplete="email" />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#969C95' }}>Password</label>
                    <span onClick={() => setMode('reset')} style={{ fontSize: 12.5, color: '#04976A', fontWeight: 600, cursor: 'pointer' }}>Forgot?</span>
                  </div>
                  <input
                    type="password"
                    value={sPassword}
                    onChange={(e) => setSPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="vitalia-input"
                  />
                </div>
                <button type="submit" disabled={loading} style={{ ...primaryBtn, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>

              <p style={{ fontSize: 13.5, color: '#969C95', textAlign: 'center', marginTop: 18 }}>
                New here? <span onClick={() => setMode('create')} style={switchLink}>Create an account</span>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode('signin'); setResetSent(false) }}
                style={{ border: 'none', background: 'transparent', color: '#969C95', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, marginBottom: 14 }}
              >
                ← Back to sign in
              </button>
              <h2 style={headStyle}>Reset your password</h2>
              <p style={subStyle}>
                {resetSent ? 'Check your email for a reset link.' : "Enter your email and we'll send a reset link."}
              </p>
              {!resetSent && (
                <form onSubmit={handleReset} className="flex flex-col gap-4">
                  <AuthInput label="Email" type="email" value={resetEmail} onChange={setResetEmail} placeholder="you@example.com" />
                  <button type="submit" style={{ ...primaryBtn, cursor: 'pointer' }}>Send reset link</button>
                </form>
              )}
              <p style={{ fontSize: 13.5, color: '#969C95', textAlign: 'center', marginTop: 18 }}>
                Remembered it? <span onClick={() => { setMode('signin'); setResetSent(false) }} style={switchLink}>Sign in</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Root page — Bloom Flip landing ───────────────────────────────────────────

export default function RootPage() {
  const router = useRouter()
  const authRef = useRef<HTMLElement>(null)
  const [mode, setMode] = useState<'create' | 'signin' | 'reset'>('create')
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

  function scrollToAuth() {
    authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function goToSignIn() {
    setMode('signin')
    setTimeout(scrollToAuth, 20)
  }

  async function handleSignup(email: string, password: string) {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('users').insert({ id: data.user.id, onboarding_complete: false })
      router.push('/onboarding')
    }
    setLoading(false)
  }

  async function handleLogin(email: string, password: string) {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', data.user.id)
        .maybeSingle()
      router.push(profile?.onboarding_complete ? '/dashboard' : '/onboarding')
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'linear-gradient(180deg, #DEFAEE 0%, #E2F0FC 38%, #EBE5FD 72%, #F1F5F9 100%)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: '#16201B',
      }}
    >
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: -130, right: -90, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,87,255,.12), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -150, left: -110, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,209,142,.12), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 44px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: GRAD }} />
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '.14em', color: '#16201B' }}>VITALIA</span>
        </div>
        <button
          onClick={goToSignIn}
          style={{
            border: 'none', background: 'rgba(255,255,255,.82)', borderRadius: 999,
            padding: '10px 22px', fontSize: 14, fontWeight: 600, color: '#16201B',
            cursor: 'pointer', backdropFilter: 'blur(6px)',
            boxShadow: '0 1px 2px rgba(36,40,30,.04), 0 4px 12px rgba(36,40,30,.04)', whiteSpace: 'nowrap',
          }}
        >
          Sign in
        </button>
      </header>

      {/* HERO */}
      <section
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '96px 24px 48px', position: 'relative', zIndex: 1,
        }}
      >
        <div
          className="animate-vitalia-in"
          style={{
            width: 80, height: 80, borderRadius: 24, marginBottom: 28, background: GRAD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(11,209,142,.25)',
          }}
        >
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M12 19c-8-4-8-10 0-12 8 2 8 8 0 12z" fill="rgba(255,255,255,.92)" />
          </svg>
        </div>

        <div className="animate-fade-in-up-1">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#04976A', marginBottom: 14 }}>
            AI health companion
          </p>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
              fontSize: 'clamp(34px, 4.6vw, 52px)', fontWeight: 600,
              letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0, color: '#16201B',
            }}
          >
            <div>Your health,</div>
            <div style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              finally understood.
            </div>
          </h1>
          <p style={{ fontSize: 16.5, color: '#6C736C', lineHeight: 1.55, maxWidth: 500, margin: '16px auto 28px' }}>
            Personalized plans, an AI care team, and a companion that grows with every healthy habit.
          </p>
        </div>

        <div className="animate-fade-in-up-2" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={scrollToAuth}
            style={{
              background: GRAD, borderRadius: 13, padding: '14px 26px', color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(18,190,158,.32)',
            }}
          >
            Get started <ChevronDown size={18} />
          </button>
          <span style={{ fontSize: 13.5, color: '#969C95', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Clock size={15} style={{ color: '#969C95' }} />5 min setup
          </span>
        </div>

        <div className="animate-fade-in-up-3" style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { icon: <Sparkles size={14} style={{ color: '#07C281' }} />, text: 'AI-powered plans' },
            { icon: <ShieldCheck size={14} style={{ color: '#2BAEE6' }} />, text: 'Private & secure' },
            { icon: <HeartPulse size={14} style={{ color: '#9B53E6' }} />, text: 'Built for chronic conditions' },
          ].map(({ icon, text }) => (
            <span key={text} className="landing-pill">{icon}{text}</span>
          ))}
        </div>
      </section>

      {/* AUTH */}
      <section
        ref={authRef}
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '96px 24px 80px', position: 'relative', zIndex: 1,
        }}
      >
        <AuthCard mode={mode} setMode={setMode} onSignup={handleSignup} onLogin={handleLogin} loading={loading} error={error} />
      </section>
    </div>
  )
}
