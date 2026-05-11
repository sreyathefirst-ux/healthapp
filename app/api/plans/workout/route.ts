import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter, MODEL } from '@/lib/openrouter'
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

function extractJson(text: string): unknown {
  try { return JSON.parse(text.trim()) } catch { /* continue */ }
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('No valid JSON found in response')
}

export async function POST(_req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) {
      console.error('[workout plan] profile not found for user', user.id)
      return Response.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 })
    }

    console.log('[workout plan] profile summary for', user.id, {
      name: profile.name || '(empty)',
      age: profile.age || '(empty)',
      workoutGoals: profile.workout_preferences.goals,
      activityTypes: profile.workout_preferences.activity_types,
      daysPerWeek: profile.workout_preferences.days_per_week,
      gymAccess: profile.workout_preferences.gym_access,
      homeEquipment: profile.workout_preferences.home_equipment,
      preferredDurationMins: profile.workout_preferences.preferred_duration_mins,
      conditions: profile.medical_profile.conditions,
    })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    console.log('[workout plan] system prompt length:', systemPrompt.length, 'chars')

    const weekStart = getWeekStartDate()
    const fullPrompt = WORKOUT_PLAN_PROMPT.replace(
      '${workout_preferences.days_per_week}',
      String(profile.workout_preferences.days_per_week)
    )
    const userMessage = `${fullPrompt}\n\nThe week_start_date should be: ${weekStart}`

    let rawText: string | null = null

    const firstResponse = await callOpenRouter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      8192
    )
    rawText = firstResponse.text

    if (!rawText) {
      console.error('[workout plan] model returned no text content')
      return Response.json({ error: 'Failed to generate workout plan' }, { status: 500 })
    }

    let plan: WorkoutPlan | null = null

    try {
      plan = extractJson(rawText) as WorkoutPlan
    } catch (parseErr) {
      console.error('[workout plan] JSON parse failed on first attempt:', parseErr)
      console.error('[workout plan] raw response (first 2000 chars):', rawText.slice(0, 2000))

      console.log('[workout plan] retrying with strict JSON prompt...')
      const retryResponse = await callOpenRouter(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: rawText },
          { role: 'user', content: 'Return ONLY raw JSON. No markdown, no backticks, no explanation, nothing else. Just the JSON object.' },
        ],
        8192
      )
      const retryText = retryResponse.text

      if (!retryText) {
        console.error('[workout plan] retry returned no text')
        return Response.json({ error: 'Failed to generate workout plan JSON' }, { status: 500 })
      }

      try {
        plan = extractJson(retryText) as WorkoutPlan
        console.log('[workout plan] retry JSON parse succeeded')
      } catch (retryParseErr) {
        console.error('[workout plan] retry JSON parse also failed:', retryParseErr)
        console.error('[workout plan] retry raw response (first 2000 chars):', retryText.slice(0, 2000))
        return Response.json({ error: 'Failed to parse workout plan JSON after retry' }, { status: 500 })
      }
    }

    if (!plan) {
      return Response.json({ error: 'Failed to generate workout plan' }, { status: 500 })
    }

    const { error: saveError } = await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        workout_plan: plan,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    )

    if (saveError) {
      console.error('[workout plan] upsert error:', saveError.message, saveError.details)
      return Response.json({ error: saveError.message }, { status: 500 })
    }
    console.log('[workout plan] saved for week', weekStart, '— days:', Object.keys(plan.days || {}).length)

    return Response.json({ success: true, plan })
  } catch (error) {
    console.error('[workout plan] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
