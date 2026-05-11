import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter, MODEL } from '@/lib/openrouter'
import { buildHealthReportPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export async function POST(_req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const bw = bloodwork || []
    const flaggedCount = bw.filter((b) => b.is_flagged).length
    console.log('[report] generating for', user.id, '—', bw.length, 'markers,', flaggedCount, 'flagged')

    const systemPrompt = buildSystemPrompt(profile, bw)
    const reportPrompt = buildHealthReportPrompt(profile, bw)
    const weekStart = getWeekStartDate()

    const { text: reportText } = await callOpenRouter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: reportPrompt }],
      8192
    )

    if (!reportText) {
      return Response.json({ error: 'Failed to generate health report' }, { status: 500 })
    }

    const { error: saveError } = await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        health_report: reportText,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    )

    if (saveError) {
      console.error('[report] upsert error:', saveError.message, saveError.details)
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    console.log('[report] saved for week', weekStart, '— chars:', reportText.length)

    return Response.json({ success: true, report: reportText })
  } catch (error) {
    console.error('[report] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
