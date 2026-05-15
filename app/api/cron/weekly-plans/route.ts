import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'
import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter } from '@/lib/openrouter'
import { MEAL_PLAN_PROMPT, WORKOUT_PLAN_PROMPT, buildHealthReportPrompt } from '@/lib/prompts'
import { fetchFullProfile } from '@/lib/profile'
import { NextRequest } from 'next/server'

function getWeekStart(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setUTCDate(diff)
  monday.setUTCHours(0, 0, 0, 0)
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

    const weekStart = getWeekStart()

    for (const user of users) {
      try {
        const profile = await fetchFullProfile(supabase, user.id)
        if (!profile) continue

        // Comprehensive health report is monthly (every 28 days)
        const { data: lastReport } = await supabase
          .from('weekly_plans')
          .select('generated_at')
          .eq('user_id', user.id)
          .not('health_report', 'is', null)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const daysSinceLast = lastReport
          ? (Date.now() - new Date(lastReport.generated_at).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity
        const shouldGenerateComprehensive = daysSinceLast >= 28

        const { data: bloodwork } = await supabase
          .from('bloodwork')
          .select('*')
          .eq('user_id', user.id)
          .limit(50)

        const bw = bloodwork || []
        const systemPrompt = buildSystemPrompt(profile, bw)

        const tasks: Promise<void>[] = [
          generateAndSaveMealPlan(supabase, user.id, systemPrompt, weekStart),
          generateAndSaveWorkoutPlan(supabase, user.id, systemPrompt, weekStart, profile.workout_preferences.days_per_week),
        ]

        if (shouldGenerateComprehensive) {
          const reportPrompt = buildHealthReportPrompt(profile, bw)
          tasks.push(generateAndSaveReport(supabase, user.id, systemPrompt, reportPrompt, weekStart))
          console.log(`[cron] generating health report for ${user.id} (${daysSinceLast === Infinity ? 'first time' : `${Math.round(daysSinceLast)}d since last`})`)
        } else {
          console.log(`[cron] skipping health report for ${user.id} — ${Math.round(daysSinceLast)}d since last (need 28)`)
        }

        await Promise.all(tasks)

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
  const { text } = await callOpenRouter(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: `${MEAL_PLAN_PROMPT}\n\nThe week_start_date should be: ${weekStart}` }],
    8192
  )
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
  const { text } = await callOpenRouter(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: `${prompt}\n\nThe week_start_date should be: ${weekStart}` }],
    8192
  )
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
async function generateAndSaveReport(supabase: any, userId: string, systemPrompt: string, reportPrompt: string, weekStart: string) {
  const { text } = await callOpenRouter(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: reportPrompt }],
    8192
  )
  if (!text) return
  await supabase.from('weekly_plans').upsert(
    { user_id: userId, week_start_date: weekStart, health_report: text, generated_at: new Date().toISOString() },
    { onConflict: 'user_id,week_start_date' }
  )
}
