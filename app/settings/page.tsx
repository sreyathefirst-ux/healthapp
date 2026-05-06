'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronRight, LogOut } from 'lucide-react'

const settingsLinks = [
  { href: '/settings/profile', emoji: '👤', label: 'Profile & Health Info', desc: 'Edit personal details, conditions, preferences' },
  { href: '/settings/routine', emoji: '✅', label: 'Routine Editor', desc: 'Customize morning & night routine items' },
  { href: '/settings/notifications', emoji: '🔔', label: 'Notifications', desc: 'Manage push notification preferences' },
  { href: '/grocery-list', emoji: '🛒', label: 'Grocery List', desc: 'View this week\'s shopping list' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [petName, setPetName] = useState('')
  const [weight, setWeight] = useState<number | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [userRes, petRes] = await Promise.all([
        supabase.from('users').select('name, weight_kg').eq('id', user.id).single(),
        supabase.from('pet').select('pet_name').eq('user_id', user.id).single(),
      ])

      setUserName(userRes.data?.name || '')
      setWeight(userRes.data?.weight_kg || null)
      setPetName(petRes.data?.pet_name || '')
    }
    fetchProfile()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

        {/* Profile summary */}
        <Card className="bg-gradient-to-br from-accent-primary/10 to-accent-sage/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent-primary/30 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <h2 className="font-bold text-text-primary text-lg">{userName || 'Your Profile'}</h2>
              {weight && <p className="text-text-secondary text-sm">{weight} kg</p>}
              {petName && <p className="text-text-secondary text-sm">Pet: {petName} 🐾</p>}
            </div>
          </div>
        </Card>

        {/* Settings links */}
        <div className="space-y-3">
          {settingsLinks.map(({ href, emoji, label, desc }) => (
            <Link key={href} href={href}>
              <Card className="flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer">
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary">{label}</h3>
                  <p className="text-text-secondary text-sm">{desc}</p>
                </div>
                <ChevronRight size={18} className="text-text-secondary flex-shrink-0" />
              </Card>
            </Link>
          ))}
        </div>

        <Button variant="ghost" onClick={handleSignOut} className="w-full text-red-500 hover:bg-red-50">
          <LogOut size={16} />
          Sign Out
        </Button>

        <p className="text-center text-xs text-text-secondary">Vitalia v1.0 — Your personal AI health companion</p>
      </div>
    </AppShell>
  )
}
