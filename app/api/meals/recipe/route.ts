import { callOpenRouter } from '@/lib/openrouter'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { mealName, ingredients, description } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    console.log('[recipe] generating for:', mealName)

    const prompt = `Generate a complete beginner-friendly recipe for: ${mealName}
Description: ${description || mealName}
Provided ingredients: ${Array.isArray(ingredients) ? ingredients.join(', ') : 'none'}

Return ONLY valid JSON with no markdown, no backticks:
{
  "prep_time_mins": NUMBER,
  "cook_time_mins": NUMBER,
  "servings": NUMBER,
  "ingredients_with_quantities": [
    "2 cups rolled oats",
    "1 tbsp honey",
    "..."
  ],
  "instructions": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ]
}

Rules:
- Instructions must be numbered, clear, and beginner-friendly (assume no cooking experience)
- Ingredients list should have precise quantities for the given servings
- Prep time = hands-on prep before cooking; cook time = time on heat/oven
- Between 6-12 instructions
- Return ONLY the JSON object`

    const { text } = await callOpenRouter([{ role: 'user', content: prompt }], 2048)

    if (!text) {
      console.error('[recipe] model returned no text')
      return Response.json({ error: 'Failed to generate recipe' }, { status: 500 })
    }

    try {
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const match = stripped.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found')
      const recipe = JSON.parse(match[0])
      console.log('[recipe] generated for', mealName, '— steps:', recipe.instructions?.length)
      return Response.json({ recipe })
    } catch (e) {
      console.error('[recipe] parse error:', (e as Error).message, '\nRaw:', text.slice(0, 500))
      return Response.json({ error: 'Failed to parse recipe' }, { status: 500 })
    }
  } catch (error) {
    console.error('[recipe] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
