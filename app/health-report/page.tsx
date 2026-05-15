'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type Tab = 'weekly' | 'overview'

interface ReportRow {
  id: string
  week_start_date: string
  health_report: string | null
  weekly_progress_report: string | null
  generated_at: string
}

function EmptyState({ onGenerate, loading, label }: { onGenerate: () => void; loading: boolean; label: string }) {
  return (
    <div className="text-center py-16">
      <span className="text-5xl block mb-4">📋</span>
      <h3 className="font-semibold text-text-primary mb-2">No {label} yet</h3>
      <p className="text-text-secondary mb-6 text-sm">Generate your personalized {label.toLowerCase()} now</p>
      <Button onClick={onGenerate} loading={loading}>Generate Now</Button>
    </div>
  )
}

export default function HealthReportPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('weekly')
  const [loading, setLoading] = useState(true)
  const [regeneratingOverview, setRegeneratingOverview] = useState(false)
  const [regeneratingWeekly, setRegeneratingWeekly] = useState(false)

  const [currentRow, setCurrentRow] = useState<ReportRow | null>(null)
  const [pastRows, setPastRows] = useState<ReportRow[]>([])

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('weekly_plans')
      .select('id, week_start_date, health_report, weekly_progress_report, generated_at')
      .eq('user_id', user.id)
      .or('health_report.not.is.null,weekly_progress_report.not.is.null')
      .order('week_start_date', { ascending: false })

    if (data && data.length > 0) {
      setCurrentRow(data[0] as ReportRow)
      setPastRows(data as ReportRow[])
    }
    setLoading(false)
  }

  async function handleRegenerateOverview() {
    setRegeneratingOverview(true)
    toast('Generating your health overview… this may take up to 60 seconds', 'info')
    try {
      const res = await fetch('/api/plans/report', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCurrentRow((prev) => prev ? { ...prev, health_report: data.report } : prev)
        toast('Health overview updated!', 'success')
      } else {
        toast(data.error || 'Failed to generate report', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setRegeneratingOverview(false)
    }
  }

  async function handleRegenerateWeekly() {
    setRegeneratingWeekly(true)
    toast('Generating your weekly check-in… this may take up to 30 seconds', 'info')
    try {
      const res = await fetch('/api/plans/weekly-progress', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCurrentRow((prev) => prev ? { ...prev, weekly_progress_report: data.report } : prev)
        toast('Weekly check-in updated!', 'success')
      } else {
        toast(data.error || 'Failed to generate check-in', 'error')
      }
    } catch {
      toast('Something went wrong', 'error')
    } finally {
      setRegeneratingWeekly(false)
    }
  }

  const weekLabel = currentRow
    ? `Week of ${new Date(currentRow.week_start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  const isRegenerating = activeTab === 'weekly' ? regeneratingWeekly : regeneratingOverview

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Health Reports</h1>
            {weekLabel && <p className="text-xs text-text-secondary mt-0.5">{weekLabel}</p>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={activeTab === 'weekly' ? handleRegenerateWeekly : handleRegenerateOverview}
            loading={isRegenerating}
          >
            <RefreshCw size={14} />
            Regenerate
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-secondary rounded-xl p-1">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Weekly Check-in
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Health Overview
          </button>
        </div>

        {/* Past week selector */}
        {pastRows.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {pastRows.map((row) => {
              const label = new Date(row.week_start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const isCurrent = row.week_start_date === currentRow?.week_start_date
              return (
                <button
                  key={row.id}
                  onClick={() => setCurrentRow(row)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isCurrent
                      ? 'bg-accent-primary text-white border-accent-primary'
                      : 'bg-white text-text-secondary border-vitalia-border hover:border-accent-primary'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <Card><Skeleton lines={8} /></Card>
        ) : activeTab === 'weekly' ? (
          currentRow?.weekly_progress_report ? (
            <ReportCard content={currentRow.weekly_progress_report} />
          ) : (
            <EmptyState onGenerate={handleRegenerateWeekly} loading={regeneratingWeekly} label="Weekly Check-in" />
          )
        ) : (
          currentRow?.health_report ? (
            <>
              <ReportCard content={currentRow.health_report} />
              <div className="bg-accent-coral/20 rounded-xl p-4 text-xs text-text-secondary leading-relaxed">
                <strong>Medical Disclaimer:</strong> This report is generated by AI for informational purposes only and should not be considered medical advice. Always consult with a qualified healthcare provider before making changes to your diet, exercise routine, or health regimen.
              </div>
            </>
          ) : (
            <EmptyState onGenerate={handleRegenerateOverview} loading={regeneratingOverview} label="Health Overview" />
          )
        )}
      </div>
    </AppShell>
  )
}

function ReportCard({ content }: { content: string }) {
  return (
    <Card>
      <div className="prose prose-sm max-w-none text-text-primary [&_h2]:text-accent-primary [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-accent-primary/30 [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-text-secondary [&_p]:leading-relaxed [&_ul]:text-text-secondary [&_li]:leading-relaxed [&_strong]:text-text-primary [&_strong]:font-semibold">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </Card>
  )
}
