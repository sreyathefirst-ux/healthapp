import { callOpenRouter } from '@/lib/openrouter'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { Meal } from '@/types'

function extractJSONObject(text: string): unknown {
  // Find top-level { ... } (not an array)
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No { found in response')

  // Walk to find matching closing brace
  let depth = 0
  let end = -1
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error('No matching } found')
  return JSON.parse(text.slice(start, end + 1))
}

export async function POST(req: Request) {
  console.log('[meals/replace] === START ===')
  try {
    const body = await req.json()
    const { type, mealType, recipeName, notes, restaurant, mealName } = body

    if (!type || !mealType) {
      return Response.json({ error: 'Missing type or mealType' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[meals/replace] auth failed:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }

    const allergies = profile.food_preferences?.allergies?.join(', ') || 'none'
    const restrictions = profile.food_preferences?.restrictions?.join(', ') || 'none'
    const conditions = profile.medical_profile?.conditions?.join(', ') || 'none'

    let prompt: string

    if (type === 'recipe') {
      if (!recipeName) {
        return Response.json({ error: 'Missing recipeName for recipe type' }, { status: 400 })
      }
      prompt = `The user is logging their own recipe as a replacement for their planned ${mealType}. Recipe: '${recipeName}'. ${notes ? 'Notes: ' + notes : ''}. User allergies: ${allergies}. Dietary restrictions: ${restrictions}. Conditions: ${conditions}. Generate a realistic Meal JSON object estimating nutritional values. Return ONLY a single JSON object (not an array) with fields: id (uuid), name (use exactly '${recipeName}'), description, reasoning, calories, protein_g, carbs_g, fat_g, fiber_g, ingredients (array with quantities), image_url (null), image_prompt (watercolor illustration style).`
    } else if (type === 'takeout') {
      if (!restaurant || !mealName) {
        return Response.json({ error: 'Missing restaurant or mealName for takeout type' }, { status: 400 })
      }
      prompt = `The user had takeout from ${restaurant} and ordered '${mealName}'. Estimate nutritional content of this real restaurant item. Return ONLY a single JSON object with fields: id (uuid), name ('${mealName} from ${restaurant}'), description, reasoning, calories, protein_g, carbs_g, fat_g, fiber_g, ingredients (estimated), image_url (null), image_prompt.`
    } else {
      return Response.json({ error: 'Invalid type' }, { status: 400 })
    }

    console.log('[meals/replace] type:', type, '| mealType:', mealType)
    console.log('[meals/replace] calling Gemini API...')

    let rawText: string | null
    try {
      const result = await callOpenRouter(
        [{ role: 'user', content: prompt }],
        4096,
        'meals/replace',
        { responseMimeType: 'application/json' }
      )
      rawText = result.text
      console.log('[meals/replace] Gemini stopReason:', result.stopReason)
    } catch (apiErr) {
      console.error('[meals/replace] Gemini API threw:', apiErr)
      return Response.json({ error: 'Gemini API call failed', details: (apiErr as Error).message }, { status: 502 })
    }

    if (!rawText) {
      return Response.json({ error: 'Gemini returned no text' }, { status: 500 })
    }

    console.log('[meals/replace] raw response (first 500 chars):', rawText.slice(0, 500))

    let parsed: Record<string, unknown>
    try {
      parsed = extractJSONObject(rawText) as Record<string, unknown>
    } catch (extractErr) {
      console.error('[meals/replace] JSON extraction failed:', (extractErr as Error).message)
      return Response.json({
        error: 'No JSON object found in model response',
        details: (extractErr as Error).message,
        rawResponse: rawText.slice(0, 800),
      }, { status: 500 })
    }

    const meal: Meal = {
      id: (parsed.id as string) || `replace-${Date.now()}`,
      name: (parsed.name as string) || (type === 'recipe' ? recipeName : `${mealName} from ${restaurant}`),
      description: (parsed.description as string) || '',
      reasoning: (parsed.reasoning as string) || '',
      calories: Number(parsed.calories) || 0,
      protein_g: Number(parsed.protein_g) || 0,
      carbs_g: Number(parsed.carbs_g) || 0,
      fat_g: Number(parsed.fat_g) || 0,
      fiber_g: Number(parsed.fiber_g) || 0,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      image_url: null,
      image_prompt: (parsed.image_prompt as string) || `A hand-drawn watercolor illustration of ${parsed.name || 'meal'}, Great British Baking Show style`,
    }

    console.log('[meals/replace] generated meal:', meal.name)
    console.log('[meals/replace] === DONE ===')
    return Response.json({ meal })
  } catch (error) {
    console.error('[meals/replace] unhandled error:', error)
    return Response.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 })
  }
}
