'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeeklyPlan } from '@/types'

export function useWeeklyPlan(weekStartDate?: string) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlan() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      let query = supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })
        .limit(1)

      if (weekStartDate) {
        query = supabase
          .from('weekly_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStartDate)
          .limit(1)
      }

      const { data } = await query.maybeSingle()
      setPlan(data)
      setLoading(false)
    }
    fetchPlan()
  }, [weekStartDate])

  return { plan, loading, setPlan }
}

export function useAllWeeklyPlans() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlans() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })

      setPlans(data || [])
      setLoading(false)
    }
    fetchPlans()
  }, [])

  return { plans, loading }
}
