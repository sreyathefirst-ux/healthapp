import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter } from '@/lib/openrouter'
import { ROUTINE_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { RoutineItem } from '@/types'

function extractJson(text: string): unknown {
  try { return JSON.parse(text.trim()) } catch { /* continue */ }
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try { return JSON.parse(stripped) } catch { /* continue */ }
  const match = text.match(/\{[\s\S]*\}/)
  if (match) return JSON.parse(match[0])
  throw new Error('No valid JSON found in response')
}

export async function POST(_req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) {
      console.error('[routine] profile not found for user', user.id)
      return Response.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 })
    }

    console.log('[routine] profile summary for', user.id, {
      name: profile.name || '(empty)',
      wakeTime: profile.routine_preferences.wake_time,
      sleepTime: profile.routine_preferences.sleep_time,
      medications: profile.medical_profile.medications,
      supplements: profile.medical_profile.supplements,
      conditions: profile.medical_profile.conditions,
      morningItemsExisting: profile.routine_preferences.morning_items?.length ?? 0,
      nightItemsExisting: profile.routine_preferences.night_items?.length ?? 0,
    })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    console.log('[routine] system prompt length:', systemPrompt.length, 'chars')

    const userMessage = `${ROUTINE_PROMPT}\n\nUser's wake time: ${profile.routine_preferences.wake_time}\nUser's sleep time: ${profile.routine_preferences.sleep_time}`

    let rawText: string | null = null

    const firstResponse = await callOpenRouter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      4096
    )
    rawText = firstResponse.text

    if (!rawText) {
      console.error('[routine] model returned no text content')
      return Response.json({ error: 'Failed to generate routine' }, { status: 500 })
    }

    let routineData: { morning_items: RoutineItem[]; night_items: RoutineItem[] } | null = null

    try {
      routineData = extractJson(rawText) as { morning_items: RoutineItem[]; night_items: RoutineItem[] }
    } catch (parseErr) {
      console.error('[routine] JSON parse failed on first attempt:', parseErr)
      console.error('[routine] raw response (first 2000 chars):', rawText.slice(0, 2000))

      console.log('[routine] retrying with strict JSON prompt...')
      const retryResponse = await callOpenRouter(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
          { role: 'assistant', content: rawText },
          { role: 'user', content: 'Return ONLY raw JSON. No markdown, no backticks, no explanation, nothing else. Just the JSON object.' },
        ],
        4096
      )
      const retryText = retryResponse.text

      if (!retryText) {
        console.error('[routine] retry returned no text')
        return Response.json({ error: 'Failed to generate routine JSON' }, { status: 500 })
      }

      try {
        routineData = extractJson(retryText) as { morning_items: RoutineItem[]; night_items: RoutineItem[] }
        console.log('[routine] retry JSON parse succeeded')
      } catch (retryParseErr) {
        console.error('[routine] retry JSON parse also failed:', retryParseErr)
        console.error('[routine] retry raw response (first 2000 chars):', retryText.slice(0, 2000))
        return Response.json({ error: 'Failed to parse routine JSON after retry' }, { status: 500 })
      }
    }

    if (!routineData) {
      return Response.json({ error: 'Failed to generate routine' }, { status: 500 })
    }

    const { error: saveError } = await supabase.from('routine_preferences').upsert(
      {
        user_id: user.id,
        morning_items: routineData.morning_items,
        night_items: routineData.night_items,
        wake_time: profile.routine_preferences.wake_time,
        sleep_time: profile.routine_preferences.sleep_time,
      },
      { onConflict: 'user_id' }
    )

    if (saveError) {
      console.error('[routine] upsert error:', saveError.message, saveError.details)
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    console.log('[routine] saved for user', user.id, '— morning:', routineData.morning_items.length, 'night:', routineData.night_items.length)

    return Response.json({ success: true, morning_items: routineData.morning_items, night_items: routineData.night_items })
  } catch (error) {
    console.error('[routine] unhandled error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
