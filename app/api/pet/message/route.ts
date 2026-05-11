import { callOpenRouter } from '@/lib/openrouter'
import { buildPetMessagePrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { petName, petType, petState, completionPercent, currentStreak } = await req.json()

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const prompt = buildPetMessagePrompt({ petName, petType, petState, completionPercent, currentStreak })

    const { text } = await callOpenRouter([{ role: 'user', content: prompt }], 256)
    const message = text ?? 'Hi there! 🐾'

    return Response.json({ message })
  } catch (error) {
    console.error('Pet message error:', error)
    return Response.json({ message: 'Hi there! 🐾' })
  }
}
