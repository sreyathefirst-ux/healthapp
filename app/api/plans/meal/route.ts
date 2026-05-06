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

function extractJson(text: string): unknown {
  // 1. Try direct parse
  try { return JSON.parse(text.trim()) } catch { /* continue */ }
  // 2. Strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }
  // 3. Greedy brace match
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('No valid JSON found in response')
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

    console.log('[meal plan] profile summary for', user.id, {
      name: profile.name || '(empty)',
      age: profile.age || '(empty)',
      conditions: profile.medical_profile.conditions,
      medications: profile.medical_profile.medications,
      restrictions: profile.food_preferences.restrictions,
      allergies: profile.food_preferences.allergies,
      lovedCuisines: profile.food_preferences.loved_cuisines,
      dislikedFoods: profile.food_preferences.disliked_foods,
      typicalMeals: Object.keys(profile.food_preferences.typical_meals || {}),
    })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    console.log('[meal plan] system prompt length:', systemPrompt.length, 'chars')

    const weekStart = getWeekStartDate()
    const userMessage = `${MEAL_PLAN_PROMPT}\n\nThe week_start_date should be: ${weekStart}`

    let rawText: string | null = null

    const firstResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const firstBlock = firstResponse.content.find((c) => c.type === 'text')
    rawText = firstBlock?.type === 'text' ? firstBlock.text : null

    if (!rawText) {
      console.error('[meal plan] Claude returned no text content')
      return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
    }

    let plan: MealPlan | null = null

    try {
      plan = extractJson(rawText) as MealPlan
    } catch (parseErr) {
      console.error('[meal plan] JSON parse failed on first attempt:', parseErr)
      console.error('[meal plan] raw Claude response (first 2000 chars):', rawText.slice(0, 2000))

      // Retry with stricter prompt
      console.log('[meal plan] retrying with strict JSON prompt...')
      const retryResponse = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: rawText },
          {
            role: 'user',
            content: 'Return ONLY raw JSON. No markdown, no backticks, no explanation, nothing else. Just the JSON object.',
          },
        ],
      })
      const retryBlock = retryResponse.content.find((c) => c.type === 'text')
      const retryText = retryBlock?.type === 'text' ? retryBlock.text : null

      if (!retryText) {
        console.error('[meal plan] retry returned no text')
        return Response.json({ error: 'Failed to generate meal plan JSON' }, { status: 500 })
      }

      try {
        plan = extractJson(retryText) as MealPlan
        console.log('[meal plan] retry JSON parse succeeded')
      } catch (retryParseErr) {
        console.error('[meal plan] retry JSON parse also failed:', retryParseErr)
        console.error('[meal plan] retry raw response (first 2000 chars):', retryText.slice(0, 2000))
        return Response.json({ error: 'Failed to parse meal plan JSON after retry' }, { status: 500 })
      }
    }

    if (!plan) {
      return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
    }

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
      console.error('[meal plan] upsert error:', saveError.message, saveError.details)
      return Response.json({ error: saveError.message }, { status: 500 })
    }
    console.log('[meal plan] saved for week', weekStart, '— days:', Object.keys(plan.days || {}).length)

    triggerMealImageGeneration(plan, user.id).catch(console.error)

    return Response.json({ success: true, plan })
  } catch (error) {
    console.error('[meal plan] unhandled error:', error)
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
