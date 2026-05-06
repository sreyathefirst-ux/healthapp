import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { HEALTH_REPORT_PROMPT } from '@/lib/prompts'
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

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    const weekStart = getWeekStartDate()

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: HEALTH_REPORT_PROMPT }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ error: 'Failed to generate health report' }, { status: 500 })
    }

    await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        health_report: textContent.text,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    )

    return Response.json({ success: true, report: textContent.text })
  } catch (error) {
    console.error('Health report generation error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
