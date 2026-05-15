'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isSameWeek(a: Date, b: Date): boolean {
  return toISO(getMonday(a)) === toISO(getMonday(b))
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HealthReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState<Date>(() => getMonday(new Date()))
  const [allWeeks, setAllWeeks] = useState<string[]>([])

  const isCurrentWeek = isSameWeek(currentWeek, new Date())

  const fetchReport = useCallback(async (monday: Date) => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('weekly_plans')
      .select('health_report')
      .eq('user_id', user.id)
      .eq('week_start_date', toISO(monday))
      .maybeSingle()

    setReport(data?.health_report ?? null)
    setLoading(false)
  }, [router])

  // On mount: load available weeks + current week report
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: plans } = await supabase
        .from('weekly_plans')
        .select('week_start_date')
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })

      setAllWeeks((plans ?? []).map((p: { week_start_date: string }) => p.week_start_date))
      await fetchReport(getMonday(new Date()))
    }
    init()
  }, [router, fetchReport])

  function prevWeek() {
    const prev = new Date(currentWeek)
    prev.setDate(prev.getDate() - 7)
    setCurrentWeek(prev)
    fetchReport(prev)
  }

  function nextWeek() {
    if (isCurrentWeek) return
    const next = new Date(currentWeek)
    next.setDate(next.getDate() + 7)
    setCurrentWeek(next)
    fetchReport(next)
  }

  // Disable prev if no older reports exist
  const hasPrev = allWeeks.some(w => w < toISO(currentWeek))

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/insights')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, color: '#1A1A2E',
          }}
        >
          <ChevronLeft size={20} />
          Back
        </button>

        <h1 style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 700,
          fontSize: 24, color: '#1A1A2E', margin: '16px 0 24px 0',
        }}>
          Health Report
        </h1>

        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
          <button
            onClick={prevWeek}
            disabled={!hasPrev}
            style={{
              background: 'none', border: 'none', cursor: hasPrev ? 'pointer' : 'not-allowed',
              padding: 4, display: 'flex', opacity: hasPrev ? 1 : 0.3,
            }}
            aria-label="Previous week"
          >
            <ChevronLeft size={22} color="#1A1A2E" />
          </button>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#1A1A2E',
            minWidth: 160, textAlign: 'center',
          }}>
            Week of {formatWeekLabel(currentWeek)}
          </span>
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            style={{
              background: 'none', border: 'none', cursor: isCurrentWeek ? 'not-allowed' : 'pointer',
              padding: 4, display: 'flex', opacity: isCurrentWeek ? 0.3 : 1,
            }}
            aria-label="Next week"
          >
            <ChevronRight size={22} color="#1A1A2E" />
          </button>
        </div>

        {/* Report content */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : report ? (
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              lineHeight: 1.7,
              color: '#1A1A2E',
            }}
            className="report-content"
          >
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 22, color: '#1A1A2E', margin: '24px 0 12px' }}>{children}</h1>,
                h2: ({ children }) => <h2 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: '#1A1A2E', margin: '20px 0 10px' }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: 16, color: '#1A1A2E', margin: '16px 0 8px' }}>{children}</h3>,
                p: ({ children }) => <p style={{ margin: '0 0 12px 0' }}>{children}</p>,
                ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '0 0 12px 0' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '0 0 12px 0' }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                strong: ({ children }) => <strong style={{ fontWeight: 600, color: '#1A1A2E' }}>{children}</strong>,
                em: ({ children }) => <em style={{ color: '#6B6B8A' }}>{children}</em>,
                hr: () => <hr style={{ border: 'none', borderTop: '1px solid #EBEBF0', margin: '20px 0' }} />,
              }}
            >
              {report}
            </ReactMarkdown>
          </div>
        ) : (
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 14,
            color: '#9B9BAA', textAlign: 'center', marginTop: 48,
          }}>
            Your health report will be generated this Saturday.
          </p>
        )}
      </div>
    </AppShell>
  )
}
