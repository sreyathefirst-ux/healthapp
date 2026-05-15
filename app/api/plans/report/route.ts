import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter, MODEL } from '@/lib/openrouter'
import { buildHealthReportPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

export async function POST(_req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const { data: latestDateRow } = await supabase
      .from('bloodwork')
      .select('upload_date')
      .eq('user_id', user.id)
      .order('upload_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const latestDate = latestDateRow?.upload_date ?? null

    const [{ data: bloodwork }, { data: prevDateRow }] = await Promise.all([
      latestDate
        ? supabase.from('bloodwork').select('*').eq('user_id', user.id).eq('upload_date', latestDate)
        : Promise.resolve({ data: [] }),
      latestDate
        ? supabase.from('bloodwork').select('upload_date').eq('user_id', user.id)
            .lt('upload_date', latestDate)
            .order('upload_date', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const prevDate = (prevDateRow as { upload_date?: string } | null)?.upload_date ?? null
    const { data: prevBloodwork } = prevDate
      ? await supabase.from('bloodwork').select('*').eq('user_id', user.id).eq('upload_date', prevDate)
      : { data: [] }

    const bw = bloodwork || []
    const flaggedCount = bw.filter((b) => b.is_flagged).length
    console.log('[report] generating for', user.id, '—', bw.length, 'markers,', flaggedCount, 'flagged', prevDate ? `| prev: ${prevDate}` : '| no prev')

    const systemPrompt = buildSystemPrompt(profile, bw)
    const reportPrompt = buildHealthReportPrompt(profile, bw, prevBloodwork || [])
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
