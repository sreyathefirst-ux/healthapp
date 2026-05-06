'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoutineItem } from '@/types'

export function TodaySummaryCard() {
  const [loading, setLoading] = useState(true)
  const [morningCompletion, setMorningCompletion] = useState(0)
  const [nightCompletion, setNightCompletion] = useState(0)
  const [morningTotal, setMorningTotal] = useState(0)
  const [morningChecked, setMorningChecked] = useState(0)
  const [mealsLogged, setMealsLogged] = useState(0)
  const [workoutStatus, setWorkoutStatus] = useState<string>('Checking...')

  useEffect(() => {
    async function fetchTodaySummary() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

      const [logRes, routineRes, planRes] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
        supabase.from('routine_preferences').select('morning_items, night_items').eq('user_id', user.id).single(),
        supabase.from('weekly_plans').select('workout_plan').eq('user_id', user.id).order('week_start_date', { ascending: false }).limit(1).single(),
      ])

      const log = logRes.data
      const routine = routineRes.data

      setMorningCompletion(log?.morning_routine_completion || 0)
      setNightCompletion(log?.night_routine_completion || 0)

      const morningItems = (routine?.morning_items as RoutineItem[]) || []
      setMorningTotal(morningItems.length)
      setMorningChecked(log?.morning_items_checked?.length || 0)

      // Count meals logged
      const mealLog = log?.meal_log as Record<string, string> | null
      if (mealLog) {
        const loggedMeals = Object.values(mealLog).filter((v) => v === 'eaten' || v === 'swapped').length
        setMealsLogged(loggedMeals)
      }

      // Workout status
      const workoutPlan = planRes.data?.workout_plan as Record<string, unknown> | null
      if (workoutPlan && (workoutPlan as { days?: Record<string, unknown> }).days) {
        const dayPlan = (workoutPlan as { days: Record<string, Record<string, unknown>> }).days[dayOfWeek]
        if (!dayPlan) {
          setWorkoutStatus('Rest day 🧘')
        } else if (dayPlan.type === 'rest') {
          setWorkoutStatus(`Rest day 🧘`)
        } else if (log?.workout_log && (log.workout_log as Record<string, string>)[dayOfWeek] === 'completed') {
          setWorkoutStatus('Done ✅')
        } else {
          setWorkoutStatus(`Scheduled: ${dayPlan.workout_name || 'Workout'}`)
        }
      } else {
        setWorkoutStatus('No plan yet')
      }

      setLoading(false)
    }
    fetchTodaySummary()
  }, [])

  if (loading) {
    return (
      <Card>
        <Skeleton className="h-5 w-1/3 mb-4" />
        <Skeleton lines={3} />
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="font-bold text-text-primary mb-4">Today&apos;s Summary</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🌅</span>
            <span className="text-sm text-text-secondary">Morning routine</span>
          </div>
          <span className="text-sm font-medium text-text-primary">
            {morningChecked} of {morningTotal} items ({morningCompletion}%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🍽️</span>
            <span className="text-sm text-text-secondary">Meals logged</span>
          </div>
          <span className="text-sm font-medium text-text-primary">{mealsLogged} of 4 today</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>💪</span>
            <span className="text-sm text-text-secondary">Workout</span>
          </div>
          <span className="text-sm font-medium text-text-primary">{workoutStatus}</span>
        </div>
      </div>
    </Card>
  )
}
