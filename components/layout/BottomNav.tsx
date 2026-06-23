'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell, CheckCircle2, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', Icon: Home, label: 'Home' },
  { href: '/meal-plan', Icon: Utensils, label: 'Meals' },
  { href: '/workout-plan', Icon: Dumbbell, label: 'Workout' },
  { href: '/routine/morning', Icon: CheckCircle2, label: 'Routine' },
  { href: '/settings', Icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-vitalia-border z-40"
      style={{ boxShadow: '0 -4px 20px rgba(36,40,30,.06)' }}
    >
      <div className="flex items-center justify-around px-4 py-2 pb-safe">
        {navItems.map(({ href, Icon, label }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ color: isActive ? '#07C281' : '#969C95' }}
              />
              <span
                className="text-[10px]"
                style={{
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#07C281' : '#969C95',
                }}
              >
                {label}
              </span>
              {isActive && (
                <span
                  className="w-1 h-1 rounded-full -mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #0FCB8C, #2BAEE6)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
