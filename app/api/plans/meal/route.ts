import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { MEAL_PLAN_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { MealPlan } from '@/types'

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) {
      console.error('[meal plan] profile not found for user', user.id)
      return Response.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 })
    }

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
      messages: [
        {
          role: 'user',
          content: `${MEAL_PLAN_PROMPT}\n\nThe week_start_date should be: ${weekStart}`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
    }

    let plan: MealPlan
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in Claude response')
      plan = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('[meal plan] JSON parse error:', parseErr, '\nRaw response:', textContent.text.slice(0, 500))
      return Response.json({ error: 'Failed to parse meal plan JSON' }, { status: 500 })
    }

    // Save to weekly_plans — onConflict ensures UPDATE when row already exists for this week
    const { error: saveError } = await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        meal_plan: plan,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    )

    if (saveError) {
      console.error('[meal plan] upsert error:', saveError)
      return Response.json({ error: saveError.message }, { status: 500 })
    }
    console.log('[meal plan] saved for week', weekStart)

    // Trigger image generation in background (non-blocking)
    triggerMealImageGeneration(plan, user.id).catch(console.error)

    return Response.json({ success: true, plan })
  } catch (error) {
    console.error('Meal plan generation error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function triggerMealImageGeneration(plan: MealPlan, _userId: string) {
  const days = Object.values(plan.days)
  for (const day of days) {
    const meals = [day.breakfast, day.lunch, day.dinner, day.snack]
    for (const meal of meals) {
      if (meal && meal.id && meal.image_prompt) {
        fetch('/api/images/meal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mealId: meal.id,
            mealName: meal.name,
            imagePrompt: meal.image_prompt,
          }),
        }).catch(() => {})
      }
    }
  }
}
