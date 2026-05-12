import { createClient } from '@/lib/supabase/server'
import * as fal from '@fal-ai/serverless-client'

fal.config({ credentials: process.env.FAL_KEY })

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

export async function POST(req: Request) {
  try {
    const { mealId, mealName, imagePrompt, weekStartDate } = await req.json()
    const weekStart = weekStartDate || getWeekStartDate()

    console.log('[images/meal] mealId:', mealId, '| mealName:', mealName, '| week:', weekStart, '| FAL_KEY present:', !!process.env.FAL_KEY)

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[images/meal] 401 — authErr:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prompt = imagePrompt ||
      `A hand-drawn watercolor illustration of ${mealName}, rendered in fine liner pen with loose watercolor fill, in the style of The Great British Baking Show recipe cards. Show a close-up view with warm, rich colors on a sketchbook paper texture background. Artistic and food-forward, no photography.`

    // Generate image via fal.ai flux/schnell
    let imageUrl: string
    try {
      const result = await fal.run('fal-ai/flux/schnell', {
        input: { prompt, image_size: 'square_hd', num_images: 1 },
      }) as { images: Array<{ url: string }> }

      imageUrl = result.images?.[0]?.url
      if (!imageUrl) throw new Error('No image URL in fal.ai response')
      console.log('[images/meal] fal.ai image generated:', imageUrl.slice(0, 80))
    } catch (falErr) {
      console.error('[images/meal] fal.ai error:', falErr)
      return Response.json({ error: 'Image generation failed' }, { status: 500 })
    }

    // Download the image and upload to Supabase Storage for persistence
    let storedUrl = imageUrl
    try {
      const imageRes = await fetch(imageUrl)
      const imageBuffer = await imageRes.arrayBuffer()
      const fileName = `${user.id}/${mealId}.jpg`
      const { error: uploadErr } = await supabase.storage.from('meal-images').upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (uploadErr) {
        console.warn('[images/meal] storage upload failed (using fal URL directly):', uploadErr.message)
      } else {
        const { data: pub } = supabase.storage.from('meal-images').getPublicUrl(fileName)
        storedUrl = pub.publicUrl
      }
    } catch (storageErr) {
      console.warn('[images/meal] storage step failed (using fal URL directly):', storageErr)
    }

    // Update the meal's image_url inside weekly_plans for this specific week
    try {
      const { data: row } = await supabase
        .from('weekly_plans')
        .select('meal_plan')
        .eq('user_id', user.id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (row?.meal_plan) {
        const plan = row.meal_plan as Record<string, unknown>
        updateMealImageUrl(plan, mealId, storedUrl)
        await supabase
          .from('weekly_plans')
          .update({ meal_plan: plan })
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart)
        console.log('[images/meal] updated weekly_plans for week', weekStart)
      }
    } catch (dbErr) {
      console.warn('[images/meal] weekly_plans update failed (non-fatal):', dbErr)
    }

    return Response.json({ image_url: storedUrl })
  } catch (error) {
    console.error('[images/meal] unhandled error:', error)
    return Response.json({ error: 'Image generation failed' }, { status: 500 })
  }
}

function updateMealImageUrl(plan: Record<string, unknown>, mealId: string, imageUrl: string) {
  const days = plan.days as Record<string, Record<string, Record<string, unknown>>> | undefined
  if (!days) return
  for (const day of Object.values(days)) {
    for (const meal of Object.values(day)) {
      if (meal?.id === mealId) {
        meal.image_url = imageUrl
      }
    }
  }
}
