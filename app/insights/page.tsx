'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronRight } from 'lucide-react'
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

// ── Shared UI pieces ───────────────────────────────────────────────────────────

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

// ── ENERGY CARD ────────────────────────────────────────────────────────────────

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
              strokeWidth={3}
              fill={hasData ? 'url(#energyArea)' : '#EBEBF0'}
              dot={false} isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your morning check-in to see your energy trends" />}
    </TrackerCard>
  )
}

// ── SLEEP CARD ─────────────────────────────────────────────────────────────────

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
            <Bar dataKey="value" radius={[6, 6, 0, 0]}
              fill={hasData ? 'url(#sleepBar)' : '#EBEBF0'} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your morning check-in to see your sleep trends" />}
    </TrackerCard>
  )
}

// ── WEIGHT CARD ────────────────────────────────────────────────────────────────

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
              stroke={hasData ? '#B48FE8' : '#EBEBF0'}
              strokeWidth={3}
              fill={hasData ? 'url(#weightArea)' : '#EBEBF0'}
              dot={false} connectNulls isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your night check-in to see your weight trends" />}
    </TrackerCard>
  )
}

// ── WATER CARD ─────────────────────────────────────────────────────────────────

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
            <Bar dataKey="value" radius={[6, 6, 0, 0]}
              fill={hasData ? 'url(#waterBar)' : '#EBEBF0'} />
            <ReferenceLine y={8} stroke="#9B9BAA" strokeDasharray="5 5" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!hasData && <NoDataLabel text="Complete your night check-in to see your water intake" />}
    </TrackerCard>
  )
}

// ── PAGE ───────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DayData[]>([])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

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
          label,
          date,
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
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 28, color: '#1A1A2E', margin: '0 0 32px 0',
        }}>
          Insights
        </h1>

        <EnergyCard data={data} />
        <SleepCard data={data} />
        <WeightCard data={data} />
        <WaterCard data={data} />

        {/* Health Report link card */}
        <button
          onClick={() => router.push('/insights/report')}
          style={{
            width: '100%', background: 'white',
            border: '1px solid #EBEBF0', borderLeft: '3px solid #5DDAB8',
            borderRadius: 20, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            marginTop: 8, marginBottom: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', textAlign: 'left',
            transition: 'box-shadow 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
            e.currentTarget.style.background = '#FAFAFA'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
            e.currentTarget.style.background = 'white'
          }}
        >
          <div>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 16, color: '#1A1A2E', margin: 0 }}>
              Weekly Health Report
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 13, color: '#9B9BAA', margin: '4px 0 0 0' }}>
              Generated every Saturday
            </p>
          </div>
          <ChevronRight size={20} color="#9B9BAA" style={{ flexShrink: 0 }} />
        </button>
      </div>
    </AppShell>
  )
}
