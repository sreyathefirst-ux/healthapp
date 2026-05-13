'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Home, UtensilsCrossed, Dumbbell, CheckCircle2, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/meal-plan', label: 'Meal Plan', icon: UtensilsCrossed },
  { href: '/workout-plan', label: 'Workout', icon: Dumbbell },
  { href: '/routine/morning', label: 'Routine', icon: CheckCircle2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-vitalia-border flex-col z-40">
      <div className="px-6 py-8 flex flex-col h-full">
        {/* Logo — unchanged */}
        <div className="flex items-center gap-3 mb-10 flex-shrink-0">
          <Image src="/leaf-logo.png" alt="Vitalia" width={28} height={29} className="flex-shrink-0" />
          <span className="text-sm font-black uppercase tracking-[2px] text-text-primary">VITALIA</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-green-50 to-purple-50 text-green-700 border border-green-200'
                    : 'text-vitalia-muted hover:bg-bg-2 hover:text-text-primary border border-transparent'
                }`}
              >
                <Icon size={19} strokeWidth={2.2} />
                <span>{label}</span>
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-5 rounded-full flex-shrink-0"
                    style={{ background: 'linear-gradient(to bottom, #10b981, #9333ea)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-vitalia-muted hover:bg-bg-2 hover:text-text-primary transition-all duration-200 font-medium text-sm flex-shrink-0 w-full mt-4"
        >
          <LogOut size={19} strokeWidth={2.2} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
