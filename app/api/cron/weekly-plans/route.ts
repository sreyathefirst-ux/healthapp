import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'
import { anthropic, MODEL, buildSystemPrompt } from '@/lib/anthropic'
import { MEAL_PLAN_PROMPT, WORKOUT_PLAN_PROMPT, HEALTH_REPORT_PROMPT } from '@/lib/prompts'
import { fetchFullProfile } from '@/lib/profile'
import { NextRequest } from 'next/server'

function getWeekStartDate(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('onboarding_complete', true)

    if (!users) return Response.json({ success: true, processed: 0 })

    const weekStart = getWeekStartDate()

    for (const user of users) {
      try {
        const profile = await fetchFullProfile(supabase, user.id)
        if (!profile) continue

        const { data: bloodwork } = await supabase
          .from('bloodwork')
          .select('*')
          .eq('user_id', user.id)
          .limit(50)

        const systemPrompt = buildSystemPrompt(profile, bloodwork || [])

        // Generate all plans in parallel
        await Promise.all([
          generateAndSaveMealPlan(supabase, user.id, systemPrompt, weekStart),
          generateAndSaveWorkoutPlan(supabase, user.id, systemPrompt, weekStart, profile.workout_preferences.days_per_week),
          generateAndSaveReport(supabase, user.id, systemPrompt, weekStart),
        ])

        // Send push notification
        const { data: pushSub } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (pushSub) {
          await sendPushNotification(pushSub, {
            title: 'Vitalia 🌿',
            body: 'Your new weekly plan is ready! Check it out.',
            icon: '/icon-192.png',
          }).catch(async () => {
            await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
          })
        }
      } catch (err) {
        console.error(`Failed to generate plans for user ${user.id}:`, err)
      }
    }

    return Response.json({ success: true, processed: users.length })
  } catch (error) {
    console.error('Weekly cron error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndSaveMealPlan(supabase: any, userId: string, systemPrompt: string, weekStart: string) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: `${MEAL_PLAN_PROMPT}\n\nThe week_start_date should be: ${weekStart}` }],
  })
  const textBlock = response.content.find((c) => c.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : null
  if (!text) return
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return
  const plan = JSON.parse(jsonMatch[0])
  await supabase.from('weekly_plans').upsert(
    { user_id: userId, week_start_date: weekStart, meal_plan: plan },
    { onConflict: 'user_id,week_start_date' }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndSaveWorkoutPlan(supabase: any, userId: string, systemPrompt: string, weekStart: string, daysPerWeek: number) {
  const prompt = WORKOUT_PLAN_PROMPT.replace('${workout_preferences.days_per_week}', String(daysPerWeek))
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: `${prompt}\n\nThe week_start_date should be: ${weekStart}` }],
  })
  const textBlock = response.content.find((c) => c.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : null
  if (!text) return
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return
  const plan = JSON.parse(jsonMatch[0])
  await supabase.from('weekly_plans').upsert(
    { user_id: userId, week_start_date: weekStart, workout_plan: plan },
    { onConflict: 'user_id,week_start_date' }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndSaveReport(supabase: any, userId: string, systemPrompt: string, weekStart: string) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: HEALTH_REPORT_PROMPT }],
  })
  const textBlock = response.content.find((c) => c.type === 'text')
  const text = textBlock?.type === 'text' ? textBlock.text : null
  if (!text) return
  await supabase.from('weekly_plans').upsert(
    { user_id: userId, week_start_date: weekStart, health_report: text },
    { onConflict: 'user_id,week_start_date' }
  )
}
