import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const PARSE_PROMPT = `You are reading a medical lab / bloodwork report PDF.

Extract every biomarker, lab test, or blood panel result in the document.

Return ONLY a JSON array — no markdown, no explanation, no code fences:
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
- reference_range_low / reference_range_high: use the ranges printed for THIS patient in the report; use null if not shown
- Include every test result on every page
- Do NOT include qualitative results (e.g. "Negative", "Normal") that have no numeric value
- Return ONLY the JSON array`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // Upload original PDF to storage
    const fileName = `${user.id}/${Date.now()}.pdf`
    await supabase.storage.from('bloodwork-pdfs').upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    console.log('[bloodwork] parsing PDF for user', user.id, '— size:', buffer.length, 'bytes')

    // Use Claude's native PDF document support via direct API call (beta feature)
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              { type: 'text', text: PARSE_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!apiRes.ok) {
      const errBody = await apiRes.text()
      console.error('[bloodwork] Anthropic API error', apiRes.status, errBody.slice(0, 400))
      return Response.json({ error: 'Failed to parse PDF with Claude' }, { status: 500 })
    }

    const apiJson = await apiRes.json()
    const textContent = apiJson.content?.find((c: { type: string }) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      console.error('[bloodwork] Claude returned no text content')
      return Response.json({ error: 'Failed to parse bloodwork PDF' }, { status: 500 })
    }

    console.log('[bloodwork] raw response preview:', textContent.text.slice(0, 400))

    let biomarkers: Array<{
      biomarker_name: string
      value: number
      unit: string
      reference_range_low: number | null
      reference_range_high: number | null
    }> = []

    try {
      const text = textContent.text.trim()
      try {
        biomarkers = JSON.parse(text)
      } catch {
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
        try {
          biomarkers = JSON.parse(stripped)
        } catch {
          const match = text.match(/\[[\s\S]*\]/)
          if (match) biomarkers = JSON.parse(match[0])
        }
      }
    } catch (e) {
      console.error('[bloodwork] JSON parse failed:', e, '\nRaw:', textContent.text.slice(0, 1000))
      return Response.json({ error: 'Failed to extract biomarkers from PDF' }, { status: 500 })
    }

    if (!Array.isArray(biomarkers) || biomarkers.length === 0) {
      console.error('[bloodwork] empty result — raw response:', textContent.text.slice(0, 1000))
      return Response.json({ error: 'No biomarkers found in this PDF' }, { status: 422 })
    }

    console.log('[bloodwork] extracted', biomarkers.length, 'biomarkers')

    // Remove old bloodwork for this user before inserting the new upload
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
      console.error('[bloodwork] insert error:', insertError.message, insertError.details)
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    const flaggedCount = rows.filter((r) => r.is_flagged).length
    const flaggedNames = rows.filter((r) => r.is_flagged).map((r) => r.biomarker_name)
    console.log('[bloodwork] saved', rows.length, 'rows,', flaggedCount, 'flagged:', flaggedNames)

    return Response.json({ biomarkers: rows })
  } catch (error) {
    console.error('[bloodwork] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
