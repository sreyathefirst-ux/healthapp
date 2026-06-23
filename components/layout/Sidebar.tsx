'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell, CheckCircle2, BarChart3, HeartPulse, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Home', Icon: Home },
  { href: '/meal-plan', label: 'Meal Plan', Icon: Utensils },
  { href: '/workout-plan', label: 'Workout', Icon: Dumbbell },
  { href: '/routine/morning', label: 'Routine', Icon: CheckCircle2 },
  { href: '/health-report', label: 'Health Report', Icon: HeartPulse },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[236px] bg-white border-r border-vitalia-border flex-col z-40">
      <div className="px-4 py-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div
            className="w-[30px] h-[30px] rounded-[9px] flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)' }}
          />
          <span className="font-black text-[17px] tracking-[.14em] text-text-primary">VITALIA</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-[11px] rounded-xl transition-colors text-sm font-medium ${
                  isActive
                    ? 'bg-[#F4F5F8] text-text-primary font-semibold'
                    : 'text-vitalia-muted hover:bg-bg-2 hover:text-text-primary'
                }`}
              >
                {isActive && <span className="sidebar-active-bar" />}
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.2 : 2}
                  className={isActive ? 'text-green' : 'text-vitalia-muted'}
                />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
