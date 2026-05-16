'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { MealCard } from '@/components/meal-plan/MealCard'
import { SwapModal } from '@/components/meal-plan/SwapModal'
import { RecipeModal } from '@/components/meal-plan/RecipeModal'
import { ReplaceMealModal } from '@/components/meal-plan/ReplaceMealModal'
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

function MacroRing({
  value, max, color, label, unit, size = 88,
}: {
  value: number; max: number; color: string; label: string; unit: string; size?: number
}) {
  const r = size * 0.39
  const sw = size * 0.09
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(value / max, 1) * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EBEBF0" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 1} textAnchor="middle" dominantBaseline="auto"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: size * 0.21, fill: '#1A1A2E' }}>
          {value}
        </text>
        <text x={cx} y={cx + size * 0.17} textAnchor="middle" dominantBaseline="auto"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: size * 0.135, fill: '#9B9BAA' }}>
          {unit}
        </text>
      </svg>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#6B6B8A', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}

function getWeekStartDate(offset = 0): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offset * 7)
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
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
  const [replaceModal, setReplaceModal] = useState<{ meal: Meal; mealType: string; day: string } | null>(null)
  const [recipeModal, setRecipeModal] = useState<{ meal: Meal; mealType: string } | null>(null)
  const [mealLog, setMealLog] = useState<Record<string, MealLogStatus>>({})
  // Track which days have already had image generation triggered to avoid double-requests
  const imageGenTriggered = useRef<Set<string>>(new Set())

  const generateImagesForDay = useCallback(async (currentPlan: MealPlan, day: string, ws: string) => {
    const cacheKey = `${ws}_${day}`
    if (imageGenTriggered.current.has(cacheKey)) return
    imageGenTriggered.current.add(cacheKey)

    const dayMealsData = currentPlan.days?.[day as keyof typeof currentPlan.days] as DayMeals | undefined
    if (!dayMealsData) return

    const mealsNeedingImages = (['breakfast', 'lunch', 'dinner', 'snack'] as const)
      .map((mt) => ({ meal: dayMealsData[mt], mealType: mt }))
      .filter(({ meal }) => meal && !meal.image_url)

    if (mealsNeedingImages.length === 0) return
    console.log('[meal-plan] generating images for', mealsNeedingImages.length, 'meals on', day)

    await Promise.allSettled(
      mealsNeedingImages.map(async ({ meal }) => {
        try {
          const res = await fetch('/api/images/meal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mealId: meal!.id,
              mealName: meal!.name,
              imagePrompt: meal!.image_prompt,
              weekStartDate: ws,
            }),
          })
          const data = await res.json()
          if (data.image_url) {
            setPlan((prev) => {
              if (!prev) return prev
              const updatedDay = { ...(prev.days[day as keyof typeof prev.days] as DayMeals) }
              for (const mt of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
                if (updatedDay[mt]?.id === meal!.id) {
                  updatedDay[mt] = { ...updatedDay[mt]!, image_url: data.image_url }
                }
              }
              return { ...prev, days: { ...prev.days, [day]: updatedDay } }
            })
            console.log('[meal-plan] image loaded for:', meal!.name)
          } else {
            console.warn('[meal-plan] no image_url returned for:', meal!.name, '—', data.error)
          }
        } catch (e) {
          console.error('[meal-plan] image gen fetch failed for', meal!.name, ':', e)
        }
      })
    )
  }, [])

  useEffect(() => {
    const today = new Date().getDay()
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayName = days[today] as typeof DAYS[number]
    if (DAYS.includes(todayName)) setSelectedDay(todayName)
  }, [])

  // Trigger image gen when user switches days (plan is already loaded)
  useEffect(() => {
    if (plan && weekOffset === 0) {
      generateImagesForDay(plan, selectedDay, getWeekStartDate(0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay])

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
          // Log image_url status for today's meals
          const todayMeals = normalizedPlan.days[selectedDay as keyof typeof normalizedPlan.days] as unknown as Record<string, { name: string; image_url: string | null }> | undefined
          if (todayMeals) {
            for (const [mt, meal] of Object.entries(todayMeals)) {
              console.log(`[meal-plan PAGE] ${mt}: "${meal?.name}" | image_url: ${meal?.image_url ? meal.image_url.slice(0, 70) : 'NULL'}`)
            }
          }
        }
        setPlan(normalizedPlan)

        // Trigger background image generation for the currently selected day
        if (normalizedPlan) {
          generateImagesForDay(normalizedPlan, selectedDay, weekStart)
        }

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

  async function handleGenerate() {
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
          // Clear image gen tracking so fresh images are generated for new plan
          imageGenTriggered.current = new Set()
          generateImagesForDay(normalized, selectedDay, getWeekStartDate(weekOffset))
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
      }, { onConflict: 'user_id,date' })
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

      // Trigger image generation for the swapped meal
      const ws = getWeekStartDate(weekOffset)
      imageGenTriggered.current.delete(`${ws}_${swapModal.day}`)
      generateImagesForDay(updatedPlan, swapModal.day, ws)
    } catch {
      toast('Failed to save swap', 'error')
    }

    setSwapModal(null)
    toast('Meal swapped! 🔄', 'success')
  }

  async function handleReplaceMeal(newMeal: Meal) {
    if (!replaceModal || !plan) return
    const updatedPlan = {
      ...plan,
      days: {
        ...plan.days,
        [replaceModal.day]: {
          ...(plan.days[replaceModal.day as keyof typeof plan.days] ?? {}),
          [replaceModal.mealType]: newMeal,
        },
      },
    }
    setPlan(updatedPlan)
    setReplaceModal(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const weekStart = getWeekStartDate(weekOffset)
      await supabase.from('weekly_plans').update({ meal_plan: updatedPlan }).eq('user_id', user.id).eq('week_start_date', weekStart)
      // Trigger image generation for the replaced meal
      const ws = getWeekStartDate(weekOffset)
      imageGenTriggered.current.delete(`${ws}_${replaceModal.day}`)
      generateImagesForDay(updatedPlan, replaceModal.day, ws)
      toast('Meal replaced! 🍽️', 'success')
    } catch {
      toast('Failed to save replacement', 'error')
    }
  }

  const weekStart = getWeekStartDate(weekOffset)
  const dayMeals = plan?.days?.[selectedDay] as DayMeals | undefined

  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
  const totalCalories = dayMeals ? MEAL_TYPES.reduce((s, mt) => s + (dayMeals[mt]?.calories ?? 0), 0) : 0
  const totalProtein  = dayMeals ? MEAL_TYPES.reduce((s, mt) => s + (dayMeals[mt]?.protein_g ?? 0), 0) : 0
  const totalCarbs    = dayMeals ? MEAL_TYPES.reduce((s, mt) => s + (dayMeals[mt]?.carbs_g ?? 0), 0) : 0
  const totalFat      = dayMeals ? MEAL_TYPES.reduce((s, mt) => s + (dayMeals[mt]?.fat_g ?? 0), 0) : 0

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
          <Button onClick={() => handleGenerate()} loading={generating} size="lg">
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
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-lavender text-lavender hover:bg-lavender/10 transition-colors font-medium text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
              Regenerate
            </button>
          )}
        </div>

        {/* Daily nutrition summary */}
        {dayMeals && !loading && (
          <div className="bg-white rounded-2xl p-6 shadow-card border border-vitalia-border">
            <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#1A1A2E', marginBottom: 20 }}>
              Nutrition Summary
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start' }}>
              <MacroRing value={totalCalories} max={2000} color="#10b981" label="Calories" unit="kcal" />
              <MacroRing value={Math.round(totalProtein)} max={50} color="#60a5fa" label="Protein" unit="g" />
              <MacroRing value={Math.round(totalCarbs)} max={250} color="#f97316" label="Carbs" unit="g" />
              <MacroRing value={Math.round(totalFat)} max={65} color="#a855f7" label="Fat" unit="g" />
            </div>
          </div>
        )}

        {/* Week selector */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-2 rounded-lg hover:bg-bg-2 transition-colors text-text-secondary"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 text-center">
            <p className="font-bold text-text-primary">
              Week of {new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
            disabled={weekOffset === 0}
            className="p-2 rounded-lg hover:bg-bg-2 transition-colors text-text-secondary disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Day tabs — only show when plan exists */}
        {plan && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedDay === day
                    ? 'bg-gradient-to-r from-teal to-accent-sage text-white shadow-sm'
                    : 'bg-white text-text-secondary hover:bg-slate-50 border border-slate-200'
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
            <Button variant="secondary" size="sm" onClick={() => handleGenerate()} loading={generating}>
              Regenerate plan
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
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
                  onReplace={(m, mt, d) => setReplaceModal({ meal: m, mealType: mt, day: d })}
                  onLog={handleLogMeal}
                  onViewRecipe={(m, mt) => setRecipeModal({ meal: m, mealType: mt })}
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

      {recipeModal && (
        <RecipeModal
          meal={recipeModal.meal}
          mealType={recipeModal.mealType}
          onClose={() => setRecipeModal(null)}
        />
      )}

      {replaceModal && (
        <ReplaceMealModal
          mealType={replaceModal.mealType}
          onClose={() => setReplaceModal(null)}
          onConfirm={handleReplaceMeal}
        />
      )}
    </AppShell>
  )
}
