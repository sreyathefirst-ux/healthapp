import { callOpenRouter } from '@/lib/openrouter'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { WorkoutDay } from '@/types'

function extractJSONObject(text: string): unknown {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No { found in response')

  let depth = 0
  let end = -1
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }
  if (end === -1) throw new Error('No matching } found')
  return JSON.parse(text.slice(start, end + 1))
}

export async function POST(req: Request) {
  console.log('[workouts/adapt] === START ===')
  try {
    const body = await req.json()
    const { workout, newLocation, classDetails } = body

    if (!workout || !newLocation) {
      return Response.json({ error: 'Missing workout or newLocation' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (!user) {
      console.error('[workouts/adapt] auth failed:', authErr?.message)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let prompt: string

    if (newLocation === 'home') {
      const profile = await fetchFullProfile(supabase, user.id)
      const homeEquipment: string[] = profile?.workout_preferences?.home_equipment || []

      prompt = `Adapt this workout for home use. User's home equipment: ${homeEquipment.join(', ') || 'bodyweight only'}. Current workout: ${JSON.stringify(workout)}. Replace gym exercises with bodyweight or home-equipment alternatives. Keep the same workout type (upper/lower/full body) and approximate duration. Return ONLY valid JSON for a single WorkoutDay object: { type: 'workout', workout_name: '...', location: 'home', duration_mins: N, exercises: [...] }`
    } else if (newLocation === 'class') {
      if (!classDetails) {
        return Response.json({ error: 'Missing classDetails for class location' }, { status: 400 })
      }
      prompt = `The user is attending a fitness class: name='${classDetails.name}', type='${classDetails.type}', location='${classDetails.location}'. Create a workout entry representing this class. Return ONLY valid JSON for a single WorkoutDay object: { type: 'workout', workout_name: '${classDetails.name} - ${classDetails.type}', location: 'class', duration_mins: 60, exercises: [{ id: 'uuid', name: 'Class Session: ${classDetails.type}', sets: 1, reps: 1, rest_seconds: 0, reasoning: 'Attending ${classDetails.name}', gif_url: null }] }`
    } else {
      return Response.json({ error: 'Invalid newLocation' }, { status: 400 })
    }

    console.log('[workouts/adapt] newLocation:', newLocation)
    console.log('[workouts/adapt] calling Gemini API...')

    let rawText: string | null
    try {
      const result = await callOpenRouter(
        [{ role: 'user', content: prompt }],
        4096,
        'workouts/adapt',
        { responseMimeType: 'application/json' }
      )
      rawText = result.text
      console.log('[workouts/adapt] Gemini stopReason:', result.stopReason)
    } catch (apiErr) {
      console.error('[workouts/adapt] Gemini API threw:', apiErr)
      return Response.json({ error: 'Gemini API call failed', details: (apiErr as Error).message }, { status: 502 })
    }

    if (!rawText) {
      return Response.json({ error: 'Gemini returned no text' }, { status: 500 })
    }

    console.log('[workouts/adapt] raw response (first 500 chars):', rawText.slice(0, 500))

    let parsed: WorkoutDay
    try {
      parsed = extractJSONObject(rawText) as WorkoutDay
    } catch (extractErr) {
      console.error('[workouts/adapt] JSON extraction failed:', (extractErr as Error).message)
      return Response.json({
        error: 'No JSON object found in model response',
        details: (extractErr as Error).message,
        rawResponse: rawText.slice(0, 800),
      }, { status: 500 })
    }

    console.log('[workouts/adapt] adapted workout:', parsed.workout_name)
    console.log('[workouts/adapt] === DONE ===')
    return Response.json({ workout: parsed })
  } catch (error) {
    console.error('[workouts/adapt] unhandled error:', error)
    return Response.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 })
  }
}
