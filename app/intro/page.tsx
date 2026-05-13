import Link from 'next/link'

export default function IntroPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 text-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #FDFCFA 0%, #F9F8F6 50%, #F3F8F5 100%)' }}
    >
      {/* Breathing circle with leaf logo */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-16">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2 animate-breathe"
          style={{ borderColor: '#A8D5BA' }}
        />
        {/* Inner ring (lavender, delayed) */}
        <div
          className="absolute inset-0 rounded-full border animate-breathe-2"
          style={{ borderColor: '#D4C5E8' }}
        />

        {/* Leaf logo — inline SVG so gradient renders correctly */}
        <svg viewBox="0 0 100 130" width="85" height="110" className="relative z-10">
          <defs>
            <linearGradient id="leafGradIntro" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#6FD8A0', stopOpacity: 1 }} />
              <stop offset="35%" style={{ stopColor: '#5DDAB8', stopOpacity: 1 }} />
              <stop offset="70%" style={{ stopColor: '#80C8D8', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#B48FE8', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <path
            d="M 50 5 Q 78 18 85 48 Q 88 75 75 108 Q 50 128 50 128 Q 50 128 25 108 Q 12 75 15 48 Q 22 18 50 5 Z"
            fill="url(#leafGradIntro)"
          />
          <path
            d="M 50 10 Q 51 38 50 70 Q 49 100 50 128"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </svg>
      </div>

      {/* Vitalia calligraphy */}
      <h1 className="font-script text-6xl text-vitalia-gradient animate-vitalia-in mb-8">
        Vitalia
      </h1>

      {/* Taglines */}
      <p
        className="text-[11px] uppercase tracking-[1px] mb-3 animate-fade-in-up-1"
        style={{ color: '#8B8B9A' }}
      >
        Your health companion
      </p>
      <p
        className="text-[13px] leading-relaxed max-w-[260px] animate-fade-in-up-2"
        style={{ color: '#5D5D6D' }}
      >
        AI-powered insights tailored to your unique biology. Start your wellness journey.
      </p>

      {/* CTA */}
      <Link
        href="/login"
        className="mt-14 px-8 py-3 rounded-[10px] text-white text-sm font-bold uppercase tracking-[0.6px] btn-vitalia animate-fade-in-up-2"
      >
        Get Started
      </Link>

      {/* Scroll indicator — decorative, also links to /login */}
      <div className="absolute bottom-10 text-center animate-scroll-bounce">
        <p className="text-[10px] font-semibold tracking-[1.5px] mb-2" style={{ color: '#C4C4D0' }}>
          SCROLL DOWN
        </p>
        <span className="text-lg" style={{ color: '#D4C5E8' }}>↓</span>
      </div>
    </div>
  )
}
