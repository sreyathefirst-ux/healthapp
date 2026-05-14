import { createClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter'
import { fetchFullProfile } from '@/lib/profile'
import { UserProfile } from '@/types'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await fetchFullProfile(supabase, user.id)

    // Fetch this week's plan for context
    const today = new Date()
    const dow = today.getDay()
    const diffToMonday = dow === 0 ? -6 : 1 - dow
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() + diffToMonday)
    const weekStartDate = weekStart.toISOString().split('T')[0]

    const { data: weeklyPlan } = await supabase
      .from('weekly_plans')
      .select('meal_plan, workout_plan, health_report')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartDate)
      .maybeSingle()

    const systemPrompt = buildVitaSystemPrompt(profile, weeklyPlan)

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const { text } = await callOpenRouter(apiMessages, 512)

    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 })
    }

    return Response.json({ content: text })
  } catch (err) {
    console.error('[vita/chat] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildVitaSystemPrompt(profile: UserProfile | null, weeklyPlan: unknown): string {
  let prompt = `You are Vita, a warm, knowledgeable AI health companion inside the Vitalia app. You have full access to the user's health profile and weekly plans.

Your personality:
- Warm, encouraging, and supportive — like a knowledgeable friend
- Concise: 2-4 sentences per response unless the user asks for detail
- Evidence-based, personalized to their profile
- Never alarmist; always actionable
- No excessive emoji`

  if (profile) {
    const p = profile
    prompt += `

USER PROFILE:
Name: ${p.name || 'Unknown'}
Age: ${p.age || 'Unknown'}
Height: ${p.height_cm ? `${p.height_cm} cm` : 'Unknown'}
Weight: ${p.weight_kg ? `${p.weight_kg} kg` : 'Unknown'}
Wake time: ${p.routine_preferences?.wake_time || '07:00'}
Sleep time: ${p.routine_preferences?.sleep_time || '23:00'}

Health conditions: ${p.medical_profile?.conditions?.join(', ') || 'None'}
Medications: ${p.medical_profile?.medications?.join(', ') || 'None'}
Supplements: ${p.medical_profile?.supplements?.join(', ') || 'None'}
Health concerns: ${p.medical_profile?.concerns?.join(', ') || 'None'}
Health goals: ${p.medical_profile?.goals?.join(', ') || 'None'}

Diet restrictions: ${p.food_preferences?.restrictions?.join(', ') || 'None'}
Allergies: ${p.food_preferences?.allergies?.join(', ') || 'None'}
Loved cuisines: ${p.food_preferences?.loved_cuisines?.join(', ') || 'None'}

Workout goals: ${p.workout_preferences?.goals?.join(', ') || 'None'}
Activity types: ${p.workout_preferences?.activity_types?.join(', ') || 'None'}
Days per week: ${p.workout_preferences?.days_per_week || 'Unknown'}
Gym access: ${p.workout_preferences?.gym_access ? 'Yes' : 'No'}
Home equipment: ${p.workout_preferences?.home_equipment?.join(', ') || 'None'}`
  }

  if (weeklyPlan?.meal_plan || weeklyPlan?.workout_plan) {
    prompt += `\n\nThe user has an active meal plan and workout plan this week. Reference their plan when answering nutrition or exercise questions.`
  }

  if (weeklyPlan?.health_report) {
    prompt += `\n\nLatest health report summary: ${String(weeklyPlan.health_report).slice(0, 400)}`
  }

  prompt += `

When the user asks health questions outside your scope, recommend consulting a healthcare provider. Keep responses conversational. Never fabricate information not in the profile.`

  return prompt
}
