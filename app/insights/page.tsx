'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
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

type ReportSubTab = 'weekly' | 'overview'

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

function HealthReportTab({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<ReportSubTab>('weekly')
  const [reportLoading, setReportLoading] = useState(true)
  const [healthReport, setHealthReport] = useState<string | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState<Date>(() => getMonday(new Date()))
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const isCurrentWeek = toISO(getMonday(new Date())) === toISO(currentWeek)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchReports = useCallback(async (monday: Date) => {
    setReportLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('weekly_plans')
      .select('health_report, weekly_progress_report')
      .eq('user_id', userId)
      .eq('week_start_date', toISO(monday))
      .maybeSingle()
    setHealthReport(data?.health_report ?? null)
    setWeeklyReport(data?.weekly_progress_report ?? null)
    setReportLoading(false)
  }, [userId])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: plans } = await supabase
        .from('weekly_plans')
        .select('week_start_date')
        .eq('user_id', userId)
        .order('week_start_date', { ascending: false })
      setAvailableWeeks((plans ?? []).map((p: { week_start_date: string }) => p.week_start_date))
      const mostRecent = plans?.[0]?.week_start_date
      if (mostRecent) {
        const d = new Date(mostRecent + 'T00:00:00Z')
        setCurrentWeek(d)
        fetchReports(d)
      } else {
        fetchReports(getMonday(new Date()))
      }
    }
    init()
  }, [userId, fetchReports])

  function prevWeek() {
    const prev = new Date(currentWeek)
    prev.setDate(prev.getDate() - 7)
    setCurrentWeek(prev)
    fetchReports(prev)
  }

  function nextWeek() {
    if (isCurrentWeek) return
    const next = new Date(currentWeek)
    next.setDate(next.getDate() + 7)
    setCurrentWeek(next)
    fetchReports(next)
  }

  async function handleRegenerate() {
    if (!isCurrentWeek) return
    setRegenerating(true)
    const endpoint = subTab === 'weekly' ? '/api/plans/weekly-progress' : '/api/plans/report'
    showToast(subTab === 'weekly' ? 'Generating weekly check-in…' : 'Generating health overview… up to 60s')
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        if (subTab === 'weekly') setWeeklyReport(data.report)
        else setHealthReport(data.report)
        showToast('Done!')
      } else {
        showToast('Generation failed — try again')
      }
    } catch {
      showToast('Something went wrong')
    } finally {
      setRegenerating(false)
    }
  }

  const hasPrev = availableWeeks.some(w => w < toISO(currentWeek))
  const activeReport = subTab === 'weekly' ? weeklyReport : healthReport

  return (
    <div>
      {/* Inline toast */}
      {toast && (
        <div style={{ background: '#1A1A2E', color: 'white', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
          {toast}
        </div>
      )}

      {/* Sub-tab row + Regenerate */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', background: '#F5F5F8', borderRadius: 12, padding: 3, gap: 2, flex: 1 }}>
          {(['weekly', 'overview'] as ReportSubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                background: subTab === t ? 'white' : 'transparent',
                color: subTab === t ? '#1A1A2E' : '#9B9BAA',
                boxShadow: subTab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t === 'weekly' ? 'Weekly Check-in' : 'Health Overview'}
            </button>
          ))}
        </div>
        {isCurrentWeek && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10,
              border: '1.5px solid #EBEBF0', background: 'white', cursor: regenerating ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, color: '#1A1A2E', fontFamily: "'DM Sans', sans-serif",
              opacity: regenerating ? 0.6 : 1, flexShrink: 0,
            }}
            aria-label="Regenerate report"
          >
            <RefreshCw size={14} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            Regenerate
          </button>
        )}
      </div>

      {/* Week selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={prevWeek} disabled={!hasPrev} aria-label="Previous week"
          style={{ background: 'none', border: 'none', padding: 6, display: 'flex', borderRadius: 8, cursor: hasPrev ? 'pointer' : 'not-allowed', opacity: hasPrev ? 1 : 0.3 }}>
          <ChevronLeft size={20} color="#1A1A2E" />
        </button>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E', minWidth: 160, textAlign: 'center' }}>
          Week of {formatWeekLabel(currentWeek)}
        </span>
        <button onClick={nextWeek} disabled={isCurrentWeek} aria-label="Next week"
          style={{ background: 'none', border: 'none', padding: 6, display: 'flex', borderRadius: 8, cursor: isCurrentWeek ? 'not-allowed' : 'pointer', opacity: isCurrentWeek ? 0.3 : 1 }}>
          <ChevronRight size={20} color="#1A1A2E" />
        </button>
      </div>

      {/* Report content */}
      {reportLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : activeReport ? (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7, color: '#3A3A4A' }}>
          <ReactMarkdown components={reportMarkdownComponents}>
            {activeReport}
          </ReactMarkdown>
          {subTab === 'overview' && (
            <p style={{ fontSize: 11, color: '#9B9BAA', marginTop: 24, lineHeight: 1.5 }}>
              <strong>Medical Disclaimer:</strong> This report is AI-generated for informational purposes only. Always consult a qualified healthcare provider before making changes to your health regimen.
            </p>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#9B9BAA', marginBottom: 16 }}>
            {subTab === 'weekly'
              ? 'No weekly check-in yet for this week.'
              : 'No health overview yet.'}
          </p>
          {isCurrentWeek && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #10b981, #9333ea)', color: 'white',
                fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                opacity: regenerating ? 0.7 : 1,
              }}
            >
              {regenerating ? 'Generating…' : 'Generate Now'}
            </button>
          )}
        </div>
      )}
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
