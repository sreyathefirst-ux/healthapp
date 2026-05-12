import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const GOOGLE_AI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash'

const PARSE_PROMPT = `Extract all biomarker values from this medical lab report PDF. Return ONLY valid JSON with no markdown, no backticks, nothing else:
[
  {
    "biomarker_name": "LDL Cholesterol",
    "value": 112,
    "unit": "mg/dL",
    "reference_range_low": 0,
    "reference_range_high": 99
  }
]

Rules:
- Extract the ACTUAL measured value — never invent or estimate
- biomarker_name: use the exact name printed in the report (or a clean common version)
- value: must be a number (convert "<0.01" to 0.01, ">180" to 180)
- unit: exactly as shown (mg/dL, mmol/L, ng/mL, U/L, %, g/dL, etc.)
- reference_range_low / reference_range_high: use the ranges printed for THIS patient; use null if not shown
- Include every test result on every page
- Do NOT include qualitative results (e.g. "Negative", "Normal") that have no numeric value
- Return ONLY the JSON array, nothing else`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.error('[bloodwork] no file in request')
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[bloodwork] auth failed:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    console.log('[bloodwork] parsing PDF for user', user.id, '— size:', buffer.length, 'bytes | GOOGLE_AI_KEY present:', !!process.env.GOOGLE_AI_KEY)

    // Upload original PDF to storage (non-blocking, ignore errors)
    supabase.storage.from('bloodwork-pdfs').upload(`${user.id}/${Date.now()}.pdf`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    }).catch((e) => console.warn('[bloodwork] storage upload failed (non-fatal):', e?.message))

    // Call Google Generative Language API with inline PDF data
    const key = process.env.GOOGLE_AI_KEY
    const reqBody = {
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          { text: PARSE_PROMPT },
        ],
      }],
      generationConfig: { maxOutputTokens: 4096 },
    }

    console.log('[bloodwork] calling Google AI generateContent...')
    const apiRes = await fetch(`${GOOGLE_AI_URL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })

    console.log('[bloodwork] Google AI response status:', apiRes.status)

    if (!apiRes.ok) {
      const errBody = await apiRes.text()
      console.error('[bloodwork] Google AI error', apiRes.status, ':', errBody.slice(0, 500))
      return Response.json({ error: 'Failed to parse PDF — AI service error' }, { status: 500 })
    }

    const apiJson = await apiRes.json()
    const rawResponseText: string | null = apiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? null

    console.log('[bloodwork] raw response length:', rawResponseText?.length ?? 0)
    console.log('[bloodwork] raw response preview:', rawResponseText?.slice(0, 400))

    if (!rawResponseText) {
      console.error('[bloodwork] model returned no text. Full response:', JSON.stringify(apiJson).slice(0, 500))
      return Response.json({ error: 'Failed to parse bloodwork PDF — no text returned' }, { status: 500 })
    }

    let biomarkers: Array<{
      biomarker_name: string
      value: number
      unit: string
      reference_range_low: number | null
      reference_range_high: number | null
    }> = []

    try {
      const text = rawResponseText.trim()
      console.log('[bloodwork] attempting direct JSON parse...')
      try {
        biomarkers = JSON.parse(text)
        console.log('[bloodwork] direct JSON parse succeeded')
      } catch (e1) {
        console.warn('[bloodwork] direct parse failed:', (e1 as Error).message, '— trying strip markdown...')
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        try {
          biomarkers = JSON.parse(stripped)
          console.log('[bloodwork] stripped markdown parse succeeded')
        } catch (e2) {
          console.warn('[bloodwork] stripped parse failed:', (e2 as Error).message, '— trying bracket match...')
          const match = text.match(/\[[\s\S]*\]/)
          if (match) {
            biomarkers = JSON.parse(match[0])
            console.log('[bloodwork] bracket match parse succeeded')
          } else {
            throw new Error('No JSON array found in response')
          }
        }
      }
    } catch (e) {
      console.error('[bloodwork] all JSON parse attempts failed:', (e as Error).message)
      console.error('[bloodwork] raw text that failed (first 1000):', rawResponseText.slice(0, 1000))
      return Response.json({ error: 'Failed to extract biomarkers from PDF' }, { status: 500 })
    }

    if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
      console.error('[bloodwork] empty or non-array result. Type:', typeof biomarkers, '| raw:', rawResponseText.slice(0, 500))
      return Response.json({ error: 'No biomarkers found in this PDF' }, { status: 422 })
    }

    console.log('[bloodwork] extracted', biomarkers.length, 'biomarkers')

    // Replace old bloodwork for this user
    await supabase.from('bloodwork').delete().eq('user_id', user.id)

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
      console.error('[bloodwork] insert error:', insertError.message, '| details:', insertError.details)
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    const flaggedCount = rows.filter((r) => r.is_flagged).length
    console.log('[bloodwork] saved', rows.length, 'rows,', flaggedCount, 'flagged')

    return Response.json({ success: true, biomarkers: rows })
  } catch (error) {
    console.error('[bloodwork] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
