'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', emoji: '🏠', label: 'Home' },
  { href: '/meal-plan', emoji: '🍽️', label: 'Meals' },
  { href: '/workout-plan', emoji: '💪', label: 'Workout' },
  { href: '/routine/morning', emoji: '✅', label: 'Routine' },
  { href: '/settings', emoji: '⚙️', label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-vitalia-border z-40 safe-area-pb"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map(({ href, emoji, label }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors"
            >
              <span className="text-2xl">{emoji}</span>
              <span
                className={`text-[10px] font-${isActive ? 'semibold' : 'normal'}`}
                style={{ color: isActive ? '#5DDAB8' : '#9B9BAA' }}
              >
                {label}
              </span>
              {isActive && (
                <span
                  className="w-1 h-1 rounded-full -mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #6FD8A0, #5DDAB8)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
