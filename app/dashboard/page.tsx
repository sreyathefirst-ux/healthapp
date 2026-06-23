'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Ring } from '@/components/ui/Ring'
import { PlantPet, moodMeta, conditionMeta, PetCondition } from '@/components/pet/PlantPet'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoutineItem } from '@/types'
import {
  Sun, Moon, Utensils, Dumbbell, HeartPulse, GlassWater, Flame, RotateCcw,
  ChevronRight, Hand, Sparkles, Stethoscope, FlaskConical, Salad, ArrowRight,
  BarChart3,
} from 'lucide-react'

const HOME_SURFACE = 'linear-gradient(150deg,#D2F6E7 0%,#D6EAFB 48%,#E9DCFD 100%)'
const GRAD = 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)'

interface TaskRow {
  id: string
  label: string
  sub: string
  Icon: typeof Sun
  color: string
  route: string
  done: boolean
  pts: number
}

interface QuickLink {
  label: string
  sub: string
  route: string
  Icon: typeof Sun
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Meal Plan', sub: 'View this week', route: '/meal-plan', Icon: Utensils },
  { label: 'Workout', sub: 'Check schedule', route: '/workout-plan', Icon: Dumbbell },
  { label: 'Morning Routine', sub: 'Complete checklist', route: '/routine/morning', Icon: Sun },
  { label: 'Insights', sub: 'See your trends', route: '/health-report', Icon: BarChart3 },
]

// ── Pet aura wrapper ──────────────────────────────────────────────────────────
function PetAura({ size, score, condition, celebrate }: { size: number; score: number; condition: PetCondition; celebrate: number }) {
  const D = Math.round(size * 1.2)
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="pet-aura animate-home-aura"
        style={{ position: 'absolute', left: '50%', top: '46%', width: D, height: D, borderRadius: '50%', transform: 'translate(-50%,-50%)', zIndex: 0 }}
      />
      <div
        style={{
          position: 'absolute', left: '50%', top: '47%', width: D * 0.62, height: D * 0.62, borderRadius: '50%',
          transform: 'translate(-50%,-50%)', zIndex: 0,
          background: 'radial-gradient(circle at 50% 46%, rgba(255,255,255,.92) 0%, rgba(255,255,255,.5) 40%, rgba(255,255,255,0) 70%)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PlantPet size={size} score={score} condition={condition} celebrateSignal={celebrate} />
      </div>
    </div>
  )
}

function Badge({ tone, icon, children }: { tone: string; icon?: ReactNode; children: ReactNode }) {
  const map: Record<string, [string, string]> = {
    green: ['#D6F7E8', '#04976A'],
    amber: ['#FFEFD8', '#D97A0A'],
    rose: ['#FFE0EC', '#E01F6B'],
    neutral: ['#EEF1F0', '#6A706A'],
  }
  const [bg, fg] = map[tone] || map.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: bg, color: fg, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {icon}{children}
    </span>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [petName, setPetName] = useState('Shauna')
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [condition, setCondition] = useState<PetCondition>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [celebrate, setCelebrate] = useState(0)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('name, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && !profile.onboarding_complete) { router.push('/onboarding'); return }
      setUserName(profile?.name || '')

      const today = new Date().toISOString().split('T')[0]
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

      // last seen
      await supabase.from('daily_logs').upsert(
        { user_id: user.id, date: today, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [petRes, logsRes, todayRes, routineRes, planRes] = await Promise.all([
        supabase.from('pet').select('pet_name, current_streak').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_logs').select('morning_routine_completion, night_routine_completion').eq('user_id', user.id).gte('date', sevenDaysAgo.toISOString().split('T')[0]),
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('routine_preferences').select('morning_items, night_items').eq('user_id', user.id).maybeSingle(),
        supabase.from('weekly_plans').select('workout_plan').eq('user_id', user.id).order('week_start_date', { ascending: false }).limit(1).maybeSingle(),
      ])

      if (petRes.data) {
        setPetName(petRes.data.pet_name || 'Shauna')
        setStreak(petRes.data.current_streak || 0)
      }

      // score = 7-day rolling completion average
      const logs = logsRes.data
      let avg = 0
      if (logs && logs.length > 0) {
        avg = Math.round(logs.reduce((s, l) => s + (l.morning_routine_completion + l.night_routine_completion) / 2, 0) / logs.length)
      }
      setScore(avg)
      if (avg < 30) setCondition('sick')
      else if (avg < 50) setCondition('sad')

      // today's tasks from real data
      const log = todayRes.data
      const routine = routineRes.data
      const morningItems = (routine?.morning_items as RoutineItem[]) || []
      const morningChecked = log?.morning_items_checked?.length || 0
      const nightItems = (routine?.night_items as RoutineItem[]) || []
      const nightChecked = log?.night_items_checked?.length || 0

      const mealLog = (log?.meal_log as Record<string, string> | null) || {}
      const mealsLogged = Object.values(mealLog).filter((v) => v === 'eaten' || v === 'swapped').length

      const workoutPlan = planRes.data?.workout_plan as { days?: Record<string, { type?: string; workout_name?: string }> } | null
      const dayPlan = workoutPlan?.days?.[dayOfWeek]
      const workoutDone = (log?.workout_log as Record<string, string> | null)?.[dayOfWeek] === 'completed'
      const isRest = !dayPlan || dayPlan.type === 'rest'

      const builtTasks: TaskRow[] = [
        { id: 'checkin', label: 'Morning check-in', sub: 'Energy, sleep & weight', Icon: HeartPulse, color: '#FF4D8D', route: '/routine/morning', done: (log?.morning_routine_completion || 0) > 0, pts: 15 },
        { id: 'morning', label: 'Morning routine', sub: `${morningChecked} of ${morningItems.length || 0} steps`, Icon: Sun, color: '#F7C948', route: '/routine/morning', done: morningItems.length > 0 && morningChecked >= morningItems.length, pts: 8 },
        { id: 'meals', label: 'Log your meals', sub: `${mealsLogged} of 4 today`, Icon: Utensils, color: '#07C281', route: '/meal-plan', done: mealsLogged >= 4, pts: 30 },
        { id: 'workout', label: isRest ? 'Rest & recover' : (dayPlan?.workout_name || 'Workout'), sub: isRest ? 'Recovery day' : 'Today’s session', Icon: Dumbbell, color: '#06BBC4', route: '/workout-plan', done: workoutDone || isRest, pts: 30 },
        { id: 'water', label: 'Water', sub: 'Track hydration', Icon: GlassWater, color: '#2E9BFF', route: '/meal-plan', done: false, pts: 10 },
        { id: 'night', label: 'Night routine', sub: nightItems.length ? `${nightChecked} of ${nightItems.length} steps` : 'Starts this evening', Icon: Moon, color: '#5B6CFF', route: '/routine/night', done: nightItems.length > 0 && nightChecked >= nightItems.length, pts: 7 },
      ]
      setTasks(builtTasks)
      setLoading(false)
    }
    init()
  }, [router])

  const meta = moodMeta(score)
  const condMeta = conditionMeta(condition)
  const doneCount = tasks.filter((t) => t.done).length

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
    setCelebrate((c) => c + 1)
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ background: HOME_SURFACE, borderRadius: 24, margin: '-32px -16px 0', padding: '4px 16px 16px' }}>
        {/* HERO */}
        <div style={{ padding: '32px 12px 24px', position: 'relative' }}>
          <p className="eyebrow" style={{ marginBottom: 9 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(30px,5vw,44px)', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.04,
              background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              width: 'fit-content', paddingBottom: 3,
            }}
          >
            Good morning{userName ? `, ${userName}` : ''}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: 28, flexWrap: 'wrap' }}>
            <PetAura size={188} score={score} condition={condition} celebrate={celebrate} />

            <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={meta.tone} icon={<Sparkles size={14} />}>{petName} is {meta.label.toLowerCase()}</Badge>
                {condMeta && <Badge tone={condMeta.tone}>{condMeta.label}</Badge>}
              </div>
              <div className="font-display" style={{ fontSize: 23, fontWeight: 400, lineHeight: 1.36, maxWidth: 470, letterSpacing: '-0.005em', color: '#16201B' }}>
                {condMeta ? condMeta.msg : `${petName} ${meta.line}`}
              </div>
              <div style={{ fontSize: 14.5, color: '#6C736C', maxWidth: 430, lineHeight: 1.55 }}>
                {doneCount === tasks.length
                  ? 'Every task done today — she’s positively glowing. Beautiful work.'
                  : `Each task you finish lifts her mood and your score. ${tasks.length - doneCount} left today.`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2, color: '#969C95', fontSize: 13 }}>
                <Hand size={16} style={{ color: '#969C95' }} /> Tap {petName} to say hello
              </div>
            </div>

            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Ring size={132} stroke={13} value={score} grad>
                <span className="font-display" style={{ fontSize: 46, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#16201B' }}>{score}</span>
                <span className="eyebrow" style={{ fontSize: 10, marginTop: 4 }}>Health</span>
              </Ring>
              <div style={{ fontSize: 11.5, color: '#B0B5AE', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <RotateCcw size={12} style={{ color: '#B0B5AE' }} /> 7-day average
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FF9A2E', background: '#fff', padding: '7px 12px', borderRadius: 999, boxShadow: '0 1px 2px rgba(36,40,30,.04), 0 4px 12px rgba(36,40,30,.04)' }}>
                <Flame size={16} style={{ color: '#FF9A2E' }} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{streak}</span>
                <span style={{ fontSize: 12.5, color: '#969C95', fontWeight: 500 }}>day streak</span>
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: '6px 12px 16px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {/* Today's tasks */}
            <div className="bg-white border border-vitalia-border shadow-card" style={{ flex: '1 1 360px', borderRadius: 22, padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: '#16201B' }}>Today</h2>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: doneCount === tasks.length ? '#07C281' : '#969C95' }}>{doneCount} of {tasks.length} done</span>
                  <span style={{ width: 84, height: 6, background: '#ECEEE8', borderRadius: 6, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 6, width: `${(doneCount / tasks.length) * 100}%`, background: GRAD, transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
                  </span>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => router.push(t.route)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px', borderRadius: 15, background: t.done ? '#F1F7F3' : '#EDF2F8', cursor: 'pointer', transition: 'background .2s ease' }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTask(t.id) }}
                      style={{ width: 28, height: 28, borderRadius: 10, flex: '0 0 auto', border: '2px solid ' + (t.done ? t.color : '#D2D6CE'), background: t.done ? t.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all .18s ease' }}
                    >
                      {t.done && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </button>
                    <span style={{ width: 38, height: 38, borderRadius: 12, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t.color + '18' }}>
                      <t.Icon size={18} style={{ color: t.color }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: t.done ? '#969C95' : '#16201B', textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</div>
                      <div style={{ fontSize: 12.5, color: '#969C95', marginTop: 1 }}>{t.sub}</div>
                    </div>
                    {!t.done && <span style={{ fontSize: 12, fontWeight: 700, color: '#07C281', background: '#E5F6EE', padding: '3px 8px', borderRadius: 8 }}>+{t.pts}</span>}
                    <ChevronRight size={18} style={{ color: '#C4C9C0' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Right rail */}
            <div style={{ width: 300, flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* jump back in */}
              <div className="bg-white border border-vitalia-border shadow-card" style={{ borderRadius: 22, padding: '8px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B0B5AE', padding: '9px 10px 5px' }}>Jump back in</div>
                {QUICK_LINKS.map((l) => (
                  <div
                    key={l.label}
                    onClick={() => router.push(l.route)}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 10px', borderRadius: 13, cursor: 'pointer', transition: 'background .2s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#EDF2F8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 38, height: 38, borderRadius: 12, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: GRAD }}>
                      <l.Icon size={18} style={{ color: '#fff' }} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#16201B' }}>{l.label}</div>
                      <div style={{ fontSize: 12, color: '#969C95', marginTop: 1 }}>{l.sub}</div>
                    </div>
                    <ChevronRight size={18} style={{ color: '#C4C9C0' }} />
                  </div>
                ))}
              </div>

              {/* health report */}
              <div
                onClick={() => router.push('/health-report')}
                className="bg-white border border-vitalia-border shadow-card"
                style={{ borderRadius: 22, overflow: 'hidden', cursor: 'pointer' }}
              >
                <div style={{ background: 'linear-gradient(180deg,#DEFAEE 0%,#E2F0FC 38%,#EBE5FD 72%,#fff 100%)', padding: '20px 22px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {[Stethoscope, FlaskConical, Salad, Dumbbell].map((Ic, i, arr) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ width: 44, height: 44, borderRadius: 14, background: '#fff', boxShadow: '0 1px 2px rgba(36,40,30,.04), 0 4px 12px rgba(36,40,30,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Ic size={21} style={{ color: '#07C281' }} />
                        </span>
                        {i < arr.length - 1 && <ChevronRight size={15} style={{ color: '#BFD8CC', margin: '0 2px' }} />}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px 20px' }}>
                  <p className="eyebrow" style={{ color: '#04976A', marginBottom: 8 }}>Your Health Report</p>
                  <div className="font-display" style={{ fontSize: 19.5, lineHeight: 1.22, letterSpacing: '-0.005em', marginBottom: 14, color: '#16201B' }}>
                    Walk through your bloodwork with your AI care team
                  </div>
                  <button
                    style={{ width: '100%', justifyContent: 'center', background: GRAD, borderRadius: 13, padding: '13px 18px', color: '#fff', fontSize: 14.5, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    Begin the walkthrough <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
