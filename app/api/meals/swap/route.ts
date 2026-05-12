import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter } from '@/lib/openrouter'
import { buildMealSwapPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { Meal } from '@/types'

export async function POST(req: Request) {
  try {
    // ── Step 1: parse request ──────────────────────────────────────────────
    const body = await req.json()
    const { meal, mealType, day, feedback } = body
    console.log('[swap] Step 1 — request received')
    console.log('[swap]   meal name:', (meal as Record<string, unknown>)?.name ?? '(missing)')
    console.log('[swap]   mealType:', mealType, '| day:', day)
    console.log('[swap]   feedback:', feedback ?? '(none)')

    if (!meal || !mealType) {
      console.error('[swap] missing required fields — meal or mealType is null')
      return Response.json({ error: 'Missing meal or mealType in request body' }, { status: 400 })
    }

    // ── Step 2: authenticate ───────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    console.log('[swap] Step 2 — auth:', user ? `user ${user.id.slice(0, 8)}` : `FAILED (${authErr?.message})`)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Step 3: fetch profile ──────────────────────────────────────────────
    console.log('[swap] Step 3 — fetching user profile...')
    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) {
      console.error('[swap] profile not found for user', user.id)
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }
    console.log('[swap]   profile loaded — name:', profile.name, '| restrictions:', profile.food_preferences?.restrictions)

    // ── Step 4: fetch bloodwork ────────────────────────────────────────────
    const { data: bloodwork, error: bwErr } = await supabase
      .from('bloodwork').select('*').eq('user_id', user.id).limit(20)
    console.log('[swap] Step 4 — bloodwork:', bloodwork?.length ?? 0, 'markers', bwErr ? `| ERROR: ${bwErr.message}` : '')

    // ── Step 5: build prompts ──────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    const swapPrompt = buildMealSwapPrompt(meal as Record<string, unknown>, mealType, feedback)
    console.log('[swap] Step 5 — prompts built')
    console.log('[swap]   system prompt length:', systemPrompt.length, 'chars')
    console.log('[swap]   swap prompt length:', swapPrompt.length, 'chars')
    console.log('[swap]   swap prompt preview:', swapPrompt.slice(0, 200))

    // ── Step 6: call Gemini ────────────────────────────────────────────────
    console.log('[swap] Step 6 — calling Gemini API (max 4096 tokens)...')
    let swapText: string | null
    try {
      const result = await callOpenRouter(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: swapPrompt }],
        4096
      )
      swapText = result.text
      console.log('[swap]   Gemini stopReason:', result.stopReason)
      console.log('[swap]   Gemini text null?', swapText === null)
      if (swapText) {
        console.log('[swap]   Gemini raw text (first 400 chars):', swapText.slice(0, 400))
      }
    } catch (apiErr) {
      console.error('[swap] Gemini API call threw:', apiErr)
      return Response.json({
        error: 'Gemini API call failed',
        details: (apiErr as Error).message,
      }, { status: 502 })
    }

    if (!swapText) {
      console.error('[swap] Gemini returned null/empty text — likely all thinking tokens, no actual response')
      return Response.json({
        error: 'Gemini returned no text',
        details: 'The model produced no output. This may be a thinking-token issue or a prompt that triggered a safety filter.',
      }, { status: 500 })
    }

    // ── Step 7: parse JSON ─────────────────────────────────────────────────
    console.log('[swap] Step 7 — parsing JSON from response...')
    let alternatives: Meal[]
    try {
      // Strip markdown fences if present
      const stripped = swapText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()

      console.log('[swap]   stripped text starts with:', stripped.slice(0, 50))

      const jsonMatch = stripped.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.error('[swap]   No JSON array found. Full stripped response:')
        console.error(stripped.slice(0, 1000))
        return Response.json({
          error: 'No JSON array in model response',
          rawResponse: stripped.slice(0, 800),
        }, { status: 500 })
      }

      const parsed: Meal[] = JSON.parse(jsonMatch[0])
      console.log('[swap]   parsed', parsed.length, 'items from JSON array')

      // Normalise — ensure every required Meal field has a value
      alternatives = parsed.slice(0, 3).map((alt, i) => ({
        id: alt.id || `swap-${Date.now()}-${i}`,
        name: alt.name || 'Alternative meal',
        description: alt.description || '',
        reasoning: alt.reasoning || '',
        calories: Number(alt.calories) || 0,
        protein_g: Number(alt.protein_g) || 0,
        carbs_g: Number(alt.carbs_g) || 0,
        fat_g: Number(alt.fat_g) || 0,
        fiber_g: Number(alt.fiber_g) || 0,
        ingredients: Array.isArray(alt.ingredients) ? alt.ingredients : [],
        image_url: null,
        image_prompt: alt.image_prompt || `A hand-drawn watercolor illustration of ${alt.name || 'meal'}, Great British Baking Show style`,
      }))

      console.log('[swap]   alternatives:', alternatives.map((a) => a.name))
    } catch (parseErr) {
      console.error('[swap]   JSON parse error:', (parseErr as Error).message)
      console.error('[swap]   raw response that failed to parse:', swapText.slice(0, 1000))
      return Response.json({
        error: 'Failed to parse model response as JSON',
        details: (parseErr as Error).message,
        rawResponse: swapText.slice(0, 800),
      }, { status: 500 })
    }

    // ── Step 8: return ─────────────────────────────────────────────────────
    console.log('[swap] Step 8 — returning', alternatives.length, 'alternatives')
    return Response.json({ alternatives })
  } catch (error) {
    console.error('[swap] unhandled error:', error)
    return Response.json({
      error: 'Internal server error',
      details: (error as Error).message,
    }, { status: 500 })
  }
}
