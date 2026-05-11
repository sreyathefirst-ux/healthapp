import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter, MODEL } from '@/lib/openrouter'
import { buildWorkoutSwapPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'
import { fetchFullProfile } from '@/lib/profile'
import { WorkoutDay } from '@/types'

export async function POST(req: Request) {
  try {
    const { workout, day } = await req.json()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await fetchFullProfile(supabase, user.id)
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

    const { data: bloodwork } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .limit(20)

    const systemPrompt = buildSystemPrompt(profile, bloodwork || [])
    const swapPrompt = buildWorkoutSwapPrompt(workout, day)

    const { text: swapText } = await callOpenRouter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: swapPrompt }],
      4096
    )

    if (!swapText) {
      return Response.json({ error: 'Failed to generate alternatives' }, { status: 500 })
    }

    let alternatives: WorkoutDay[]
    try {
      const jsonMatch = swapText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found')
      alternatives = JSON.parse(jsonMatch[0])
    } catch {
      return Response.json({ error: 'Failed to parse workout alternatives' }, { status: 500 })
    }

    return Response.json({ alternatives })
  } catch (error) {
    console.error('Workout swap error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
