import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { MEAL_PLAN_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { MealPlan } from '@/types'

const REQUIRED_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function extractJson(text: string): unknown {
  // 1. Direct parse
  try { return JSON.parse(text.trim()) } catch { /* continue */ }
  // 2. Strip markdown fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }
  // 3. Greedy brace match — extracts first { to last }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('No valid JSON found in response')
}

function validatePlan(plan: unknown): { valid: boolean; missingDays: string[] } {
  if (!plan || typeof plan !== 'object') return { valid: false, missingDays: REQUIRED_DAYS }
  const p = plan as Record<string, unknown>
  if (!p.days || typeof p.days !== 'object') return { valid: false, missingDays: REQUIRED_DAYS }
  const days = p.days as Record<string, unknown>
  const missingDays = REQUIRED_DAYS.filter((d) => !days[d] || typeof days[d] !== 'object')
  return { valid: missingDays.length === 0, missingDays }
}

// Compact prompt for retry — shorter per-meal structure to avoid truncation
const COMPACT_MEAL_PROMPT = `Generate a 7-day meal plan. Return ONLY valid JSON. No markdown, no explanation.
Use this compact structure with all 7 days (monday through sunday):
{
  "week_start_date": "YYYY-MM-DD",
  "days": {
    "monday": {
      "breakfast": { "id": "uid1", "name": "Oatmeal", "description": "...", "reasoning": "...", "calories": 350, "protein_g": 12, "carbs_g": 60, "fat_g": 7, "fiber_g": 5, "ingredients": ["oats","milk"], "image_url": null, "image_prompt": "watercolor sketch of oatmeal bowl" },
      "lunch": { "id": "uid2", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": [], "image_url": null, "image_prompt": "..." },
      "dinner": { "id": "uid3", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": [], "image_url": null, "image_prompt": "..." },
      "snack": { "id": "uid4", "name": "...", "description": "...", "reasoning": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "ingredients": [], "image_url": null, "image_prompt": "..." }
    },
    "tuesday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "wednesday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "thursday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "friday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "saturday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} },
    "sunday": { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} }
  }
}
CRITICAL: ALL 7 days must be fully populated. Respect all allergies. Keep descriptions brief (1 sentence). Keep reasoning brief (1 sentence).`

async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
  const block = response.content.find((c) => c.type === 'text')
  const text = block?.type === 'text' ? block.text : null
  return { text, stopReason: response.stop_reason, usage: response.usage }
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

    console.log('[meal plan] generating for user', user.id, {
      name: profile.name || '(empty)',
      age: profile.age,
      restrictions: profile.food_preferences.restrictions,
      allergies: profile.food_preferences.allergies,
    })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    const weekStart = getWeekStartDate()
    console.log('[meal plan] weekStart =', weekStart, '| system prompt', systemPrompt.length, 'chars')

    // ── Attempt 1: full detailed prompt ──────────────────────────────────────
    const userMessage = `${MEAL_PLAN_PROMPT}\n\nThe week_start_date should be: ${weekStart}`
    console.log('[meal plan] attempt 1 — calling Claude max_tokens=16000')

    let plan: MealPlan | null = null
    let rawText: string | null = null

    const attempt1 = await callClaude(systemPrompt, userMessage, 16000)
    rawText = attempt1.text
    console.log('[meal plan] attempt 1 stop_reason:', attempt1.stopReason, '| tokens:', JSON.stringify(attempt1.usage))

    if (attempt1.stopReason === 'max_tokens') {
      console.warn('[meal plan] TRUNCATED at max_tokens — will use compact prompt on retry')
    }

    if (rawText) {
      console.log('[meal plan] raw response length:', rawText.length, 'chars')
      console.log('[meal plan] raw first 300:', rawText.slice(0, 300))
      console.log('[meal plan] raw last 200:', rawText.slice(-200))
      try {
        plan = extractJson(rawText) as MealPlan
        const { valid, missingDays } = validatePlan(plan)
        if (!valid) {
          console.warn('[meal plan] attempt 1 plan missing days:', missingDays)
          console.warn('[meal plan] days present:', plan?.days ? Object.keys(plan.days) : 'none')
          plan = null // force retry
        } else {
          console.log('[meal plan] attempt 1 plan valid — days:', Object.keys(plan.days))
        }
      } catch (e) {
        console.error('[meal plan] attempt 1 JSON parse error:', e)
        console.error('[meal plan] raw last 500:', rawText.slice(-500))
        plan = null
      }
    }

    // ── Attempt 2: compact prompt (shorter per-meal structure) ────────────────
    if (!plan) {
      console.log('[meal plan] attempt 2 — compact prompt, max_tokens=16000')
      const attempt2 = await callClaude(
        systemPrompt,
        `${COMPACT_MEAL_PROMPT}\n\nThe week_start_date should be: ${weekStart}`,
        16000
      )
      rawText = attempt2.text
      console.log('[meal plan] attempt 2 stop_reason:', attempt2.stopReason, '| tokens:', JSON.stringify(attempt2.usage))

      if (rawText) {
        console.log('[meal plan] attempt 2 raw length:', rawText.length)
        console.log('[meal plan] attempt 2 raw first 300:', rawText.slice(0, 300))
        try {
          plan = extractJson(rawText) as MealPlan
          const { valid, missingDays } = validatePlan(plan)
          if (!valid) {
            console.error('[meal plan] attempt 2 plan STILL missing days:', missingDays)
            console.error('[meal plan] days present:', plan?.days ? Object.keys(plan.days) : 'none')
            return Response.json({ error: `Meal plan generated but missing days: ${missingDays.join(', ')}` }, { status: 500 })
          }
          console.log('[meal plan] attempt 2 plan valid — days:', Object.keys(plan.days))
        } catch (e) {
          console.error('[meal plan] attempt 2 JSON parse error:', e)
          console.error('[meal plan] attempt 2 raw:', rawText.slice(0, 1000))
          return Response.json({ error: 'Failed to parse meal plan JSON' }, { status: 500 })
        }
      } else {
        console.error('[meal plan] attempt 2 returned no text')
        return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
      }
    }

    if (!plan) {
      return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
    }

    // Normalize day keys to lowercase before saving
    const normalizedDays: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(plan.days as Record<string, unknown>)) {
      normalizedDays[k.toLowerCase()] = v
    }
    plan = { ...plan, days: normalizedDays } as MealPlan

    // ── Save ──────────────────────────────────────────────────────────────────
    console.log('[meal plan] saving to Supabase — week:', weekStart, 'days:', Object.keys(plan.days))
    const { error: saveError, data: savedRow } = await supabase.from('weekly_plans').upsert(
      {
        user_id: user.id,
        week_start_date: weekStart,
        meal_plan: plan,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start_date' }
    ).select('id, week_start_date')

    if (saveError) {
      console.error('[meal plan] SAVE ERROR code:', saveError.code)
      console.error('[meal plan] SAVE ERROR message:', saveError.message)
      console.error('[meal plan] SAVE ERROR details:', saveError.details)
      console.error('[meal plan] SAVE ERROR hint:', saveError.hint)
      return Response.json({ error: `Save failed: ${saveError.message}` }, { status: 500 })
    }

    console.log('[meal plan] saved OK — row:', JSON.stringify(savedRow))

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
          body: JSON.stringify({ mealId: meal.id, mealName: meal.name, imagePrompt: meal.image_prompt }),
        }).catch(() => {})
      }
    }
  }
}
