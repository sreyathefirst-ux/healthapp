'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

const navItems = [
  { href: '/dashboard', label: 'Home', emoji: '🏠' },
  { href: '/meal-plan', label: 'Meal Plan', emoji: '🍽️' },
  { href: '/workout-plan', label: 'Workout', emoji: '💪' },
  { href: '/routine/morning', label: 'Routine', emoji: '✅' },
  { href: '/settings', label: 'Settings', emoji: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-vitalia-border flex-col z-40">
      <div className="px-6 py-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <Image src="/leaf-logo.png" alt="Vitalia" width={28} height={29} className="flex-shrink-0" />
          <span className="text-sm font-black uppercase tracking-[2px] text-text-primary">VITALIA</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, emoji }) => {
            const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-card transition-all font-medium text-sm ${
                  isActive
                    ? 'bg-teal/10 text-teal'
                    : 'text-vitalia-muted hover:bg-bg-2 hover:text-text-primary'
                }`}
              >
                <span className="text-lg">{emoji}</span>
                <span>{label}</span>
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #6FD8A0, #5DDAB8)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
