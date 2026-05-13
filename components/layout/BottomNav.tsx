'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, Dumbbell, CheckCircle2, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/meal-plan', label: 'Meals', icon: UtensilsCrossed },
  { href: '/workout-plan', label: 'Workout', icon: Dumbbell },
  { href: '/routine/morning', label: 'Routine', icon: CheckCircle2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-area-pb"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0"
            >
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-emerald-50' : ''}`}>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: isActive ? '#10b981' : '#94a3b8' }}
                />
              </div>
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: isActive ? '#10b981' : '#94a3b8' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
