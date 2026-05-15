import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const maxDuration = 60

const GOOGLE_AI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash'

const PARSE_PROMPT = `Extract ALL biomarker values from this medical lab report.
IMPORTANT: Only extract values that are explicitly printed in the document. Do NOT guess, infer, or estimate any value. If a value is not clearly readable, skip it entirely.
Return ONLY a JSON array (no markdown, no backticks, no explanation):
[{"biomarker_name":"string","value":NUMBER,"unit":"string","reference_range_low":NUMBER_OR_NULL,"reference_range_high":NUMBER_OR_NULL},...]
Range rules: if range is "< X" set low=0 and high=X; if range is "> X" set low=X and high=999999; if no range shown use null for both.`

export async function POST(req: NextRequest) {
  try {
    // ── 1. Read file from form data ───────────────────────────────────────────
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.error('[bloodwork] step 1 FAIL — no file in form data')
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }
    console.log('[bloodwork] step 1 OK — file name:', file.name, '| size:', file.size, 'bytes | type:', file.type)

    // ── 2. Auth ───────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[bloodwork] step 2 FAIL — auth error:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[bloodwork] step 2 OK — user:', user.id)

    // ── 3. Convert to base64 ──────────────────────────────────────────────────
    let base64: string
    try {
      const arrayBuffer = await file.arrayBuffer()
      base64 = Buffer.from(arrayBuffer).toString('base64')
      console.log('[bloodwork] step 3 OK — base64 length:', base64.length)
    } catch (e) {
      console.error('[bloodwork] step 3 FAIL — buffer conversion error:', e)
      return Response.json({ error: 'Failed to read file' }, { status: 500 })
    }

    // Upload to storage (fire-and-forget)
    supabase.storage
      .from('bloodwork-pdfs')
      .upload(`${user.id}/${Date.now()}.pdf`, Buffer.from(base64, 'base64'), {
        contentType: 'application/pdf',
        upsert: true,
      })
      .catch((e) => console.warn('[bloodwork] storage upload non-fatal:', e?.message))

    // ── 4. Call Google AI ─────────────────────────────────────────────────────
    const key = process.env.GOOGLE_AI_KEY
    if (!key) {
      console.error('[bloodwork] step 4 FAIL — GOOGLE_AI_KEY not set')
      return Response.json({ error: 'AI service not configured' }, { status: 500 })
    }

    const reqBody = {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: PARSE_PROMPT },
        ],
      }],
      generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
    }

    console.log('[bloodwork] step 4 — calling Google AI...')
    let apiRes: Response
    try {
      apiRes = await fetch(`${GOOGLE_AI_URL}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
    } catch (fetchErr) {
      console.error('[bloodwork] step 4 FAIL — network error:', fetchErr)
      return Response.json({ error: 'Failed to reach AI service' }, { status: 500 })
    }

    console.log('[bloodwork] step 4 — Google AI status:', apiRes.status)
    if (!apiRes.ok) {
      const errBody = await apiRes.text()
      console.error('[bloodwork] step 4 FAIL — Google AI error body:', errBody.slice(0, 600))
      return Response.json({ error: `AI service error ${apiRes.status}` }, { status: 500 })
    }

    // ── 5. Extract text from response ─────────────────────────────────────────
    let apiJson: Record<string, unknown>
    try {
      apiJson = await apiRes.json()
    } catch (e) {
      console.error('[bloodwork] step 5 FAIL — JSON parse of API response:', e)
      return Response.json({ error: 'Malformed AI response' }, { status: 500 })
    }

    // Gemini 2.5 Flash generates thinking tokens first (thought: true parts).
    // Find the first part that is actual text output (not a thought block).
    const parts = (apiJson as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
    }).candidates?.[0]?.content?.parts ?? []

    console.log('[bloodwork] step 5 — parts count:', parts.length,
      '| types:', parts.map((p) => p.thought ? 'thought' : (p.text ? 'text' : 'empty')))

    const textPart = parts.find((p) => p.text && !p.thought)
    const rawResponseText = textPart?.text ?? null

    if (!rawResponseText) {
      console.error('[bloodwork] step 5 FAIL — no text part found. Full response:', JSON.stringify(apiJson).slice(0, 800))
      return Response.json({ error: 'AI returned no readable text' }, { status: 500 })
    }
    console.log('[bloodwork] step 5 OK — raw text length:', rawResponseText.length)
    console.log('[bloodwork] step 5 — raw preview:', rawResponseText.slice(0, 400))

    // ── 6. Parse JSON biomarkers ──────────────────────────────────────────────
    type RawBiomarker = {
      biomarker_name: string
      value: number
      unit: string
      reference_range_low: number | null
      reference_range_high: number | null
    }
    let biomarkers: RawBiomarker[] = []

    try {
      const text = rawResponseText.trim()

      // Attempt 1: direct parse
      try {
        biomarkers = JSON.parse(text)
        console.log('[bloodwork] step 6 — direct JSON parse succeeded')
      } catch {
        // Attempt 2: strip markdown fences
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
        try {
          biomarkers = JSON.parse(stripped)
          console.log('[bloodwork] step 6 — stripped-fence JSON parse succeeded')
        } catch {
          // Attempt 3: extract first JSON array
          const match = text.match(/\[[\s\S]*\]/)
          if (match) {
            biomarkers = JSON.parse(match[0])
            console.log('[bloodwork] step 6 — bracket-match JSON parse succeeded')
          } else {
            throw new Error('No JSON array found in response')
          }
        }
      }
    } catch (e) {
      console.error('[bloodwork] step 6 FAIL — all parse attempts failed:', (e as Error).message)
      console.error('[bloodwork] step 6 — raw text (first 1200):', rawResponseText.slice(0, 1200))
      return Response.json({ error: 'Failed to extract biomarkers from PDF' }, { status: 500 })
    }

    if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
      console.error('[bloodwork] step 6 FAIL — result is empty or not an array. Type:', typeof biomarkers)
      return Response.json({ error: 'No biomarkers found in this PDF' }, { status: 422 })
    }
    console.log('[bloodwork] step 6 OK — extracted', biomarkers.length, 'biomarkers')

    // ── 7. Save to Supabase ───────────────────────────────────────────────────
    // Only delete records from the same day to preserve historical uploads
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('bloodwork').delete().eq('user_id', user.id).eq('upload_date', today)

    const rows = biomarkers
      .filter((b) => b.biomarker_name && b.value !== undefined && b.value !== null)
      .map((b) => {
        const low = b.reference_range_low
        const high = b.reference_range_high
        const flagged =
          b.value !== null &&
          low !== null && low !== undefined &&
          high !== null && high !== undefined &&
          (b.value < low || b.value > high)
        return {
          user_id: user.id,
          biomarker_name: b.biomarker_name,
          value: Number(b.value),
          unit: b.unit || '',
          reference_range_low: low ?? null,
          reference_range_high: high ?? null,
          is_flagged: flagged,
          upload_date: new Date().toISOString().split('T')[0],
        }
      })

    const { error: insertError } = await supabase.from('bloodwork').insert(rows)
    if (insertError) {
      console.error('[bloodwork] step 7 FAIL — insert error:', insertError.message, '| details:', insertError.details)
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    const flaggedCount = rows.filter((r) => r.is_flagged).length
    console.log('[bloodwork] step 7 OK — saved', rows.length, 'rows,', flaggedCount, 'flagged')

    return Response.json({ success: true, biomarkers: rows })
  } catch (error) {
    console.error('[bloodwork] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
