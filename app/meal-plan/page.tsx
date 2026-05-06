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
  const [regenerating, setRegenerating] = useState(false)
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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const weekStart = getWeekStartDate(weekOffset)
      const { data } = await supabase
        .from('weekly_plans')
        .select('meal_plan')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
        .single()

      setPlan(data?.meal_plan as MealPlan || null)

      // Fetch today's meal log
      const today = new Date().toISOString().split('T')[0]
      const { data: log } = await supabase
        .from('daily_logs')
        .select('meal_log')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()

      setMealLog((log?.meal_log as Record<string, MealLogStatus>) || {})
      setLoading(false)
    }
    fetchPlan()
  }, [weekOffset])

  async function handleRegenerate() {
    if (!confirm('Regenerate this week\'s meal plan? This will replace your current plan.')) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/plans/meal', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPlan(data.plan)
        toast('Meal plan regenerated! 🥗', 'success')
      } else {
        toast('Failed to regenerate plan', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleLogMeal(mealType: string, _day: string, status: MealLogStatus) {
    const key = `${selectedDay}_${mealType}`
    const newLog = { ...mealLog, [key]: status }
    setMealLog(newLog)

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
  }

  async function handleSwapConfirm(newMeal: Meal) {
    if (!swapModal || !plan) return

    const updatedPlan = {
      ...plan,
      days: {
        ...plan.days,
        [swapModal.day]: {
          ...plan.days[swapModal.day as keyof typeof plan.days],
          [swapModal.mealType]: newMeal,
        },
      },
    }
    setPlan(updatedPlan)

    // Save to Supabase
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = getWeekStartDate(weekOffset)
    await supabase
      .from('weekly_plans')
      .update({ meal_plan: updatedPlan })
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)

    // Trigger image generation
    if (newMeal.image_prompt) {
      fetch('/api/images/meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId: newMeal.id, mealName: newMeal.name, imagePrompt: newMeal.image_prompt }),
      }).catch(() => {})
    }

    setSwapModal(null)
    toast('Meal swapped! 🔄', 'success')
  }

  const weekStart = getWeekStartDate(weekOffset)
  const dayMeals = plan?.days[selectedDay] as DayMeals | undefined

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Meal Plan</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerate}
            loading={regenerating}
          >
            <RefreshCw size={14} />
            Regenerate
          </Button>
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
          <button onClick={() => setWeekOffset((o) => Math.min(0, o + 1))} className="p-2 rounded-xl hover:bg-white transition-colors" disabled={weekOffset === 0}>
            <ChevronRight size={20} className={weekOffset === 0 ? 'opacity-30' : ''} />
          </button>
        </div>

        {/* Day tabs */}
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

        {/* Meals */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : !plan ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🍽️</span>
            <h3 className="font-semibold text-text-primary mb-2">No meal plan yet</h3>
            <p className="text-text-secondary mb-6">Generate your personalized weekly meal plan</p>
            <Button onClick={handleRegenerate} loading={regenerating}>Generate Meal Plan</Button>
          </div>
        ) : !dayMeals ? (
          <div className="text-center py-8 text-text-secondary">No meals for this day</div>
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
