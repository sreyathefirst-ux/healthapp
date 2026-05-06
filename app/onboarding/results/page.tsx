'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { MealPlan, WorkoutPlan, RoutineItem } from '@/types'
import { ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const weekStart = getWeekStartDate()
      const [plansRes, routineRes] = await Promise.all([
        supabase.from('weekly_plans').select('meal_plan,workout_plan,health_report')
          .eq('user_id', user.id).eq('week_start_date', weekStart).maybeSingle(),
        supabase.from('routine_preferences').select('morning_items,night_items')
          .eq('user_id', user.id).maybeSingle(),
      ])

      setData({
        mealPlan: (plansRes.data?.meal_plan as MealPlan) ?? null,
        workoutPlan: (plansRes.data?.workout_plan as WorkoutPlan) ?? null,
        healthReport: plansRes.data?.health_report ?? null,
        morningItems: (routineRes.data?.morning_items as RoutineItem[]) ?? [],
        nightItems: (routineRes.data?.night_items as RoutineItem[]) ?? [],
      })
      setLoading(false)
    }
    load()
  }, [router])

  function go(next: number) {
    setDirection(next > slide ? 1 : -1)
    setSlide(next)
  }

  const slides = [
    { label: 'Your Health Report', icon: '🩺' },
    { label: 'Meal Plan', icon: '🥗' },
    { label: 'Workout Plan', icon: '💪' },
    { label: 'Daily Routine', icon: '🌅' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <div className="text-5xl animate-pulse">🌿</div>
        <p className="text-text-secondary text-sm">Loading your personalized plan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌿</span>
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
                  i === slide ? 'w-6 h-2 bg-accent-primary' : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-xs font-medium text-accent-primary mt-2">
            {slides[slide].icon} {slides[slide].label}
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
              {slide === 0 && <HealthReportSlide report={data?.healthReport ?? null} />}
              {slide === 1 && <MealPlanSlide plan={data?.mealPlan ?? null} />}
              {slide === 2 && <WorkoutPlanSlide plan={data?.workoutPlan ?? null} />}
              {slide === 3 && <RoutineSlide morningItems={data?.morningItems ?? []} nightItems={data?.nightItems ?? []} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => go(slide - 1)}
            disabled={slide === 0}
            className="p-3 rounded-xl border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>

          {slide < slides.length - 1 ? (
            <button
              onClick={() => go(slide + 1)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-accent-primary text-text-primary font-semibold rounded-xl hover:bg-accent-primary/90 transition-colors"
            >
              Next: {slides[slide + 1].label}
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-text-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
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

function HealthReportSlide({ report }: { report: string | null }) {
  if (!report) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <span className="text-4xl block mb-3">📋</span>
        <p>Health report is still being prepared. Check back in your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="prose prose-sm max-w-none">
      <div className="bg-gradient-to-br from-accent-primary/10 to-accent-sage/10 rounded-card p-4 mb-6 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🩺</span>
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

function MealPlanSlide({ plan }: { plan: MealPlan | null }) {
  if (!plan) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <span className="text-4xl block mb-3">🥗</span>
        <p>Meal plan is still being prepared. View it in your dashboard.</p>
      </div>
    )
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
              <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
                ~{totalCals} cal
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'breakfast', emoji: '🍳', meal: meals.breakfast },
                { type: 'lunch', emoji: '🥗', meal: meals.lunch },
                { type: 'dinner', emoji: '🍽️', meal: meals.dinner },
                { type: 'snack', emoji: '🍎', meal: meals.snack },
              ].map(({ type, emoji, meal }) => meal ? (
                <div key={type} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-xs text-text-secondary capitalize mb-0.5">{emoji} {type}</p>
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

function WorkoutPlanSlide({ plan }: { plan: WorkoutPlan | null }) {
  if (!plan) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <span className="text-4xl block mb-3">💪</span>
        <p>Workout plan is still being prepared. View it in your dashboard.</p>
      </div>
    )
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
                isRest ? 'bg-gray-50' : 'bg-white shadow-card'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                isRest ? 'bg-gray-100' : 'bg-accent-primary/15'
              }`}>
                {isRest ? '🧘' : '🏋️'}
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

function RoutineSlide({ morningItems, nightItems }: { morningItems: RoutineItem[]; nightItems: RoutineItem[] }) {
  const hasData = morningItems.length > 0 || nightItems.length > 0

  if (!hasData) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <span className="text-4xl block mb-3">🌅</span>
        <p>Your routine will be available in your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-yellow-50 to-accent-primary/10 rounded-card p-4">
        <p className="font-semibold text-text-primary text-sm">Your Daily Routine</p>
        <p className="text-text-secondary text-xs mt-0.5">Track these each day to keep your pet thriving and build your streak</p>
      </div>

      {morningItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🌅</span>
            <h3 className="font-semibold text-text-primary">Morning Routine</h3>
            <span className="text-xs text-text-secondary">({morningItems.length} items)</span>
          </div>
          <div className="space-y-2">
            {morningItems.map((item, i) => (
              <div key={item.id || i} className="bg-white rounded-xl shadow-card p-3.5 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />
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
            <span className="text-xl">🌙</span>
            <h3 className="font-semibold text-text-primary">Night Routine</h3>
            <span className="text-xs text-text-secondary">({nightItems.length} items)</span>
          </div>
          <div className="space-y-2">
            {nightItems.map((item, i) => (
              <div key={item.id || i} className="bg-white rounded-xl shadow-card p-3.5 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0" />
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
        <span className="text-3xl block mb-2">✨</span>
        <p className="font-semibold text-text-primary mb-1">You're all set!</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your personalized health journey starts now. Complete your routines daily to keep your pet thriving and watch your health transform week by week.
        </p>
      </div>
    </div>
  )
}
