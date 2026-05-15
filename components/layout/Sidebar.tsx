'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Home, UtensilsCrossed, Dumbbell, CheckCircle2, BarChart2, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/meal-plan', label: 'Meal Plan', icon: UtensilsCrossed },
  { href: '/workout-plan', label: 'Workout', icon: Dumbbell },
  { href: '/routine/morning', label: 'Routine', icon: CheckCircle2 },
  { href: '/insights', label: 'Insights', icon: BarChart2 },
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
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-white border-r border-slate-200 flex-col z-40">
      <div className="px-5 py-7 flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 flex-shrink-0 px-1">
          <Image src="/leaf-logo.png" alt="Vitalia" width={26} height={27} className="flex-shrink-0" />
          <span
            className="text-sm font-black uppercase tracking-[2.5px]"
            style={{
              background: 'linear-gradient(to right, #10b981, #9333ea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            VITALIA
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 font-medium text-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-50 to-purple-50 text-emerald-700 border border-emerald-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-4 rounded-full flex-shrink-0"
                    style={{ background: 'linear-gradient(to bottom, #10b981, #9333ea)' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all duration-150 font-medium text-sm flex-shrink-0 w-full mt-4 border border-transparent"
        >
          <LogOut size={18} strokeWidth={2} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
