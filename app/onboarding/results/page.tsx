'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { MealPlan, WorkoutPlan, RoutineItem } from '@/types'
import { ChevronRight, ChevronLeft, ArrowRight, Stethoscope, Salad, Dumbbell, Sun, Moon, Sprout, Coffee, Utensils, Apple, Leaf, Sparkles, ClipboardList } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

interface PlanData {
  mealPlan: MealPlan | null
  workoutPlan: WorkoutPlan | null
  healthReport: string | null
  morningItems: RoutineItem[]
  nightItems: RoutineItem[]
}

export default function OnboardingResultsPage() {
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return null }

    const weekStart = getWeekStartDate()
    const [plansRes, routineRes] = await Promise.all([
      supabase.from('weekly_plans').select('meal_plan,workout_plan,health_report')
        .eq('user_id', user.id).eq('week_start_date', weekStart).maybeSingle(),
      supabase.from('routine_preferences').select('morning_items,night_items')
        .eq('user_id', user.id).maybeSingle(),
    ])

    return {
      mealPlan: (plansRes.data?.meal_plan as MealPlan) ?? null,
      workoutPlan: (plansRes.data?.workout_plan as WorkoutPlan) ?? null,
      healthReport: plansRes.data?.health_report ?? null,
      morningItems: (routineRes.data?.morning_items as RoutineItem[]) ?? [],
      nightItems: (routineRes.data?.night_items as RoutineItem[]) ?? [],
    }
  }

  useEffect(() => {
    loadData().then((result) => {
      if (result) setData(result)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-poll when data is missing, up to 5 times with 4s intervals
  useEffect(() => {
    const hasAllData = data?.mealPlan && data?.workoutPlan && data?.healthReport
    if (!loading && !hasAllData && pollCount < 5) {
      const timer = setTimeout(async () => {
        const result = await loadData()
        if (result) setData(result)
        setPollCount((c) => c + 1)
      }, 4000)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, pollCount])

  async function handleRefresh() {
    setRefreshing(true)
    const result = await loadData()
    if (result) setData(result)
    setPollCount(0)
    setRefreshing(false)
  }

  function go(next: number) {
    setDirection(next > slide ? 1 : -1)
    setSlide(next)
  }

  const slides: { label: string; Icon: LucideIcon }[] = [
    { label: 'Your Health Report', Icon: Stethoscope },
    { label: 'Meal Plan', Icon: Salad },
    { label: 'Workout Plan', Icon: Dumbbell },
    { label: 'Daily Routine', Icon: Sun },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <Sprout size={44} className="animate-pulse text-green" />
        <p className="text-text-secondary text-sm">Loading your personalized plan...</p>
      </div>
    )
  }

  const isPolling = !loading && pollCount < 5 && !(data?.mealPlan && data?.workoutPlan && data?.healthReport)

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-vitalia-border px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
                <Sprout size={15} className="text-white" />
              </span>
              <span className="font-semibold text-text-primary">Vitalia</span>
            </div>
            <span className="text-sm text-text-secondary">{slide + 1} of {slides.length}</span>
          </div>
          {/* Progress dots */}
          <div className="flex gap-2 justify-center">
            {slides.map((s, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`transition-all rounded-full ${
                  i === slide ? 'w-6 h-2 bg-accent-primary' : 'w-2 h-2 hover:opacity-70'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-xs font-medium text-green-deep mt-2 inline-flex items-center justify-center gap-1.5 w-full">
            {(() => { const I = slides[slide].Icon; return <I size={13} /> })()} {slides[slide].label}
          </p>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={slide}
            custom={direction}
            initial={{ x: direction * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -40, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
              {slide === 0 && <HealthReportSlide report={data?.healthReport ?? null} polling={isPolling} onRefresh={handleRefresh} refreshing={refreshing} />}
              {slide === 1 && <MealPlanSlide plan={data?.mealPlan ?? null} polling={isPolling} onRefresh={handleRefresh} refreshing={refreshing} />}
              {slide === 2 && <WorkoutPlanSlide plan={data?.workoutPlan ?? null} polling={isPolling} onRefresh={handleRefresh} refreshing={refreshing} />}
              {slide === 3 && <RoutineSlide morningItems={data?.morningItems ?? []} nightItems={data?.nightItems ?? []} polling={isPolling} onRefresh={handleRefresh} refreshing={refreshing} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation bar */}
      <div className="bg-white border-t border-vitalia-border px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => go(slide - 1)}
            disabled={slide === 0}
            className="p-3 rounded-xl border border-vitalia-border disabled:opacity-30 hover:bg-bg transition-colors"
          >
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>

          {slide < slides.length - 1 ? (
            <button
              onClick={() => go(slide + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-accent-primary text-white font-semibold rounded-btn hover:bg-accent-primary/90 transition-colors"
            >
              Next: {slides[slide + 1].label}
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-text-primary text-white font-semibold rounded-btn hover:opacity-90 transition-opacity"
            >
              Go to my dashboard
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface SlideProps {
  polling: boolean
  onRefresh: () => void
  refreshing: boolean
}

function PendingSlide({ Icon, label, polling, onRefresh, refreshing }: { Icon: LucideIcon; label: string } & SlideProps) {
  return (
    <div className="text-center py-12 text-text-secondary">
      <Icon size={36} className="mx-auto mb-3 text-vitalia-muted" />
      {polling ? (
        <p className="animate-pulse">{label} is being generated — checking automatically...</p>
      ) : (
        <>
          <p className="mb-4">{label} is still being prepared.</p>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-sm font-medium text-accent-primary underline disabled:opacity-50"
          >
            {refreshing ? 'Checking...' : 'Check again'}
          </button>
        </>
      )}
    </div>
  )
}

function HealthReportSlide({ report, polling, onRefresh, refreshing }: { report: string | null } & SlideProps) {
  if (!report) {
    return <PendingSlide Icon={ClipboardList} label="Health report" polling={polling} onRefresh={onRefresh} refreshing={refreshing} />
  }

  return (
    <div className="prose prose-sm max-w-none">
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-sage/10 rounded-card p-4 mb-6 flex items-start gap-3">
        <Stethoscope size={22} className="flex-shrink-0 text-green-deep" />
        <div>
          <p className="font-semibold text-text-primary text-sm mb-0.5">Your Personal Care Team</p>
          <p className="text-text-secondary text-xs">Functional medicine doctor · Endocrinologist · Clinical nutritionist · Personal trainer</p>
        </div>
      </div>
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-text-primary mt-6 mb-2 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm text-text-secondary leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1 mb-3 ml-4">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-sm text-text-secondary flex items-start gap-2">
              <span className="text-accent-primary mt-0.5 flex-shrink-0">•</span>
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-text-primary">{children}</strong>
          ),
        }}
      >
        {report}
      </ReactMarkdown>
    </div>
  )
}

function MealPlanSlide({ plan, polling, onRefresh, refreshing }: { plan: MealPlan | null } & SlideProps) {
  if (!plan) {
    return <PendingSlide Icon={Salad} label="Meal plan" polling={polling} onRefresh={onRefresh} refreshing={refreshing} />
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-sage/10 rounded-card p-4 mb-2">
        <p className="font-semibold text-text-primary text-sm">Your 7-Day Meal Plan</p>
        <p className="text-text-secondary text-xs mt-0.5">Personalized to your health profile, bloodwork, and food preferences</p>
      </div>

      {DAYS.map((day) => {
        const meals = plan.days?.[day]
        if (!meals) return null
        const totalCals = [meals.breakfast, meals.lunch, meals.dinner, meals.snack]
          .reduce((sum, m) => sum + (m?.calories ?? 0), 0)

        return (
          <div key={day} className="bg-white rounded-card shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-text-primary text-sm">{DAY_LABELS[day]}day</span>
              <span className="text-xs text-text-secondary bg-bg px-2 py-0.5 rounded-full">
                ~{totalCals} cal
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'breakfast', Icon: Coffee, meal: meals.breakfast },
                { type: 'lunch', Icon: Salad, meal: meals.lunch },
                { type: 'dinner', Icon: Utensils, meal: meals.dinner },
                { type: 'snack', Icon: Apple, meal: meals.snack },
              ].map(({ type, Icon, meal }) => meal ? (
                <div key={type} className="bg-bg rounded-xl p-2.5">
                  <p className="text-xs text-text-secondary capitalize mb-0.5 inline-flex items-center gap-1"><Icon size={12} /> {type}</p>
                  <p className="text-xs font-medium text-text-primary leading-tight line-clamp-2">{meal.name}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{meal.calories} cal · {meal.protein_g}g protein</p>
                </div>
              ) : null)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkoutPlanSlide({ plan, polling, onRefresh, refreshing }: { plan: WorkoutPlan | null } & SlideProps) {
  if (!plan) {
    return <PendingSlide Icon={Dumbbell} label="Workout plan" polling={polling} onRefresh={onRefresh} refreshing={refreshing} />
  }

  const workoutDays = DAYS.filter(d => plan.days?.[d]?.type === 'workout').length
  const restDays = 7 - workoutDays

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-accent-coral/10 to-accent-primary/10 rounded-card p-4 mb-2">
        <p className="font-semibold text-text-primary text-sm">Your 7-Day Workout Plan</p>
        <p className="text-text-secondary text-xs mt-0.5">
          {workoutDays} workout days · {restDays} rest/recovery days — tailored to your goals and fitness level
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map((day) => {
          const w = plan.days?.[day]
          if (!w) return null
          const isRest = w.type === 'rest'

          return (
            <div
              key={day}
              className={`rounded-card p-4 flex items-center gap-4 ${
                isRest ? 'bg-bg' : 'bg-white shadow-card'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isRest ? 'bg-bg' : 'bg-accent-primary/15'
              }`}>
                {isRest ? <Leaf size={18} className="text-green" /> : <Dumbbell size={18} className="text-green-deep" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    {DAY_LABELS[day]}
                  </span>
                  {!isRest && w.location && (
                    <span className="text-xs bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded-full capitalize">
                      {w.location}
                    </span>
                  )}
                </div>
                <p className={`text-sm font-medium mt-0.5 ${isRest ? 'text-text-secondary' : 'text-text-primary'}`}>
                  {isRest ? (w.recovery_note || 'Rest & Recovery') : (w.workout_name || 'Workout')}
                </p>
                {!isRest && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    {w.duration_mins} min · {w.exercises?.length ?? 0} exercises
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RoutineSlide({ morningItems, nightItems, polling, onRefresh, refreshing }: { morningItems: RoutineItem[]; nightItems: RoutineItem[] } & SlideProps) {
  const hasData = morningItems.length > 0 || nightItems.length > 0

  if (!hasData) {
    return <PendingSlide Icon={Sun} label="Daily routine" polling={polling} onRefresh={onRefresh} refreshing={refreshing} />
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-accent-yellow/40 to-accent-primary/10 rounded-card p-4">
        <p className="font-semibold text-text-primary text-sm">Your Daily Routine</p>
        <p className="text-text-secondary text-xs mt-0.5">Track these each day to keep your pet thriving and build your streak</p>
      </div>

      {morningItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sun size={20} className="text-amber" />
            <h3 className="font-semibold text-text-primary">Morning Routine</h3>
            <span className="text-xs text-text-secondary">({morningItems.length} items)</span>
          </div>
          <div className="space-y-2">
            {morningItems.map((item, i) => (
              <div key={item.id || i} className="bg-white rounded-xl shadow-card p-3.5 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-vitalia-border flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  {item.time_target && (
                    <p className="text-xs text-text-secondary">{item.time_target}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {nightItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Moon size={20} className="text-lavender" />
            <h3 className="font-semibold text-text-primary">Night Routine</h3>
            <span className="text-xs text-text-secondary">({nightItems.length} items)</span>
          </div>
          <div className="space-y-2">
            {nightItems.map((item, i) => (
              <div key={item.id || i} className="bg-white rounded-xl shadow-card p-3.5 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-vitalia-border flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  {item.time_target && (
                    <p className="text-xs text-text-secondary">{item.time_target}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational closing card */}
      <div className="bg-gradient-to-br from-accent-primary/15 to-accent-sage/20 rounded-card p-5 text-center">
        <Sparkles size={28} className="mx-auto mb-2 text-green" />
        <p className="font-semibold text-text-primary mb-1">You're all set!</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your personalized health journey starts now. Complete your routines daily to keep your pet thriving and watch your health transform week by week.
        </p>
      </div>
    </div>
  )
}
