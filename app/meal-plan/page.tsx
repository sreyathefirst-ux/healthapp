'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { MealCard } from '@/components/meal-plan/MealCard'
import { SwapModal } from '@/components/meal-plan/SwapModal'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Meal, MealPlan, MealLogStatus, DayMeals } from '@/types'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function normalizePlan(raw: unknown): MealPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (!p.days || typeof p.days !== 'object') {
    console.error('[meal-plan] plan has no days object:', JSON.stringify(p).slice(0, 300))
    return null
  }
  const days = p.days as Record<string, unknown>
  const normalizedDays: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(days)) {
    normalizedDays[key.toLowerCase()] = value
  }
  console.log('[meal-plan] normalized day keys:', Object.keys(normalizedDays))
  return { ...p, days: normalizedDays } as MealPlan
}

function getWeekStartDate(offset = 0): string {
  const now = new Date()
  now.setDate(now.getDate() + offset * 7)
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export default function MealPlanPage() {
  const { toast } = useToast()
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedDay, setSelectedDay] = useState<typeof DAYS[number]>('monday')
  const [swapModal, setSwapModal] = useState<{ meal: Meal; mealType: string; day: string } | null>(null)
  const [mealLog, setMealLog] = useState<Record<string, MealLogStatus>>({})

  useEffect(() => {
    const today = new Date().getDay()
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayName = days[today] as typeof DAYS[number]
    if (DAYS.includes(todayName)) setSelectedDay(todayName)
  }, [])

  useEffect(() => {
    async function fetchPlan() {
      setLoading(true)
      setFetchError(false)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const weekStart = getWeekStartDate(weekOffset)
        const { data, error } = await supabase
          .from('weekly_plans')
          .select('meal_plan')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart)
          .maybeSingle()

        // maybeSingle returns null data (not an error) when no row found
        if (error) throw error
        const raw = data?.meal_plan
        console.log('[meal-plan PAGE] weekStart queried:', weekStart)
        console.log('[meal-plan PAGE] DB row found:', data !== null, '| meal_plan null:', raw == null)
        if (raw) {
          console.log('[meal-plan PAGE] meal_plan top-level keys:', Object.keys(raw as object))
          const days = (raw as Record<string, unknown>).days
          if (days && typeof days === 'object') {
            console.log('[meal-plan PAGE] days keys:', Object.keys(days as object))
          } else {
            console.error('[meal-plan PAGE] meal_plan.days is missing or not an object:', days)
          }
        }
        const normalizedPlan = raw ? normalizePlan(raw) : null
        if (raw && !normalizedPlan) {
          console.error('[meal-plan PAGE] normalizePlan returned null — raw:', JSON.stringify(raw).slice(0, 500))
        }
        if (normalizedPlan) {
          console.log('[meal-plan PAGE] normalized days:', Object.keys(normalizedPlan.days))
        }
        setPlan(normalizedPlan)

        const today = new Date().toISOString().split('T')[0]
        const { data: log } = await supabase
          .from('daily_logs')
          .select('meal_log')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()

        setMealLog((log?.meal_log as Record<string, MealLogStatus>) ?? {})
      } catch {
        setFetchError(true)
        setPlan(null)
      } finally {
        setLoading(false)
      }
    }
    fetchPlan()
  }, [weekOffset])

  async function handleGenerate(requireConfirm = false) {
    if (requireConfirm && !confirm("Regenerate this week's meal plan? This will replace your current plan.")) return
    setGenerating(true)
    try {
      const res = await fetch('/api/plans/meal', { method: 'POST' })
      const data = await res.json()
      console.log('[meal-plan PAGE] generate response:', { success: data.success, error: data.error, hasPlan: !!data.plan })
      if (data.success && data.plan) {
        console.log('[meal-plan PAGE] plan days from API:', data.plan.days ? Object.keys(data.plan.days) : 'none')
        const normalized = normalizePlan(data.plan)
        console.log('[meal-plan PAGE] normalized days:', normalized?.days ? Object.keys(normalized.days) : 'null')
        setPlan(normalized)
        if (!normalized) {
          toast('Plan generated but structure was invalid. Please try again.', 'error')
        } else {
          toast('Meal plan generated! 🥗', 'success')
        }
      } else {
        toast(data.error || 'Failed to generate plan', 'error')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleLogMeal(mealType: string, _day: string, status: MealLogStatus) {
    const key = `${selectedDay}_${mealType}`
    const newLog = { ...mealLog, [key]: status }
    setMealLog(newLog)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: today,
        meal_log: newLog,
        last_seen_at: new Date().toISOString(),
      })
    } catch {
      toast('Failed to save log', 'error')
    }
  }

  async function handleSwapConfirm(newMeal: Meal) {
    if (!swapModal || !plan) return

    const updatedPlan = {
      ...plan,
      days: {
        ...plan.days,
        [swapModal.day]: {
          ...(plan.days[swapModal.day as keyof typeof plan.days] ?? {}),
          [swapModal.mealType]: newMeal,
        },
      },
    }
    setPlan(updatedPlan)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const weekStart = getWeekStartDate(weekOffset)
      await supabase
        .from('weekly_plans')
        .update({ meal_plan: updatedPlan })
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)

      // Image generation disabled — MealCard shows emoji placeholder when image_url is null
    } catch {
      toast('Failed to save swap', 'error')
    }

    setSwapModal(null)
    toast('Meal swapped! 🔄', 'success')
  }

  const weekStart = getWeekStartDate(weekOffset)
  const dayMeals = plan?.days?.[selectedDay] as DayMeals | undefined

  // Full-page empty state for first-time users (current week, no plan)
  if (!loading && !plan && weekOffset === 0 && !fetchError) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <span className="text-7xl mb-6">🍽️</span>
          <h2 className="text-2xl font-bold text-text-primary mb-3">No meal plan yet</h2>
          <p className="text-text-secondary mb-8 max-w-sm">
            Vitalia will build a personalized 7-day meal plan based on your health profile, bloodwork, and food preferences.
          </p>
          <Button onClick={() => handleGenerate(false)} loading={generating} size="lg">
            Generate my first plan ✨
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Meal Plan</h1>
          {plan && (
            <Button variant="secondary" size="sm" onClick={() => handleGenerate(true)} loading={generating}>
              <RefreshCw size={14} />
              Regenerate
            </Button>
          )}
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-4">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="p-2 rounded-xl hover:bg-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <p className="font-semibold text-text-primary">
              Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
            disabled={weekOffset === 0}
            className="p-2 rounded-xl hover:bg-white transition-colors"
          >
            <ChevronRight size={20} className={weekOffset === 0 ? 'opacity-30' : ''} />
          </button>
        </div>

        {/* Day tabs — only show when plan exists */}
        {plan && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedDay === day
                    ? 'bg-accent-primary text-text-primary'
                    : 'bg-white text-text-secondary hover:bg-accent-primary/10'
                }`}
              >
                {DAY_LABELS[i]}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">⚠️</span>
            <h3 className="font-semibold text-text-primary mb-2">Failed to load meal plan</h3>
            <p className="text-text-secondary mb-6 text-sm">Check your connection and try again.</p>
            <Button variant="secondary" onClick={() => setWeekOffset((o) => o)}>Retry</Button>
          </div>
        ) : !plan && weekOffset !== 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">📅</span>
            <p className="text-text-secondary">No meal plan for this week.</p>
          </div>
        ) : !dayMeals ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-3">🍽️</span>
            <p className="text-text-secondary text-sm mb-4">No meals for this day in your plan.</p>
            <Button variant="secondary" size="sm" onClick={() => handleGenerate(true)} loading={generating}>
              Regenerate plan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
              const meal = dayMeals[mealType]
              if (!meal) return null
              const logKey = `${selectedDay}_${mealType}`
              return (
                <MealCard
                  key={mealType}
                  meal={meal}
                  mealType={mealType}
                  day={selectedDay}
                  logStatus={mealLog[logKey]}
                  onSwap={(m, mt, d) => setSwapModal({ meal: m, mealType: mt, day: d })}
                  onLog={handleLogMeal}
                />
              )
            })}
          </div>
        )}
      </div>

      {swapModal && (
        <SwapModal
          meal={swapModal.meal}
          mealType={swapModal.mealType}
          day={swapModal.day}
          onClose={() => setSwapModal(null)}
          onConfirm={handleSwapConfirm}
        />
      )}
    </AppShell>
  )
}
