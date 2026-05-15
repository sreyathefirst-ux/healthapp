import { createClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter'
import { buildWeeklyProgressPrompt } from '@/lib/prompts'
import { fetchFullProfile } from '@/lib/profile'
import { DailyLog, MealPlan, WorkoutPlan } from '@/types'

export const maxDuration = 60

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setUTCDate(diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
  }
}

export async function POST(_req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const { weekStart, weekEnd } = getWeekBounds()

    const [{ data: dailyLogs }, { data: weeklyPlan }] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEnd),
      supabase
        .from('weekly_plans')
        .select('meal_plan, workout_plan')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
        .maybeSingle(),
    ])

    const logs = (dailyLogs ?? []) as DailyLog[]
    const mealPlan = (weeklyPlan?.meal_plan ?? null) as MealPlan | null
    const workoutPlan = (weeklyPlan?.workout_plan ?? null) as WorkoutPlan | null

    console.log('[weekly-progress] generating for', user.id, '—', logs.length, 'days logged for week', weekStart)

    const prompt = buildWeeklyProgressPrompt(profile, logs, mealPlan, workoutPlan, weekStart)

    const { text } = await callOpenRouter(
      [{ role: 'user', content: prompt }],
      4096
    )

    if (!text) return Response.json({ error: 'Failed to generate weekly progress report' }, { status: 500 })

    const { error: saveError } = await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        weekly_progress_report: text,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    )

    if (saveError) {
      console.error('[weekly-progress] upsert error:', saveError.message)
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    console.log('[weekly-progress] saved for week', weekStart, '— chars:', text.length)
    return Response.json({ success: true, report: text })
  } catch (error) {
    console.error('[weekly-progress] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
