import { callOpenRouter } from '@/lib/openrouter'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return Response.json({ error: 'No ingredients provided' }, { status: 400 })
    }

    console.log('[grocery] aggregating', ingredients.length, 'ingredient lines')

    const prompt = `You are a grocery shopping assistant. Below is a raw list of ingredient lines from a 7-day meal plan (in recipe quantities like "1/2 tsp cumin", "2 tbsp olive oil").

Convert this into a real-world shopping list — the kind you'd actually use at a grocery store. Think in terms of what you BUY, not what you measure.

CONVERSION RULES (follow strictly):
1. PRODUCE & FRESH HERBS: Use whole units ("3 bell peppers", "1 bunch cilantro", "2 lbs carrots", "4 medium tomatoes", "1 bulb garlic", "2 medium onions", "1 lemon")
2. PROTEINS — fresh meat/fish: Convert to store weights ("1.5 lbs chicken breast", "1 lb salmon fillet"); canned ("2 cans chickpeas (15 oz each)"); dry legumes ("1 lb dry lentils")
3. OILS & LIQUID PANTRY (olive oil, sesame oil, coconut oil, vinegar, soy sauce, tamari, fish sauce, hot sauce): ALWAYS write "1 bottle" — never a recipe amount
4. SPICES & DRIED HERBS (cumin, turmeric, paprika, cinnamon, oregano, thyme, etc.): ALWAYS write "1 jar" — never "1/2 tsp"
5. GRAINS & DRY GOODS (rice, quinoa, oats, pasta, flour): Use standard bag sizes ("Brown rice - 1 bag (2 lb)", "Rolled oats - 1 canister")
6. NUTS, SEEDS, NUT BUTTERS: Nuts/seeds → "1 bag"; nut butters → "1 jar"
7. DAIRY & ALTERNATIVES (milk, almond milk, oat milk, yogurt, cheese, butter): Use standard cartons/containers ("Almond milk - 1 carton (32 oz)", "Greek yogurt - 1 container", "Butter - 1 stick")
8. CONDIMENTS (tahini, almond butter, maple syrup, honey, mustard, salsa): ALWAYS "1 jar" or "1 bottle"
9. FROZEN items: "1 bag frozen [item]"
10. COMBINE duplicates: if chicken breast appears in 5 meals at varying amounts, add it up and round to nearest 0.5 lb
11. OMIT: water, table salt, black pepper, cooking spray (universally stocked pantry items)
12. DO NOT list recipe amounts for pantry/spice items under any circumstance

INGREDIENT LINES FROM MEAL PLAN:
${ingredients.join('\n')}

Return ONLY valid JSON (no markdown, no backticks):
{
  "sections": [
    {
      "title": "PRODUCE",
      "emoji": "🥦",
      "items": ["Spinach, fresh - 1 bunch", "Bell peppers - 3 whole", "Carrots - 2 lbs"]
    },
    {
      "title": "PROTEINS",
      "emoji": "🥩",
      "items": ["Chicken breast, boneless - 1.5 lbs", "Salmon fillet - 1 lb"]
    },
    {
      "title": "DAIRY & ALTERNATIVES",
      "emoji": "🥛",
      "items": ["Almond milk, unsweetened - 1 carton (32 oz)"]
    },
    {
      "title": "PANTRY & GRAINS",
      "emoji": "🌾",
      "items": ["Brown rice - 1 bag (2 lb)", "Rolled oats - 1 canister", "Olive oil - 1 bottle"]
    },
    {
      "title": "SPICES & SEASONINGS",
      "emoji": "🧂",
      "items": ["Ground cumin - 1 jar", "Turmeric - 1 jar", "Curry powder - 1 jar"]
    },
    {
      "title": "FROZEN",
      "emoji": "❄️",
      "items": ["Mixed berries - 1 bag", "Edamame - 1 bag"]
    },
    {
      "title": "CONDIMENTS & SAUCES",
      "emoji": "🫙",
      "items": ["Almond butter - 1 jar", "Tamari sauce - 1 bottle", "Tahini - 1 jar"]
    }
  ]
}

Only include sections that have at least one item. Sort items alphabetically within each section.`

    const { text } = await callOpenRouter([{ role: 'user', content: prompt }], 2048)

    if (!text) {
      console.error('[grocery] model returned no text')
      return Response.json({ error: 'Failed to generate grocery list' }, { status: 500 })
    }

    try {
      const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const match = stripped.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found')
      const result = JSON.parse(match[0])
      console.log('[grocery] sections generated:', result.sections?.length, '| items total:', result.sections?.reduce((acc: number, s: { items: string[] }) => acc + s.items.length, 0))
      return Response.json(result)
    } catch (e) {
      console.error('[grocery] parse error:', (e as Error).message, '\nRaw:', text.slice(0, 400))
      return Response.json({ error: 'Failed to parse grocery list' }, { status: 500 })
    }
  } catch (error) {
    console.error('[grocery] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
