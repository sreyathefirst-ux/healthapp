import { createClient } from '@/lib/supabase/server'
import * as fal from '@fal-ai/serverless-client'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: Request) {
  try {
    const { mealId, mealName, imagePrompt } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Generate image via fal.ai
    const result = await fal.run('fal-ai/flux/schnell', {
      input: {
        prompt: imagePrompt || `A beautiful watercolor sketchbook illustration of ${mealName}, Great British Baking Show style, hand-drawn, soft pastel colors, food styling`,
        image_size: 'square_hd',
        num_images: 1,
      },
    }) as { images: Array<{ url: string }> }

    const imageUrl = result.images?.[0]?.url
    if (!imageUrl) {
      return Response.json({ error: 'Image generation failed' }, { status: 500 })
    }

    // Download and upload to Supabase Storage
    const imageRes = await fetch(imageUrl)
    const imageBuffer = await imageRes.arrayBuffer()
    const fileName = `${user.id}/${mealId}.jpg`

    await supabase.storage.from('meal-images').upload(fileName, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

    const { data: publicUrl } = supabase.storage.from('meal-images').getPublicUrl(fileName)

    // Update the meal in the weekly plan with the image URL
    const { data: weeklyPlan } = await supabase
      .from('weekly_plans')
      .select('meal_plan')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .single()

    if (weeklyPlan?.meal_plan) {
      const plan = weeklyPlan.meal_plan as Record<string, unknown>
      updateMealImageUrl(plan, mealId, publicUrl.publicUrl)
      await supabase
        .from('weekly_plans')
        .update({ meal_plan: plan })
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false })
        .limit(1)
    }

    return Response.json({ image_url: publicUrl.publicUrl })
  } catch (error) {
    console.error('Image generation error:', error)
    return Response.json({ error: 'Image generation failed' }, { status: 500 })
  }
}

function updateMealImageUrl(plan: Record<string, unknown>, mealId: string, imageUrl: string) {
  const days = plan.days as Record<string, Record<string, Record<string, unknown>>>
  if (!days) return
  for (const day of Object.values(days)) {
    for (const meal of Object.values(day)) {
      if (meal && meal.id === mealId) {
        meal.image_url = imageUrl
      }
    }
  }
}
