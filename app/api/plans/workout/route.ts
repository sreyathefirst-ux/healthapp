import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { WORKOUT_PLAN_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { WorkoutPlan } from '@/types'

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

    const fullPrompt = WORKOUT_PLAN_PROMPT.replace(
      '${workout_preferences.days_per_week}',
      String(profile.workout_preferences.days_per_week)
    )

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${fullPrompt}\n\nThe week_start_date should be: ${weekStart}`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ error: 'Failed to generate workout plan' }, { status: 500 })
    }

    let plan: WorkoutPlan
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      plan = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ error: 'Failed to parse workout plan JSON' }, { status: 500 })
    }

    await supabase.from('weekly_plans').upsert({
      user_id: user.id,
      week_start_date: weekStart,
      workout_plan: plan,
      generated_at: new Date().toISOString(),
    })

    return Response.json({ success: true, plan })
  } catch (error) {
    console.error('Workout plan generation error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
