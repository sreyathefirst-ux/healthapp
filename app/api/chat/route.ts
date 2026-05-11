import { MODEL, buildGeminiStreamRequest } from '@/lib/openrouter'
import { buildOnboardingSystemPrompt } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { messages, step } = await req.json()

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

    const allMessages = (messages as { role: string; content: string }[]).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    const firstUserIdx = allMessages.findIndex((m) => m.role === 'user')
    const apiMessages = firstUserIdx >= 0 ? allMessages.slice(firstUserIdx) : allMessages

    if (apiMessages.length === 0) {
      return Response.json({ error: 'No user message to process' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    let fullText = ''

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const { url, body: reqBody } = buildGeminiStreamRequest(
            [{ role: 'system', content: systemPrompt }, ...apiMessages],
            1024
          )
          const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: reqBody,
          })

          if (!geminiResponse.ok || !geminiResponse.body) {
            const errText = await geminiResponse.text().catch(() => '')
            throw new Error(`Google AI error ${geminiResponse.status}: ${errText}`)
          }

          const reader = geminiResponse.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (!data) continue
              try {
                const chunk = JSON.parse(data)
                const delta: string | undefined = chunk.candidates?.[0]?.content?.parts?.[0]?.text
                if (delta) {
                  fullText += delta
                  controller.enqueue(encoder.encode(delta))
                }
              } catch { /* skip malformed SSE chunks */ }
            }
          }

          // After streaming completes, parse step_complete and persist data
          const stepCompleteMatch = fullText.match(/<step_complete>([\s\S]*?)<\/step_complete>/)
          if (stepCompleteMatch) {
            try {
              const stepData = JSON.parse(stepCompleteMatch[1])
              const supabase = createClient()
              const { data: { user }, error: authErr } = await supabase.auth.getUser()

              if (authErr) {
                console.error(`[chat] auth error on step ${step}:`, authErr.message)
              } else if (user && stepData.data) {
                await saveStepData(supabase, user.id, stepData.step, stepData.data)
              } else if (!user) {
                console.error(`[chat] no user found when saving step ${step}`)
              }
            } catch (parseErr) {
              console.error(`[chat] failed to parse step_complete block on step ${step}:`, parseErr)
            }
          }
        } catch (streamErr) {
          console.error('[chat] stream error:', streamErr)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('[chat] unhandled error:', error)
    return Response.json({ error: 'Internal server error. Please try again.' }, { status: 500 })
  }
}

async function saveStepData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  step: number,
  data: Record<string, unknown>
) {
  console.log(`[chat] saving step ${step} for user ${userId}`, JSON.stringify(data).slice(0, 200))

  switch (step) {
    case 1: {
      const { error: usersErr } = await supabase.from('users').upsert(
        { id: userId, name: data.name, age: data.age, height_cm: data.height_cm, weight_kg: data.weight_kg },
        { onConflict: 'id' }
      )
      if (usersErr) console.error('[chat] users upsert error (step 1):', usersErr.message, usersErr.details)

      const { error: medErr } = await supabase.from('medical_profile').upsert(
        {
          user_id: userId,
          conditions: data.conditions || [],
          medications: data.medications || [],
          supplements: data.supplements || [],
          exercise_history: data.exercise_history || '',
        },
        { onConflict: 'user_id' }
      )
      if (medErr) console.error('[chat] medical_profile upsert error (step 1):', medErr.message, medErr.details)
      break
    }
    case 3: {
      const { error: medErr } = await supabase.from('medical_profile').upsert(
        {
          user_id: userId,
          concerns: data.concerns || [],
          goals: data.goals || [],
          success_definition: data.success_definition || '',
        },
        { onConflict: 'user_id' }
      )
      if (medErr) console.error('[chat] medical_profile upsert error (step 3):', medErr.message, medErr.details)
      break
    }
    case 4: {
      const { error: foodErr } = await supabase.from('food_preferences').upsert(
        {
          user_id: userId,
          restrictions: data.restrictions || [],
          allergies: data.allergies || [],
          loved_cuisines: data.loved_cuisines || [],
          disliked_foods: data.disliked_foods || [],
          meal_prep_days: data.meal_prep_days || 0,
          typical_meals: data.typical_meals || {},
        },
        { onConflict: 'user_id' }
      )
      if (foodErr) console.error('[chat] food_preferences upsert error (step 4):', foodErr.message, foodErr.details)
      break
    }
    case 5: {
      const { error: workoutErr } = await supabase.from('workout_preferences').upsert(
        {
          user_id: userId,
          goals: data.goals || [],
          activity_types: data.activity_types || [],
          days_per_week: data.days_per_week || 3,
          gym_access: data.gym_access || false,
          home_equipment: data.home_equipment || [],
          preferred_duration_mins: data.preferred_duration_mins || 45,
        },
        { onConflict: 'user_id' }
      )
      if (workoutErr) console.error('[chat] workout_preferences upsert error (step 5):', workoutErr.message, workoutErr.details)
      break
    }
    case 6: {
      const { error: routineErr } = await supabase.from('routine_preferences').upsert(
        {
          user_id: userId,
          wake_time: data.wake_time || '07:00',
          sleep_time: data.sleep_time || '23:00',
          morning_items: data.morning_items || [],
          night_items: data.night_items || [],
        },
        { onConflict: 'user_id' }
      )
      if (routineErr) console.error('[chat] routine_preferences upsert error (step 6):', routineErr.message, routineErr.details)
      break
    }
    default:
      console.log(`[chat] step ${step} has no save handler`)
  }
}
