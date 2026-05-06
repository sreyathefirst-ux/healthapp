'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Dumbbell, CheckSquare, Settings } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', icon: Home, emoji: '🏠' },
  { href: '/meal-plan', label: 'Meal Plan', icon: UtensilsCrossed, emoji: '🍽️' },
  { href: '/workout-plan', label: 'Workout', icon: Dumbbell, emoji: '💪' },
  { href: '/routine/morning', label: 'Routine', icon: CheckSquare, emoji: '✅' },
  { href: '/settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white shadow-card flex-col z-40">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3 mb-10">
          <span className="text-2xl">🌿</span>
          <span className="text-xl font-bold text-text-primary">Vitalia</span>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, emoji }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-accent-primary/15 text-accent-primary'
                    : 'text-text-secondary hover:bg-bg hover:text-text-primary'
                }`}
              >
                <span className="text-lg">{emoji}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
