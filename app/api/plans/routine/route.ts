import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { ROUTINE_PROMPT } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { RoutineItem } from '@/types'

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

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${ROUTINE_PROMPT}\n\nUser's wake time: ${profile.routine_preferences.wake_time}\nUser's sleep time: ${profile.routine_preferences.sleep_time}`,
        },
      ],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ error: 'Failed to generate routine' }, { status: 500 })
    }

    let routineData: { morning_items: RoutineItem[]; night_items: RoutineItem[] }
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in Claude response')
      routineData = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('[routine] JSON parse error:', parseErr, '\nRaw:', textContent.text.slice(0, 500))
      return Response.json({ error: 'Failed to parse routine JSON' }, { status: 500 })
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
      console.error('[routine] upsert error:', saveError)
      return Response.json({ error: saveError.message }, { status: 500 })
    }

    console.log('[routine] saved for user', user.id, '— morning:', routineData.morning_items.length, 'night:', routineData.night_items.length)

    return Response.json({ success: true, morning_items: routineData.morning_items, night_items: routineData.night_items })
  } catch (error) {
    console.error('Routine generation error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
