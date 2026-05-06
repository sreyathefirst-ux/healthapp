'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pet, PetState } from '@/types'

export function getPetState(avgCompletion: number): PetState {
  if (avgCompletion >= 90) return 'thriving'
  if (avgCompletion >= 70) return 'happy'
  if (avgCompletion >= 50) return 'neutral'
  if (avgCompletion >= 30) return 'sad'
  if (avgCompletion >= 10) return 'sick'
  return 'critical'
}

export function usePetState() {
  const [pet, setPet] = useState<Pet | null>(null)
  const [petState, setPetState] = useState<PetState>('neutral')
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPetData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: petData } = await supabase
        .from('pet')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (petData) {
        setPet(petData)
      }

      // Fetch 7-day rolling completion
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const dateStr = sevenDaysAgo.toISOString().split('T')[0]

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('morning_routine_completion, night_routine_completion')
        .eq('user_id', user.id)
        .gte('date', dateStr)
        .order('date', { ascending: false })
        .limit(7)

      if (logs && logs.length > 0) {
        const avg = logs.reduce((sum, log) => {
          return sum + (log.morning_routine_completion + log.night_routine_completion) / 2
        }, 0) / logs.length
        setAvgCompletion(Math.round(avg))
        setPetState(getPetState(avg))
      }

      setLoading(false)
    }
    fetchPetData()
  }, [])

  return { pet, petState, avgCompletion, loading }
}
