'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Dumbbell, CheckSquare, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home, emoji: '🏠' },
  { href: '/meal-plan', label: 'Meal Plan', icon: UtensilsCrossed, emoji: '🍽️' },
  { href: '/workout-plan', label: 'Workout', icon: Dumbbell, emoji: '💪' },
  { href: '/routine/morning', label: 'Routine', icon: CheckSquare, emoji: '✅' },
  { href: '/settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-vitalia-border flex-col z-40">
      <div className="px-6 py-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <svg viewBox="0 0 100 130" width="28" height="36" className="flex-shrink-0">
            <defs>
              <linearGradient id="sidebarLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#6FD8A0', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#B48FE8', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <path d="M 50 5 Q 78 18 85 48 Q 88 75 75 108 Q 50 128 50 128 Q 50 128 25 108 Q 12 75 15 48 Q 22 18 50 5 Z" fill="url(#sidebarLeafGrad)" />
            <path d="M 50 10 Q 51 38 50 70 Q 49 100 50 128" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          </svg>
          <span className="font-script text-2xl text-vitalia-gradient">Vitalia</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, emoji }) => {
            const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-accent-primary/15 text-accent-primary'
                    : 'text-vitalia-muted hover:bg-bg hover:text-text-primary'
                }`}
              >
                <span className="text-lg">{emoji}</span>
                <span>{label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-primary" />}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
