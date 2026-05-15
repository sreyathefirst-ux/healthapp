'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  ChevronLeft, ChevronRight, RefreshCw, Target, CheckCircle2, AlertCircle,
  Utensils, Pill, TrendingUp, Stethoscope, Apple, Dumbbell, Activity,
  Heart, Microscope, Shield,
} from 'lucide-react'
import type { HealthInsights, ActionPlan } from '@/types'
import ReactMarkdown from 'react-markdown'
import {
  AreaChart, Area, BarChart, Bar, XAxis, ReferenceLine,
  ResponsiveContainer, Tooltip,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayData {
  label: string
  date: string
  energy: number | null
  sleep: number | null
  weight: number | null
  water: number | null
}

type Tab = 'trackers' | 'report'

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getLast7Days(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ date: d.toISOString().split('T')[0], label: DAY_LABELS[d.getDay()] })
  }
  return days
}

function formatSleepAvg(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function TrackerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #EBEBF0', borderRadius: 20,
      padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 24,
    }}>
      <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 16, color: '#1A1A2E', margin: '0 0 16px 0' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 28, color: '#1A1A2E', margin: 0, lineHeight: 1.2 }}>
        {value}
      </p>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 12, color: '#9B9BAA', margin: '2px 0 0 0' }}>
        {label}
      </p>
    </div>
  )
}

function NoDataLabel({ text }: { text: string }) {
  return (
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 12, color: '#9B9BAA', marginTop: 8, textAlign: 'center' }}>
      {text}
    </p>
  )
}

function XTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="#9B9BAA"
      style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
      {payload?.value}
    </text>
  )
}

// ── Tracker cards ──────────────────────────────────────────────────────────────

function EnergyCard({ data }: { data: DayData[] }) {
  const hasData = data.some(d => d.energy !== null)
  const chartData = data.map(d => ({ label: d.label, value: d.energy ?? 0 }))
  return (
    <TrackerCard title="Energy">
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="energyLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6FD8A0" stopOpacity={1} />
                <stop offset="50%" stopColor="#5DDAB8" stopOpacity={1} />
                <stop offset="100%" stopColor="#B48FE8" stopOpacity={1} />
              </linearGradient>
              <linearGradient id="energyArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5DDAB8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#5DDAB8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={XTick} interval={0} />
            <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
              formatter={(v: number) => [v ? `${v}/10` : '—', 'Energy']} />
            <Area type="monotone" dataKey="value"
              stroke={hasData ? 'url(#energyLine)' : '#EBEBF0'}
              strokeWidth={3} fill={hasData ? 'url(#energyArea)' : '#EBEBF0'}
              dot={false} isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your morning check-in to see your energy trends" />}
    </TrackerCard>
  )
}

function SleepCard({ data }: { data: DayData[] }) {
  const sleepValues = data.filter(d => d.sleep !== null).map(d => d.sleep as number)
  const hasData = sleepValues.length > 0
  const avg = hasData ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null
  const chartData = data.map(d => ({ label: d.label, value: d.sleep ?? 0 }))
  return (
    <TrackerCard title="Sleep">
      {hasData && avg !== null && <BigStat value={formatSleepAvg(avg)} label="Avg this week" />}
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="sleepBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6FD8A0" stopOpacity={1} />
                <stop offset="100%" stopColor="#B48FE8" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={XTick} interval={0} />
            <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
              formatter={(v: number) => [v ? `${v}h` : '—', 'Sleep']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={hasData ? 'url(#sleepBar)' : '#EBEBF0'} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your morning check-in to see your sleep trends" />}
    </TrackerCard>
  )
}

function WeightCard({ data }: { data: DayData[] }) {
  const weightEntries = data.filter(d => d.weight !== null)
  const hasData = weightEntries.length > 0
  const latest = hasData ? weightEntries[weightEntries.length - 1].weight : null
  const chartData = data.map(d => ({ label: d.label, value: d.weight }))
  return (
    <TrackerCard title="Weight">
      {hasData && latest !== null && <BigStat value={`${latest} kg`} label="Latest" />}
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#B48FE8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#D4C5E8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={XTick} interval={0} />
            <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
              formatter={(v: number) => [v ? `${v} kg` : '—', 'Weight']} />
            <Area type="monotone" dataKey="value"
              stroke={hasData ? '#B48FE8' : '#EBEBF0'} strokeWidth={3}
              fill={hasData ? 'url(#weightArea)' : '#EBEBF0'}
              dot={false} connectNulls isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your night check-in to see your weight trends" />}
    </TrackerCard>
  )
}

function WaterCard({ data }: { data: DayData[] }) {
  const todayISO = new Date().toISOString().split('T')[0]
  const todayData = data.find(d => d.date === todayISO)
  const todayWater = todayData?.water ?? null
  const hasData = data.some(d => d.water !== null)
  const chartData = data.map(d => ({ label: d.label, value: d.water ?? 0 }))
  return (
    <TrackerCard title="Water">
      <BigStat value={todayWater !== null ? `${todayWater} cups` : '— cups'} label="Today" />
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="waterBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5DDAB8" stopOpacity={1} />
                <stop offset="100%" stopColor="#6FD8A0" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={XTick} interval={0} />
            <Tooltip contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }}
              formatter={(v: number) => [v ? `${v} cups` : '—', 'Water']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={hasData ? 'url(#waterBar)' : '#EBEBF0'} />
            <ReferenceLine y={8} stroke="#9B9BAA" strokeDasharray="5 5" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your night check-in to see your water intake" />}
    </TrackerCard>
  )
}

// ── Health Report tab ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reportMarkdownComponents: any = {
  h1: ({ children }: { children: React.ReactNode }) => <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 22, color: '#1A1A2E', margin: '24px 0 12px' }}>{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#1A1A2E', margin: '20px 0 10px', paddingBottom: 6, borderBottom: '1px solid #EBEBF0' }}>{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 16, color: '#1A1A2E', margin: '16px 0 8px' }}>{children}</h3>,
  p: ({ children }: { children: React.ReactNode }) => <p style={{ margin: '0 0 12px 0' }}>{children}</p>,
  ul: ({ children }: { children: React.ReactNode }) => <ul style={{ paddingLeft: 20, margin: '0 0 12px 0' }}>{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol style={{ paddingLeft: 20, margin: '0 0 12px 0' }}>{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: 6 }}>{children}</li>,
  strong: ({ children }: { children: React.ReactNode }) => <strong style={{ fontWeight: 600, color: '#1A1A2E' }}>{children}</strong>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #EBEBF0', margin: '20px 0' }} />,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SPECIALIST_ICONS: Record<string, React.ComponentType<any>> = {
  Stethoscope, Apple, Dumbbell, Activity, Heart, Microscope, Shield,
}

function HealthReportTab({ userId }: { userId: string }) {
  const [reportLoading, setReportLoading] = useState(true)
  const [healthReport, setHealthReport] = useState<string | null>(null)
  const [healthInsights, setHealthInsights] = useState<HealthInsights | null>(null)
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState<Date>(() => getMonday(new Date()))
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const isCurrentWeek = toISO(getMonday(new Date())) === toISO(currentWeek)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchReport = useCallback(async (monday: Date) => {
    setReportLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('weekly_plans')
      .select('health_report, health_insights, action_plan, generated_at')
      .eq('user_id', userId)
      .eq('week_start_date', toISO(monday))
      .maybeSingle()
    setHealthReport(data?.health_report ?? null)
    setHealthInsights((data?.health_insights as HealthInsights) ?? null)
    setActionPlan((data?.action_plan as ActionPlan) ?? null)
    setGeneratedAt(data?.generated_at ?? null)
    setExpandedSection(null)
    setReportLoading(false)
  }, [userId])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: plans } = await supabase
        .from('weekly_plans')
        .select('week_start_date')
        .eq('user_id', userId)
        .not('health_report', 'is', null)
        .order('week_start_date', { ascending: false })
      setAvailableWeeks((plans ?? []).map((p: { week_start_date: string }) => p.week_start_date))
      const mostRecent = plans?.[0]?.week_start_date
      if (mostRecent) {
        const d = new Date(mostRecent + 'T00:00:00Z')
        setCurrentWeek(d)
        fetchReport(d)
      } else {
        fetchReport(getMonday(new Date()))
      }
    }
    init()
  }, [userId, fetchReport])

  function prevWeek() {
    const prev = new Date(currentWeek)
    prev.setUTCDate(prev.getUTCDate() - 7)
    setCurrentWeek(prev)
    fetchReport(prev)
  }

  function nextWeek() {
    if (isCurrentWeek) return
    const next = new Date(currentWeek)
    next.setUTCDate(next.getUTCDate() + 7)
    setCurrentWeek(next)
    fetchReport(next)
  }

  async function handleRegenerate() {
    if (!isCurrentWeek) return
    setRegenerating(true)
    showToast('Generating your health report… up to 60s')
    try {
      const res = await fetch('/api/plans/report', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setHealthReport(data.report ?? null)
        setHealthInsights(data.health_insights ?? null)
        setActionPlan(data.action_plan ?? null)
        setGeneratedAt(new Date().toISOString())
        setExpandedSection(null)
        showToast('Done!')
      } else {
        showToast(data.error || 'Generation failed — try again')
      }
    } catch {
      showToast('Something went wrong')
    } finally {
      setRegenerating(false)
    }
  }

  const hasPrev = availableWeeks.some(w => w < toISO(currentWeek))

  if (reportLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  // ── Shared week navigator (used in old/empty states) ─────────────────────
  const WeekNav = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={prevWeek} disabled={!hasPrev} aria-label="Previous week"
          style={{ background: 'none', border: 'none', padding: 6, display: 'flex', borderRadius: 8, cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.3 }}>
          <ChevronLeft size={20} color="#1A1A2E" />
        </button>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E', minWidth: 140, textAlign: 'center' }}>
          Week of {formatWeekLabel(currentWeek)}
        </span>
        <button onClick={nextWeek} disabled={isCurrentWeek} aria-label="Next week"
          style={{ background: 'none', border: 'none', padding: 6, display: 'flex', borderRadius: 8, cursor: isCurrentWeek ? 'not-allowed' : 'pointer', opacity: isCurrentWeek ? 0.3 : 1 }}>
          <ChevronRight size={20} color="#1A1A2E" />
        </button>
      </div>
      {isCurrentWeek && (
        <button onClick={handleRegenerate} disabled={regenerating}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #EBEBF0', background: 'white', cursor: regenerating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#1A1A2E', fontFamily: "'DM Sans', sans-serif", opacity: regenerating ? 0.6 : 1, flexShrink: 0 }}>
          <RefreshCw size={14} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          Regenerate
        </button>
      )}
    </div>
  )

  // ── Toast ────────────────────────────────────────────────────────────────
  const Toast = () => toast ? (
    <div style={{ background: '#1A1A2E', color: 'white', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
      {toast}
    </div>
  ) : null

  // ── New structured UI ────────────────────────────────────────────────────
  if (healthInsights && actionPlan) {
    const { focus_areas, wins, priority, specialist_insights, goals_3_6_months } = healthInsights
    const genDate = generatedAt
      ? new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null

    return (
      <div>
        <Toast />

        {/* Section 1 — Gradient Header */}
        <div style={{ background: 'linear-gradient(to right, #34d399, #2dd4bf, #9333ea)', borderRadius: 20, padding: '20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={prevWeek} disabled={!hasPrev} aria-label="Previous week"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '4px 6px', display: 'flex', borderRadius: 8, cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.4 }}>
                <ChevronLeft size={18} color="white" />
              </button>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'white', minWidth: 120, textAlign: 'center' }}>
                Week of {formatWeekLabel(currentWeek)}
              </span>
              <button onClick={nextWeek} disabled={isCurrentWeek} aria-label="Next week"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '4px 6px', display: 'flex', borderRadius: 8, cursor: isCurrentWeek ? 'not-allowed' : 'pointer', opacity: isCurrentWeek ? 0.4 : 1 }}>
                <ChevronRight size={18} color="white" />
              </button>
            </div>
            {isCurrentWeek && (
              <button onClick={handleRegenerate} disabled={regenerating}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.7)', background: 'transparent', cursor: regenerating ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, color: 'white', fontFamily: "'DM Sans', sans-serif", opacity: regenerating ? 0.6 : 1, flexShrink: 0 }}>
                <RefreshCw size={13} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
                Regenerate
              </button>
            )}
          </div>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 20, color: 'white', margin: '0 0 4px 0' }}>
            Your Personalized Health Insights
          </h1>
          {genDate && (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              Generated {genDate}
            </p>
          )}
        </div>

        {/* Section 2 — Focus Areas */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 16, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Target size={20} color="#16a34a" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15, color: '#1A1A2E' }}>Your Focus Areas</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {focus_areas.map((area, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 14, color: '#3A3A4A', lineHeight: 1.5 }}>
                <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>•</span>
                {area}
              </li>
            ))}
          </ul>
        </div>

        {/* Section 2 — Wins */}
        <div style={{ border: '2px solid #4ade80', borderRadius: 16, padding: 20, marginBottom: 16, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <CheckCircle2 size={20} color="#16a34a" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15, color: '#15803d' }}>Your Wins</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wins.map((win, i) => (
              <div key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#15803d' }}>{win.metric}</span>
                  <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{win.status}</span>
                </div>
                {win.value && win.value !== 'N/A' && (
                  <p style={{ fontSize: 12, color: '#166534', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>{win.value}{win.reference_range && win.reference_range !== 'N/A' ? ` (ref: ${win.reference_range})` : ''}</p>
                )}
                <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{win.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 — Primary Focus */}
        <div style={{ border: '2px solid #c084fc', borderRadius: 16, padding: 20, marginBottom: 24, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertCircle size={20} color="#9333ea" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 15, color: '#7e22ce' }}>Primary Focus</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1A1A2E' }}>{priority.metric}</span>
            <span style={{ fontSize: 11, background: '#faf5ff', color: '#9333ea', padding: '2px 8px', borderRadius: 20, fontWeight: 600, border: '1px solid #e9d5ff' }}>{priority.status}</span>
          </div>
          <div style={{ background: '#f3f4f6', borderRadius: 999, height: 8, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(to right, #4ade80, #9333ea)', height: '100%', width: `${Math.min(100, Math.max(0, priority.progress_percent))}%`, borderRadius: 999, transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: 13, color: '#3A3A4A', marginBottom: 10, lineHeight: 1.6 }}>{priority.explanation}</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Current: <strong style={{ color: '#1A1A2E' }}>{priority.current_value}</strong> → Target: <strong style={{ color: '#1A1A2E' }}>{priority.target_value}</strong></p>
          <div style={{ background: '#faf5ff', borderLeft: '4px solid #9333ea', borderRadius: '0 8px 8px 0', padding: 12 }}>
            <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>{priority.recommended_action}</p>
          </div>
        </div>

        {/* Section 3 — Action Plan header */}
        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: '#0f172a', marginBottom: 14, marginTop: 4 }}>
          Action Plan
        </h2>

        {/* Nutrition card */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 14, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Utensils size={18} color="#16a34a" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>Nutrition</span>
          </div>
          <div style={{ borderLeft: '4px solid #22c55e', background: '#f0fdf4', borderRadius: '0 8px 8px 0', padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>PRIORITIZE — {actionPlan.nutrition.prioritize.title}</p>
            <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{actionPlan.nutrition.prioritize.description}</p>
          </div>
          <div style={{ borderLeft: '4px solid #CBD5E1', background: '#f8fafc', borderRadius: '0 8px 8px 0', padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>AVOID — {actionPlan.nutrition.avoid.title}</p>
            <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{actionPlan.nutrition.avoid.description}</p>
          </div>
          <div style={{ borderLeft: '4px solid #9333ea', background: '#faf5ff', borderRadius: '0 8px 8px 0', padding: 12, marginBottom: actionPlan.nutrition.note ? 10 : 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>KEY HABIT — {actionPlan.nutrition.key_habit.title}</p>
            <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{actionPlan.nutrition.key_habit.description}</p>
          </div>
          {actionPlan.nutrition.note && (
            <p style={{ fontSize: 12, color: '#9B9BAA', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>📝 {actionPlan.nutrition.note}</p>
          )}
        </div>

        {/* Workout card */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 14, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Activity size={18} color="#9333ea" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>Workout</span>
          </div>
          <div style={{ borderLeft: '4px solid #9333ea', background: '#faf5ff', borderRadius: '0 8px 8px 0', padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>FREQUENCY — {actionPlan.workout.frequency}</p>
            {actionPlan.workout.breakdown.map((b, i) => (
              <p key={i} style={{ fontSize: 13, color: '#3A3A4A', margin: '0 0 2px', paddingLeft: 4 }}>• {b}</p>
            ))}
          </div>
          <div style={{ borderLeft: '4px solid #22c55e', background: '#f0fdf4', borderRadius: '0 8px 8px 0', padding: 12, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>KEY FOCUS</p>
            <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{actionPlan.workout.key_focus}</p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" }}>EXPECTED RESULTS</p>
            {actionPlan.workout.expected_results.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < actionPlan.workout.expected_results.length - 1 ? 6 : 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#9333ea', minWidth: 72, flexShrink: 0 }}>{r.timeline}</span>
                <span style={{ fontSize: 13, color: '#3A3A4A', lineHeight: 1.5 }}>{r.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Supplements card */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 24, background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Pill size={18} color="#16a34a" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>Supplements</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actionPlan.supplements.map((s, i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E', margin: '0 0 4px' }}>{s.name}</p>
                <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4 — Specialist Insights */}
        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 17, color: '#0f172a', marginBottom: 14 }}>
          Specialist Recommendations
        </h2>
        <div style={{ marginBottom: 24 }}>
          {specialist_insights.map((specialist) => {
            const IconComp = SPECIALIST_ICONS[specialist.icon] ?? Stethoscope
            const isExpanded = expandedSection === specialist.id
            return (
              <div key={specialist.id} style={{ border: '1px solid #E2E8F0', borderRadius: 16, marginBottom: 10, overflow: 'hidden', background: 'white' }}>
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : specialist.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <IconComp size={20} color="#9333ea" />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E' }}>
                      {specialist.name}
                    </span>
                  </div>
                  <ChevronRight size={17} color="#9B9BAA"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                </button>
                {isExpanded && (
                  <div style={{ background: '#faf5ff', borderTop: '1px solid #e9d5ff', padding: '14px 18px' }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.7, color: '#3A3A4A', whiteSpace: 'pre-line' }}>
                      {specialist.content}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Section 5 — 3-6 Month Goals */}
        <div style={{ background: 'linear-gradient(to right, #f0fdf4, #faf5ff)', border: '2px solid #4ade80', borderRadius: 16, padding: 22, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <TrendingUp size={20} color="#16a34a" />
            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 16, color: '#0f172a' }}>3–6 Month Goals</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goals_3_6_months.map((goal, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1A1A2E', margin: '0 0 4px' }}>{goal.metric}</p>
                <p style={{ fontSize: 13, color: '#3A3A4A', margin: 0, lineHeight: 1.5 }}>{goal.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 6 — Medical Disclaimer */}
        <div style={{ background: '#f8fafc', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 48 }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            <strong>Medical Disclaimer:</strong> This report is generated by AI for informational purposes only and should not be considered medical advice. Always consult with a qualified healthcare provider before making changes to your diet, exercise routine, or health regimen.
          </p>
        </div>
      </div>
    )
  }

  // ── Old markdown fallback (reports without health_insights) ──────────────
  if (healthReport) {
    return (
      <div>
        <Toast />
        <WeekNav />
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7, color: '#3A3A4A' }}>
          <ReactMarkdown components={reportMarkdownComponents}>
            {healthReport}
          </ReactMarkdown>
          <p style={{ fontSize: 11, color: '#9B9BAA', marginTop: 24, lineHeight: 1.5 }}>
            <strong>Medical Disclaimer:</strong> This report is AI-generated for informational purposes only. Always consult a qualified healthcare provider before making changes to your health regimen.
          </p>
        </div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  return (
    <div>
      <Toast />
      <WeekNav />
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#9B9BAA', marginBottom: 16 }}>
          No health report yet.
        </p>
        {isCurrentWeek && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10b981, #9333ea)', color: 'white', fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", opacity: regenerating ? 0.7 : 1 }}
          >
            {regenerating ? 'Generating…' : 'Generate Now'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── PAGE ───────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DayData[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('trackers')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const days = getLast7Days()
      const dates = days.map(d => d.date)

      const { data: logs } = await supabase
        .from('daily_logs')
        .select('date, morning_checkin, night_checkin')
        .eq('user_id', user.id)
        .in('date', dates)

      const logMap = new Map(
        (logs ?? []).map((l: { date: string; morning_checkin: Record<string, unknown> | null; night_checkin: Record<string, unknown> | null }) => [l.date, l])
      )

      const result: DayData[] = days.map(({ date, label }) => {
        const log = logMap.get(date)
        const mc = (log?.morning_checkin as Record<string, unknown> | null) ?? null
        const nc = (log?.night_checkin as Record<string, unknown> | null) ?? null
        return {
          label, date,
          energy: mc?.energy != null ? Number(mc.energy) : null,
          sleep: mc?.sleep_hours != null ? Number(mc.sleep_hours) : null,
          weight: nc?.weight != null ? Number(nc.weight) : null,
          water: nc?.water_cups != null ? Number(nc.water_cups) : null,
        }
      })

      setData(result)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trackers', label: 'Trackers' },
    { key: 'report', label: 'Health Report' },
  ]

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 28, color: '#1A1A2E', margin: '0 0 24px 0' }}>
          Insights
        </h1>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, background: '#F4F4F6', borderRadius: 14,
          padding: 4, marginBottom: 28, width: 'fit-content',
        }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                transition: 'all 0.18s ease',
                background: activeTab === key ? 'white' : 'transparent',
                color: activeTab === key ? '#1A1A2E' : '#9B9BAA',
                boxShadow: activeTab === key ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'trackers' ? (
          <>
            <EnergyCard data={data} />
            <SleepCard data={data} />
            <WeightCard data={data} />
            <WaterCard data={data} />
          </>
        ) : (
          userId && <HealthReportTab userId={userId} />
        )}
      </div>
    </AppShell>
  )
}
