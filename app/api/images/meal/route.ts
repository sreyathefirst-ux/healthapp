import { createClient, createServiceClient } from '@/lib/supabase/server'

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY
const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`
const BUCKET = 'meal-images'

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  now.setUTCDate(diff)
  return now.toISOString().split('T')[0]
}

async function ensureBucketPublic(supabaseAdmin: ReturnType<typeof createServiceClient>) {
  try {
    const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
    if (!createErr) {
      console.log('[images/meal] bucket created as public:', BUCKET)
      return
    }
    // Bucket already exists — ensure it's public
    if (createErr.message.toLowerCase().includes('already exists') || createErr.message.toLowerCase().includes('duplicate')) {
      const { error: updateErr } = await supabaseAdmin.storage.updateBucket(BUCKET, { public: true })
      if (updateErr) {
        console.warn('[images/meal] could not update bucket to public:', updateErr.message)
      } else {
        console.log('[images/meal] bucket updated to public:', BUCKET)
      }
    } else {
      console.warn('[images/meal] bucket create error:', createErr.message)
    }
  } catch (e) {
    console.warn('[images/meal] ensureBucketPublic threw:', e)
  }
}

export async function POST(req: Request) {
  try {
    const { mealId, mealName, imagePrompt, weekStartDate } = await req.json()
    const weekStart = weekStartDate || getWeekStartDate()

    console.log('[images/meal] === START ===')
    console.log('[images/meal] meal:', mealName, '| id:', mealId, '| week:', weekStart)
    console.log('[images/meal] GOOGLE_AI_KEY present:', !!GOOGLE_AI_KEY)

    // Auth check with user client
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[images/meal] 401 — authErr:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[images/meal] user:', user.id.slice(0, 8))

    // Service role client for storage admin operations
    const supabaseAdmin = createServiceClient()

    const prompt = imagePrompt ||
      `A hand-drawn watercolor illustration of ${mealName}, rendered in fine liner pen with loose watercolor fill, in the style of The Great British Baking Show recipe cards. Show a close-up view with warm, rich colors on a sketchbook paper texture background. Artistic and food-forward, no photography.`

    console.log('[images/meal] image prompt (first 120 chars):', prompt.slice(0, 120))
    console.log('[images/meal] calling Gemini image model:', GEMINI_IMAGE_MODEL)

    // ── Generate image via Gemini ─────────────────────────────────────────
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
        console.error('[images/meal] Gemini API error:', errText.slice(0, 300))
        throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 150)}`)
      }

      const data = await response.json()
      console.log('[images/meal] Gemini finishReason:', data.candidates?.[0]?.finishReason)

      const parts = data.candidates?.[0]?.content?.parts as Array<{ inlineData?: { mimeType: string; data: string } }> | undefined
      const imagePart = parts?.find((p) => p.inlineData?.data)

      if (!imagePart?.inlineData) {
        console.error('[images/meal] No inlineData in Gemini response. Parts keys:', parts?.map((p) => Object.keys(p)))
        throw new Error('No image data in Gemini response')
      }

      imageBase64 = imagePart.inlineData.data
      imageMimeType = imagePart.inlineData.mimeType || 'image/png'
      console.log('[images/meal] Gemini image — mimeType:', imageMimeType, '| base64 length:', imageBase64.length)
    } catch (genErr) {
      console.error('[images/meal] image generation failed:', genErr)
      return Response.json({ error: 'Image generation failed', details: (genErr as Error).message }, { status: 500 })
    }

    // ── Ensure bucket is public, then upload ──────────────────────────────
    await ensureBucketPublic(supabaseAdmin)

    const ext = imageMimeType.includes('jpeg') || imageMimeType.includes('jpg') ? 'jpg' : 'png'
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const fileName = `${user.id}/${mealId}.${ext}`

    console.log('[images/meal] uploading — file:', fileName, '| size:', imageBuffer.length, 'bytes')

    let storedUrl: string | null = null
    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(fileName, imageBuffer, {
      contentType: imageMimeType,
      upsert: true,
    })

    if (uploadErr) {
      console.error('[images/meal] storage upload failed:', uploadErr.message)
      return Response.json({ error: 'Storage upload failed', details: uploadErr.message }, { status: 500 })
    }

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName)
    storedUrl = pub.publicUrl
    console.log('[images/meal] public URL:', storedUrl)

    // Quick check: try to HEAD the URL to confirm it's actually accessible
    try {
      const headRes = await fetch(storedUrl, { method: 'HEAD' })
      console.log('[images/meal] public URL HEAD check — status:', headRes.status, headRes.status === 200 ? '✅' : '⚠️')
      if (headRes.status !== 200) {
        console.warn('[images/meal] public URL returned', headRes.status, '— image may not display in browser')
      }
    } catch (headErr) {
      console.warn('[images/meal] HEAD check failed (non-fatal):', headErr)
    }

    // ── Update weekly_plans with the image URL ────────────────────────────
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
          console.warn('[images/meal] mealId', mealId, 'not found in plan — image not saved to DB')
        }
      }
    } catch (dbErr) {
      console.warn('[images/meal] DB update failed (non-fatal):', dbErr)
    }

    console.log('[images/meal] === DONE === returning image_url:', storedUrl.slice(0, 80))
    return Response.json({ image_url: storedUrl })
  } catch (error) {
    console.error('[images/meal] unhandled error:', error)
    return Response.json({ error: 'Image generation failed', details: (error as Error).message }, { status: 500 })
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
