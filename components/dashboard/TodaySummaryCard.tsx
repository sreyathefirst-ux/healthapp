'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, UtensilsCrossed, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoutineItem } from '@/types'

function getRoutineMode(): 'morning' | 'night' {
  const h = new Date().getHours()
  // Night mode: 7pm (19) through 2:59am (2)
  return (h >= 19 || h < 3) ? 'night' : 'morning'
}

export function TodaySummaryCard() {
  const [loading, setLoading] = useState(true)
  const [morningCompletion, setMorningCompletion] = useState(0)
  const [morningTotal, setMorningTotal] = useState(0)
  const [morningChecked, setMorningChecked] = useState(0)
  const [nightCompletion, setNightCompletion] = useState(0)
  const [nightTotal, setNightTotal] = useState(0)
  const [nightChecked, setNightChecked] = useState(0)
  const [mealsLogged, setMealsLogged] = useState(0)
  const [workoutStatus, setWorkoutStatus] = useState<string>('Checking...')
  const [routineMode, setRoutineMode] = useState<'morning' | 'night'>(getRoutineMode)

  const fetchTodaySummary = useCallback(async () => {
    // Recalculate which log date to use: before 3am still belongs to "yesterday"
    const now = new Date()
    const logDate = now.getHours() < 3
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().split('T')[0]
      : now.toISOString().split('T')[0]
    const dayOfWeek = new Date(logDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [logRes, routineRes, planRes] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', logDate).maybeSingle(),
      supabase.from('routine_preferences').select('morning_items, night_items').eq('user_id', user.id).maybeSingle(),
      supabase.from('weekly_plans').select('workout_plan').eq('user_id', user.id).order('week_start_date', { ascending: false }).limit(1).maybeSingle(),
    ])

    const log = logRes.data
    const routine = routineRes.data

    const morningItems = (routine?.morning_items as RoutineItem[]) || []
    setMorningTotal(morningItems.length)
    setMorningChecked(log?.morning_items_checked?.length || 0)
    setMorningCompletion(log?.morning_routine_completion || 0)

    const nightItems = (routine?.night_items as RoutineItem[]) || []
    setNightTotal(nightItems.length)
    setNightChecked(log?.night_items_checked?.length || 0)
    setNightCompletion(log?.night_routine_completion || 0)

    const mealLog = log?.meal_log as Record<string, string> | null
    const todayPrefix = dayOfWeek + '_'
    const loggedMeals = mealLog
      ? Object.entries(mealLog).filter(([k, v]) => k.startsWith(todayPrefix) && (v === 'eaten' || v === 'swapped')).length
      : 0
    setMealsLogged(loggedMeals)

    const workoutPlan = planRes.data?.workout_plan as Record<string, unknown> | null
    if (workoutPlan && (workoutPlan as { days?: Record<string, unknown> }).days) {
      const dayPlan = (workoutPlan as { days: Record<string, Record<string, unknown>> }).days[dayOfWeek]
      if (!dayPlan || dayPlan.type === 'rest') {
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
  }, [])

  useEffect(() => {
    fetchTodaySummary()

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        setRoutineMode(getRoutineMode())
        fetchTodaySummary()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Check for mode transitions (7pm → night, 3am → morning)
    function scheduleNextCheck() {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const s = now.getSeconds()

      let msUntilNext: number
      if (h < 3) {
        // Wait until 3:00am
        msUntilNext = ((3 - h) * 60 - m) * 60000 - s * 1000
      } else if (h < 19) {
        // Wait until 7:00pm
        msUntilNext = ((19 - h) * 60 - m) * 60000 - s * 1000
      } else {
        // Wait until 3:00am next day
        msUntilNext = ((27 - h) * 60 - m) * 60000 - s * 1000
      }

      return setTimeout(() => {
        setRoutineMode(getRoutineMode())
        fetchTodaySummary()
        scheduleNextCheck()
      }, msUntilNext + 1000)
    }

    const timer = scheduleNextCheck()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearTimeout(timer)
    }
  }, [fetchTodaySummary])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border">
        <Skeleton className="h-5 w-1/3 mb-5" />
        <div className="space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  const isMorningActive = routineMode === 'morning'

  const rows = [
    {
      key: 'morning',
      icon: (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isMorningActive ? 'bg-amber-100' : 'bg-slate-100'
        }`}>
          <Sun size={16} className={isMorningActive ? 'text-amber-500' : 'text-slate-400'} />
        </div>
      ),
      label: 'Morning routine',
      value: morningTotal > 0
        ? `${morningChecked} of ${morningTotal} items (${morningCompletion}%)`
        : 'Not set up',
      active: isMorningActive,
    },
    {
      key: 'night',
      icon: (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          !isMorningActive ? 'bg-blue-100' : 'bg-slate-100'
        }`}>
          <Moon size={16} className={!isMorningActive ? 'text-blue-700' : 'text-slate-400'} />
        </div>
      ),
      label: 'Night routine',
      value: nightTotal > 0
        ? `${nightChecked} of ${nightTotal} items (${nightCompletion}%)`
        : 'Not set up',
      active: !isMorningActive,
    },
    {
      key: 'meals',
      icon: (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100">
          <UtensilsCrossed size={16} className="text-emerald-600" />
        </div>
      ),
      label: 'Meals logged',
      value: `${mealsLogged} of 4 today`,
      active: false,
    },
    {
      key: 'workout',
      icon: (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-100">
          <Dumbbell size={16} className="text-purple-600" />
        </div>
      ),
      label: 'Workout',
      value: workoutStatus,
      active: false,
    },
  ]

  return (
    <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border">
      <h3 className="text-xl font-bold text-text-primary mb-5">Today&apos;s Summary</h3>
      <div className="space-y-1">
        {rows.map(({ key, icon, label, value, active }) => (
          <div
            key={key}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              active
                ? key === 'morning'
                  ? 'bg-amber-50 border border-amber-100'
                  : 'bg-blue-50 border border-blue-100'
                : 'hover:bg-bg-2'
            }`}
          >
            {icon}
            <p className={`flex-1 font-medium text-sm ${active ? 'text-text-primary' : 'text-text-primary'}`}>
              {label}
            </p>
            <span className={`text-xs font-medium ${
              active
                ? key === 'morning' ? 'text-amber-700' : 'text-blue-700'
                : 'text-text-secondary'
            }`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
