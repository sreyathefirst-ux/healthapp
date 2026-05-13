'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut, User, Bell, ShoppingCart } from 'lucide-react'

const PET_EMOJI: Record<string, string> = {
  rabbit: '🐰',
  bunny: '🐰',
  cat: '🐱',
  dog: '🐶',
  hamster: '🐹',
  bird: '🐦',
  fish: '🐠',
}

const settingsOptions = [
  {
    href: '/settings/profile',
    title: 'Profile & Health Info',
    description: 'Edit personal details, conditions, preferences',
    icon: User,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    description: 'Manage push notification preferences',
    icon: Bell,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    href: '/grocery-list',
    title: 'Grocery List',
    description: "View this week's shopping list",
    icon: ShoppingCart,
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [age, setAge] = useState<number | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [petName, setPetName] = useState('')
  const [petType, setPetType] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [userRes, petRes] = await Promise.all([
        supabase.from('users').select('name, age, weight_kg').eq('id', user.id).maybeSingle(),
        supabase.from('pet').select('pet_name, pet_type').eq('user_id', user.id).maybeSingle(),
      ])

      setUserName(userRes.data?.name || '')
      setAge(userRes.data?.age ?? null)
      setWeight(userRes.data?.weight_kg ?? null)
      setPetName(petRes.data?.pet_name || '')
      setPetType(petRes.data?.pet_type || '')
    }
    fetchProfile()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userName ? userName[0].toUpperCase() : '?'
  const petEmoji = PET_EMOJI[petType?.toLowerCase()] ?? '🐾'

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-6 lg:p-8 border border-slate-200 shadow-sm">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-md font-bold text-3xl select-none">
              {initial}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                {userName || 'Your Profile'}
              </h2>
              <div className="space-y-1.5">
                {age !== null && (
                  <p className="text-slate-700 font-medium text-sm">Age: {age}</p>
                )}
                {weight !== null && (
                  <p className="text-slate-700 font-medium text-sm">{weight} kg</p>
                )}
                {petName && (
                  <p className="text-slate-600 text-sm flex items-center gap-1.5">
                    Pet: {petName}
                    <span className="text-xl leading-none">{petEmoji}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings options */}
        <div className="space-y-3">
          {settingsOptions.map(({ href, title, description, icon: Icon, iconColor, iconBg }) => (
            <Link key={href} href={href}>
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group flex items-center gap-4">
                <div className={`${iconBg} p-3 rounded-xl flex-shrink-0`}>
                  <Icon size={22} className={iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base leading-snug">{title}</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{description}</p>
                </div>
                <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600 flex-shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-center gap-3 text-slate-700 hover:text-purple-600 transition-colors group"
        >
          <LogOut size={22} strokeWidth={2} />
          <span className="text-base font-semibold">Sign Out</span>
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-2">
          Vitalia v1.0 — Your personal AI health companion
        </p>
      </div>
    </AppShell>
  )
}
