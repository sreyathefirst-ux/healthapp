import { anthropic, MODEL } from '@/lib/anthropic'
import { buildOnboardingSystemPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { messages, step, collectedData } = await req.json()

  const stepGoals: Record<number, string> = {
    1: 'Collect name, age, height, weight, medical conditions, medications, supplements',
    2: 'Ask about bloodwork upload',
    3: 'Collect health concerns and at least 3 health goals',
    4: 'Collect all food preferences (restrictions, allergies, cuisines, dislikes, meal prep days)',
    5: 'Collect all workout preferences (goals, activities, days/week, gym access, equipment, duration)',
    6: 'Collect routine preferences (wake time, sleep time, morning/night habits)',
    7: 'Tell the user to select their virtual pet companion',
  }

  const systemPrompt = buildOnboardingSystemPrompt(step, stepGoals[step] || '')

  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }

      // After streaming, check for step_complete and save data
      const fullText = await stream.finalText()
      const stepCompleteMatch = fullText.match(/<step_complete>([\s\S]*?)<\/step_complete>/)
      if (stepCompleteMatch) {
        try {
          const stepData = JSON.parse(stepCompleteMatch[1])
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (user && stepData.data) {
            await saveStepData(supabase, user.id, stepData.step, stepData.data)
          }
        } catch {}
      }

      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

async function saveStepData(supabase: ReturnType<typeof createClient>, userId: string, step: number, data: Record<string, unknown>) {
  switch (step) {
    case 1:
      await supabase.from('users').upsert({
        id: userId,
        name: data.name,
        age: data.age,
        height_cm: data.height_cm,
        weight_kg: data.weight_kg,
      })
      await supabase.from('medical_profile').upsert({
        user_id: userId,
        conditions: data.conditions || [],
        medications: data.medications || [],
        supplements: data.supplements || [],
      })
      break
    case 3:
      await supabase.from('medical_profile').upsert({
        user_id: userId,
        concerns: data.concerns || [],
        goals: data.goals || [],
        success_definition: data.success_definition || '',
      })
      break
    case 4:
      await supabase.from('food_preferences').upsert({
        user_id: userId,
        restrictions: data.restrictions || [],
        allergies: data.allergies || [],
        loved_cuisines: data.loved_cuisines || [],
        disliked_foods: data.disliked_foods || [],
        meal_prep_days: data.meal_prep_days || 0,
        typical_meals: data.typical_meals || {},
      })
      break
    case 5:
      await supabase.from('workout_preferences').upsert({
        user_id: userId,
        goals: data.goals || [],
        activity_types: data.activity_types || [],
        days_per_week: data.days_per_week || 3,
        gym_access: data.gym_access || false,
        home_equipment: data.home_equipment || [],
        preferred_duration_mins: data.preferred_duration_mins || 45,
      })
      break
    case 6:
      await supabase.from('routine_preferences').upsert({
        user_id: userId,
        wake_time: data.wake_time || '07:00',
        sleep_time: data.sleep_time || '23:00',
        morning_items: data.morning_items || [],
        night_items: data.night_items || [],
      })
      break
  }
}
