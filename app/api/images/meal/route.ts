import { createClient } from '@/lib/supabase/server'

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`

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

    console.log('[images/meal] === START ===')
    console.log('[images/meal] meal:', mealName, '| id:', mealId, '| week:', weekStart)
    console.log('[images/meal] GOOGLE_AI_KEY present:', !!GOOGLE_AI_KEY)

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[images/meal] 401 — authErr:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prompt = imagePrompt ||
      `A hand-drawn watercolor illustration of ${mealName}, rendered in fine liner pen with loose watercolor fill, in the style of The Great British Baking Show recipe cards. Show a close-up view with warm, rich colors on a sketchbook paper texture background. Artistic and food-forward, no photography.`

    console.log('[images/meal] image prompt (first 120 chars):', prompt.slice(0, 120))
    console.log('[images/meal] calling Gemini image model:', GEMINI_IMAGE_MODEL)

    // Generate image via Gemini 2.5 Flash Image
    let imageBase64: string
    let imageMimeType: string
    try {
      const response = await fetch(`${GEMINI_IMAGE_URL}?key=${GOOGLE_AI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      })

      console.log('[images/meal] Gemini API status:', response.status)

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        console.error('[images/meal] Gemini API error body:', errText.slice(0, 500))
        throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`)
      }

      const data = await response.json()
      console.log('[images/meal] Gemini response candidates:', data.candidates?.length, '| finishReason:', data.candidates?.[0]?.finishReason)

      const parts = data.candidates?.[0]?.content?.parts as Array<{ inlineData?: { mimeType: string; data: string } }> | undefined
      const imagePart = parts?.find((p) => p.inlineData?.data)

      if (!imagePart?.inlineData) {
        console.error('[images/meal] No inlineData in response. Parts:', JSON.stringify(parts?.map(p => Object.keys(p))))
        throw new Error('No image data in Gemini response')
      }

      imageBase64 = imagePart.inlineData.data
      imageMimeType = imagePart.inlineData.mimeType || 'image/png'
      console.log('[images/meal] Gemini image received — mimeType:', imageMimeType, '| base64 length:', imageBase64.length)
    } catch (genErr) {
      console.error('[images/meal] image generation failed:', genErr)
      return Response.json({ error: 'Image generation failed' }, { status: 500 })
    }

    // Convert base64 to Buffer and upload to Supabase Storage
    let storedUrl: string | null = null
    try {
      const ext = imageMimeType.includes('jpeg') || imageMimeType.includes('jpg') ? 'jpg' : 'png'
      const contentType = imageMimeType
      const imageBuffer = Buffer.from(imageBase64, 'base64')
      const fileName = `${user.id}/${mealId}.${ext}`

      console.log('[images/meal] uploading to Supabase Storage — file:', fileName, '| size:', imageBuffer.length, 'bytes')

      const { error: uploadErr } = await supabase.storage.from('meal-images').upload(fileName, imageBuffer, {
        contentType,
        upsert: true,
      })

      if (uploadErr) {
        console.warn('[images/meal] Supabase Storage upload failed:', uploadErr.message, '— will return null image_url')
      } else {
        const { data: pub } = supabase.storage.from('meal-images').getPublicUrl(fileName)
        storedUrl = pub.publicUrl
        console.log('[images/meal] stored at:', storedUrl?.slice(0, 80))
      }
    } catch (storageErr) {
      console.warn('[images/meal] storage step threw:', storageErr)
    }

    if (!storedUrl) {
      console.error('[images/meal] no stored URL — image cannot be served (Storage upload failed)')
      return Response.json({ error: 'Storage upload failed' }, { status: 500 })
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
        const updated = updateMealImageUrl(plan, mealId, storedUrl)
        if (updated) {
          await supabase
            .from('weekly_plans')
            .update({ meal_plan: plan })
            .eq('user_id', user.id)
            .eq('week_start_date', weekStart)
          console.log('[images/meal] weekly_plans updated for week', weekStart)
        } else {
          console.warn('[images/meal] mealId', mealId, 'not found in plan — image_url not saved to DB')
        }
      } else {
        console.warn('[images/meal] no weekly_plans row found for week', weekStart)
      }
    } catch (dbErr) {
      console.warn('[images/meal] weekly_plans update failed (non-fatal):', dbErr)
    }

    console.log('[images/meal] === DONE — returning image_url:', storedUrl.slice(0, 80))
    return Response.json({ image_url: storedUrl })
  } catch (error) {
    console.error('[images/meal] unhandled error:', error)
    return Response.json({ error: 'Image generation failed' }, { status: 500 })
  }
}

function updateMealImageUrl(plan: Record<string, unknown>, mealId: string, imageUrl: string): boolean {
  const days = plan.days as Record<string, Record<string, Record<string, unknown>>> | undefined
  if (!days) return false
  for (const day of Object.values(days)) {
    for (const meal of Object.values(day)) {
      if (meal?.id === mealId) {
        meal.image_url = imageUrl
        return true
      }
    }
  }
  return false
}
