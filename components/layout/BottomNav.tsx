'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', emoji: '🏠', label: 'Home' },
  { href: '/meal-plan', emoji: '🍽️', label: 'Meals' },
  { href: '/workout-plan', emoji: '💪', label: 'Workout' },
  { href: '/routine/morning', emoji: '✅', label: 'Routine' },
  { href: '/settings', emoji: '⚙️', label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-area-pb">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map(({ href, emoji, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                isActive ? 'text-accent-primary' : 'text-text-secondary'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
