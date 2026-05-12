import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter } from '@/lib/openrouter'
import { buildMealSwapPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { Meal } from '@/types'

export async function POST(req: Request) {
  try {
    const { meal, mealType, day, feedback } = await req.json()
    console.log('[swap] mealType:', mealType, '| day:', day, '| feedback:', feedback ?? '(none)')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const { data: bloodwork } = await supabase
      .from('bloodwork').select('*').eq('user_id', user.id).limit(20)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    const swapPrompt = buildMealSwapPrompt(meal as Record<string, unknown>, mealType, feedback)

    const { text: swapText } = await callOpenRouter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: swapPrompt }],
      4096
    )

    if (!swapText) {
      console.error('[swap] model returned no text')
      return Response.json({ error: 'Failed to generate alternatives' }, { status: 500 })
    }

    console.log('[swap] raw text preview:', swapText.slice(0, 300))

    let alternatives: Meal[]
    try {
      const stripped = swapText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const jsonMatch = stripped.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')
      const parsed: Meal[] = JSON.parse(jsonMatch[0])

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
        image_prompt: alt.image_prompt || `A hand-drawn watercolor illustration of ${alt.name}, Great British Baking Show style`,
      }))
    } catch (e) {
      console.error('[swap] JSON parse error:', (e as Error).message, '\nRaw:', swapText.slice(0, 800))
      return Response.json({ error: 'Failed to parse alternatives' }, { status: 500 })
    }

    console.log('[swap] returning', alternatives.length, 'alternatives')
    return Response.json({ alternatives })
  } catch (error) {
    console.error('[swap] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
