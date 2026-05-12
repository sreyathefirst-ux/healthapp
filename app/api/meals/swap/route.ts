import { callOpenRouter } from '@/lib/openrouter'
import { buildMealSwapPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { Meal } from '@/types'

// ── JSON extraction — tries multiple strategies in order ───────────────────
function extractJSONArray(text: string): unknown[] {
  const strategies: Array<{ name: string; fn: () => unknown[] }> = [
    {
      name: 'direct-parse',
      fn: () => {
        const t = text.trim()
        if (!t.startsWith('[')) throw new Error('does not start with [')
        return JSON.parse(t)
      },
    },
    {
      name: 'markdown-code-block',
      fn: () => {
        // Handles ```json\n[...]\n``` anywhere in the text
        const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        if (!m) throw new Error('no code block')
        return JSON.parse(m[1].trim())
      },
    },
    {
      name: 'first-bracket-to-last-bracket',
      fn: () => {
        const start = text.indexOf('[')
        const end = text.lastIndexOf(']')
        if (start === -1 || end <= start) throw new Error('no brackets found')
        return JSON.parse(text.slice(start, end + 1))
      },
    },
    {
      name: 'first-object-array-regex',
      fn: () => {
        // Find [{...}] pattern — greedy match from first [{ to last }]
        const start = text.indexOf('[{')
        const end = text.lastIndexOf('}]')
        if (start === -1 || end === -1) throw new Error('no [{ }] pattern')
        return JSON.parse(text.slice(start, end + 2))
      },
    },
  ]

  const errors: string[] = []
  for (const strategy of strategies) {
    try {
      const result = strategy.fn()
      if (Array.isArray(result) && result.length > 0) {
        console.log('[swap] extractJSONArray: succeeded with strategy:', strategy.name, '| items:', result.length)
        return result
      }
      errors.push(`${strategy.name}: returned empty array`)
    } catch (e) {
      errors.push(`${strategy.name}: ${(e as Error).message}`)
    }
  }

  throw new Error(`All strategies failed — ${errors.join(' | ')}`)
}

export async function POST(req: Request) {
  console.log('[meals/swap] === START ===')
  try {
    // ── Step 1: parse request ──────────────────────────────────────────────
    const body = await req.json()
    const { meal, mealType, day, feedback } = body
    console.log('[meals/swap] meal being swapped:', (meal as Record<string, unknown>)?.name ?? '(missing)')
    console.log('[meals/swap] mealType:', mealType, '| day:', day, '| feedback:', feedback ?? '(none)')

    if (!meal || !mealType) {
      return Response.json({ error: 'Missing meal or mealType' }, { status: 400 })
    }

    // ── Step 2: authenticate ───────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[meals/swap] auth failed:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[meals/swap] user:', user.id.slice(0, 8))

    // ── Step 3: fetch profile + bloodwork ──────────────────────────────────
    const [profile, { data: bloodwork }] = await Promise.all([
      fetchFullProfile(supabase, user.id),
      supabase.from('bloodwork').select('*').eq('user_id', user.id).limit(20),
    ])

    if (!profile) {
      console.error('[meals/swap] profile not found for', user.id)
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }
    console.log('[meals/swap] profile:', profile.name, '| restrictions:', profile.food_preferences?.restrictions?.join(', ') || 'none')
    console.log('[meals/swap] bloodwork markers:', bloodwork?.length ?? 0)

    // ── Step 4: build prompt ───────────────────────────────────────────────
    // No system prompt — a long system prompt triggers heavy thinking that eats the output
    // token budget (thinking + output share the same maxOutputTokens pool in Gemini 2.5 Flash).
    // Allergies/restrictions are already embedded directly in the swap prompt.
    const swapPrompt = buildMealSwapPrompt(
      meal as Record<string, unknown>,
      mealType,
      feedback,
      profile  // pass profile so prompt can embed constraints inline
    )
    console.log('[meals/swap] swap prompt:', swapPrompt.length, 'chars')
    console.log('[meals/swap] swap prompt full:')
    console.log(swapPrompt)

    // ── Step 5: call Gemini ────────────────────────────────────────────────
    // 16000 tokens: thinking uses ~3-4k, leaving 12k+ for the JSON response
    console.log('[meals/swap] calling Gemini API...')
    let rawText: string | null
    try {
      const result = await callOpenRouter(
        [{ role: 'user', content: swapPrompt }],
        16000,
        'meals/swap',
        { responseMimeType: 'application/json' }
      )
      rawText = result.text
      console.log('[meals/swap] Gemini stopReason:', result.stopReason)
    } catch (apiErr) {
      console.error('[meals/swap] Gemini API threw:', apiErr)
      return Response.json({ error: 'Gemini API call failed', details: (apiErr as Error).message }, { status: 502 })
    }

    if (!rawText) {
      console.error('[meals/swap] Gemini returned null — thinking-token issue or safety filter')
      return Response.json({ error: 'Gemini returned no text' }, { status: 500 })
    }

    console.log('[meals/swap] Gemini raw response (first 500 chars):')
    console.log(rawText.slice(0, 500))
    if (rawText.length > 500) {
      console.log('[meals/swap] ... (' + rawText.length + ' chars total)')
    }

    // ── Step 6: extract JSON ───────────────────────────────────────────────
    console.log('[meals/swap] extracting JSON array...')
    let parsed: unknown[]
    try {
      parsed = extractJSONArray(rawText)
      console.log('[meals/swap] extracted JSON:', JSON.stringify(parsed).slice(0, 300))
    } catch (extractErr) {
      console.error('[meals/swap] JSON extraction failed:', (extractErr as Error).message)
      console.error('[meals/swap] full raw response:')
      console.error(rawText)
      return Response.json({
        error: 'No JSON array found in model response',
        details: (extractErr as Error).message,
        rawResponse: rawText.slice(0, 800),
      }, { status: 500 })
    }

    // ── Step 7: normalise fields ───────────────────────────────────────────
    const alternatives: Meal[] = (parsed as Meal[]).slice(0, 3).map((alt, i) => ({
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

    console.log('[meals/swap] parsed alternatives:', alternatives.map((a) => a.name))
    console.log('[meals/swap] === DONE ===')
    return Response.json({ alternatives })
  } catch (error) {
    console.error('[meals/swap] unhandled error:', error)
    return Response.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 })
  }
}
