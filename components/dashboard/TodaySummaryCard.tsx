'use client'

import { useState, useEffect } from 'react'
import { Clock, UtensilsCrossed, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoutineItem } from '@/types'

export function TodaySummaryCard() {
  const [loading, setLoading] = useState(true)
  const [morningCompletion, setMorningCompletion] = useState(0)
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
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('routine_preferences').select('morning_items, night_items').eq('user_id', user.id).maybeSingle(),
        supabase.from('weekly_plans').select('workout_plan').eq('user_id', user.id).order('week_start_date', { ascending: false }).limit(1).maybeSingle(),
      ])

      const log = logRes.data
      const routine = routineRes.data

      setMorningCompletion(log?.morning_routine_completion || 0)

      const morningItems = (routine?.morning_items as RoutineItem[]) || []
      setMorningTotal(morningItems.length)
      setMorningChecked(log?.morning_items_checked?.length || 0)

      const mealLog = log?.meal_log as Record<string, string> | null
      if (mealLog) {
        const loggedMeals = Object.values(mealLog).filter((v) => v === 'eaten' || v === 'swapped').length
        setMealsLogged(loggedMeals)
      }

      const workoutPlan = planRes.data?.workout_plan as Record<string, unknown> | null
      if (workoutPlan && (workoutPlan as { days?: Record<string, unknown> }).days) {
        const dayPlan = (workoutPlan as { days: Record<string, Record<string, unknown>> }).days[dayOfWeek]
        if (!dayPlan) {
          setWorkoutStatus('Rest day 🧘')
        } else if (dayPlan.type === 'rest') {
          setWorkoutStatus('Rest day 🧘')
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
      <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border">
        <Skeleton className="h-5 w-1/3 mb-5" />
        <div className="space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  const rows = [
    {
      icon: <Clock size={18} className="text-orange-500 flex-shrink-0" />,
      label: 'Morning routine',
      value: `${morningChecked} of ${morningTotal} items (${morningCompletion}%)`,
    },
    {
      icon: <UtensilsCrossed size={18} className="text-vitalia-muted flex-shrink-0" />,
      label: 'Meals logged',
      value: `${mealsLogged} of 4 today`,
    },
    {
      icon: <Dumbbell size={18} className="text-orange-500 flex-shrink-0" />,
      label: 'Workout',
      value: workoutStatus,
    },
  ]

  return (
    <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border">
      <h3 className="text-xl font-bold text-text-primary mb-5">Today&apos;s Summary</h3>
      <div className="space-y-1">
        {rows.map(({ icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-2 transition-colors"
          >
            {icon}
            <p className="flex-1 font-medium text-text-primary text-sm">{label}</p>
            <span className="text-xs text-text-secondary font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
