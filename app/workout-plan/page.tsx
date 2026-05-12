'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { WorkoutDayCard } from '@/components/workout-plan/WorkoutDayCard'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { WorkoutDay, WorkoutPlan, WorkoutLogStatus } from '@/types'
import { ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStartDate(offset = 0): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offset * 7)
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

export default function WorkoutPlanPage() {
  const { toast } = useToast()
  const [weekOffset, setWeekOffset] = useState(0)
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedDay, setSelectedDay] = useState<typeof DAYS[number]>('monday')
  const [workoutLog, setWorkoutLog] = useState<Record<string, WorkoutLogStatus>>({})
  const [swapModal, setSwapModal] = useState<{ workout: WorkoutDay; day: string } | null>(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapAlternatives, setSwapAlternatives] = useState<WorkoutDay[]>([])

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
        console.log('[workout-plan PAGE] weekStart queried:', weekStart)
        const { data, error } = await supabase
          .from('weekly_plans')
          .select('workout_plan')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart)
          .maybeSingle()

        if (error) throw error
        console.log('[workout-plan PAGE] DB row found:', data !== null, '| workout_plan null:', data?.workout_plan == null)
        setPlan((data?.workout_plan as WorkoutPlan) ?? null)

        const today = new Date().toISOString().split('T')[0]
        const { data: log } = await supabase
          .from('daily_logs')
          .select('workout_log')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()

        setWorkoutLog((log?.workout_log as Record<string, WorkoutLogStatus>) ?? {})
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
      const res = await fetch('/api/plans/workout', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPlan(data.plan)
        toast('Workout plan generated! 💪', 'success')
      } else {
        toast(data.error || 'Failed to generate plan', 'error')
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleLogWorkout(day: string, status: WorkoutLogStatus) {
    const newLog = { ...workoutLog, [day]: status }
    setWorkoutLog(newLog)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: today,
        workout_log: newLog,
        last_seen_at: new Date().toISOString(),
      })
    } catch {
      toast('Failed to save log', 'error')
    }
  }

  async function openSwapModal(workout: WorkoutDay, day: string) {
    setSwapModal({ workout, day })
    setSwapLoading(true)
    setSwapAlternatives([])
    try {
      const res = await fetch('/api/workouts/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout, day }),
      })
      const data = await res.json()
      setSwapAlternatives(data.alternatives || [])
    } catch {
      toast('Failed to load alternatives', 'error')
    } finally {
      setSwapLoading(false)
    }
  }

  async function handleSwapConfirm(newWorkout: WorkoutDay) {
    if (!swapModal || !plan) return

    const updatedPlan = {
      ...plan,
      days: { ...plan.days, [swapModal.day]: newWorkout },
    }
    setPlan(updatedPlan)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = getWeekStartDate(weekOffset)
    await supabase.from('weekly_plans').update({ workout_plan: updatedPlan }).eq('user_id', user.id).eq('week_start_date', weekStart)

    setSwapModal(null)
    setSwapAlternatives([])
    toast('Workout swapped! 🔄', 'success')
  }

  async function handleUpdateDay(day: string, updated: WorkoutDay) {
    if (!plan) return
    const updatedPlan = { ...plan, days: { ...plan.days, [day]: updated } }
    setPlan(updatedPlan)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const weekStart = getWeekStartDate(weekOffset)
      await supabase
        .from('weekly_plans')
        .update({ workout_plan: updatedPlan })
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
    } catch {
      toast('Failed to save changes', 'error')
    }
  }

  const weekStart = getWeekStartDate(weekOffset)
  const dayWorkout = plan?.days?.[selectedDay]

  // Full-page empty state for first-time users (current week, no plan)
  if (!loading && !plan && weekOffset === 0 && !fetchError) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <span className="text-7xl mb-6">💪</span>
          <h2 className="text-2xl font-bold text-text-primary mb-3">No workout plan yet</h2>
          <p className="text-text-secondary mb-8 max-w-sm">
            Vitalia will build a personalized 7-day workout plan based on your fitness goals, equipment, and health profile.
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Workout Plan</h1>
          {plan && (
            <Button variant="secondary" size="sm" onClick={() => handleGenerate()} loading={generating}>
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
          <button onClick={() => setWeekOffset((o) => Math.min(0, o + 1))} disabled={weekOffset === 0} className="p-2 rounded-xl hover:bg-white transition-colors">
            <ChevronRight size={20} className={weekOffset === 0 ? 'opacity-30' : ''} />
          </button>
        </div>

        {/* Day tabs — only show when plan exists */}
        {plan && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {DAYS.map((day, i) => {
              const w = plan?.days?.[day]
              const isRest = w?.type === 'rest'
              const isLogged = workoutLog[day]
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all relative ${
                    selectedDay === day ? 'bg-accent-primary text-text-primary' : 'bg-white text-text-secondary hover:bg-accent-primary/10'
                  }`}
                >
                  {DAY_LABELS[i]}
                  {isRest && <span className="text-xs block">🧘</span>}
                  {isLogged && !isRest && <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full" />}
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <CardSkeleton />
        ) : fetchError ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">⚠️</span>
            <h3 className="font-semibold text-text-primary mb-2">Failed to load workout plan</h3>
            <p className="text-text-secondary mb-6 text-sm">Check your connection and try again.</p>
            <Button variant="secondary" onClick={() => setWeekOffset((o) => o)}>Retry</Button>
          </div>
        ) : !plan && weekOffset !== 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">📅</span>
            <p className="text-text-secondary">No workout plan for this week.</p>
          </div>
        ) : !dayWorkout ? (
          <div className="text-center py-8 text-text-secondary">No workout found for this day.</div>
        ) : (
          <WorkoutDayCard
            workout={dayWorkout}
            day={selectedDay}
            logStatus={workoutLog[selectedDay]}
            onSwap={openSwapModal}
            onLog={handleLogWorkout}
            onUpdate={weekOffset === 0 ? handleUpdateDay : undefined}
          />
        )}
      </div>

      {/* Swap Modal */}
      <AnimatePresence>
        {swapModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-card shadow-card w-full max-w-lg max-h-[80vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-text-primary">Swap Workout</h2>
                <button onClick={() => setSwapModal(null)}><X size={20} /></button>
              </div>
              <div className="p-5">
                {swapLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse bg-gray-200 rounded-xl" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {swapAlternatives.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSwapConfirm(alt)}
                        className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-accent-primary/40 transition-all"
                      >
                        <h3 className="font-semibold text-text-primary">{alt.workout_name || 'Rest Day'}</h3>
                        <p className="text-text-secondary text-sm mt-1">{alt.location} • {alt.duration_mins} min • {alt.exercises?.length || 0} exercises</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
