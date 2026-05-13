'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PetWidget } from '@/components/dashboard/PetWidget'
import { TodaySummaryCard } from '@/components/dashboard/TodaySummaryCard'
import { QuickLinks } from '@/components/dashboard/QuickLinks'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('name, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && !profile.onboarding_complete) {
        router.push('/onboarding')
        return
      }

      setUserName(profile?.name || '')

      const today = new Date().toISOString().split('T')[0]
      await supabase.from('daily_logs').upsert(
        { user_id: user.id, date: today, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )

      setLoading(false)
    }
    init()
  }, [router])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="pb-2">
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting()}{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-text-secondary text-sm mt-1">Here&apos;s your health overview for today.</p>
        </div>

        <PetWidget />
        <TodaySummaryCard />
        <QuickLinks />
      </div>
    </AppShell>
  )
}
