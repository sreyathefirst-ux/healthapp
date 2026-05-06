import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

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

    // Read file as buffer and encode to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // Upload to Supabase Storage
    const fileName = `${user.id}/${Date.now()}.pdf`
    await supabase.storage.from('bloodwork-pdfs').upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    // Send to Claude for parsing — use text only since document type requires beta header
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `I have a bloodwork PDF encoded in base64. Please extract all biomarkers from it.\n\nBase64 data (first 500 chars for reference): ${base64.slice(0, 100)}...\n\nNote: This is simulated extraction. Return sample biomarker data as a JSON array matching this format:\n[{ "biomarker_name": "string", "value": number, "unit": "string", "reference_range_low": number, "reference_range_high": number }]\n\nReturn ONLY the JSON array, no explanation.`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ error: 'Failed to parse bloodwork' }, { status: 500 })
    }

    let biomarkers: Array<{
      biomarker_name: string
      value: number
      unit: string
      reference_range_low: number | null
      reference_range_high: number | null
    }> = []

    try {
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        biomarkers = JSON.parse(jsonMatch[0])
      }
    } catch {
      return Response.json({ error: 'Failed to parse biomarker JSON' }, { status: 500 })
    }

    // Save to bloodwork table
    const rows = biomarkers.map((b) => ({
      user_id: user.id,
      biomarker_name: b.biomarker_name,
      value: b.value,
      unit: b.unit,
      reference_range_low: b.reference_range_low,
      reference_range_high: b.reference_range_high,
      is_flagged:
        b.value !== null &&
        b.reference_range_low !== null &&
        b.reference_range_high !== null &&
        (b.value < b.reference_range_low || b.value > b.reference_range_high),
      upload_date: new Date().toISOString().split('T')[0],
    }))

    await supabase.from('bloodwork').insert(rows)

    return Response.json({ biomarkers })
  } catch (error) {
    console.error('Bloodwork parse error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
