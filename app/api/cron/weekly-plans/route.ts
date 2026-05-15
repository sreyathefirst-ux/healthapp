import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'
import { buildSystemPrompt } from '@/lib/anthropic'
import { callOpenRouter } from '@/lib/openrouter'
import { MEAL_PLAN_PROMPT, WORKOUT_PLAN_PROMPT, buildHealthReportPrompt, buildWeeklyProgressPrompt } from '@/lib/prompts'
import { fetchFullProfile } from '@/lib/profile'
import { DailyLog, MealPlan, WorkoutPlan } from '@/types'
import { NextRequest } from 'next/server'

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setUTCDate(diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
  }
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

    const { weekStart, weekEnd } = getWeekBounds()

    for (const user of users) {
      try {
        const profile = await fetchFullProfile(supabase, user.id)
        if (!profile) continue

        // Check if comprehensive health report should be regenerated (monthly = 28 days)
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

        // Fetch daily logs for weekly progress
        const { data: dailyLogs } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', weekStart)
          .lte('date', weekEnd)

        // Fetch this week's plan (for context in weekly progress prompt)
        const { data: weeklyPlan } = await supabase
          .from('weekly_plans')
          .select('meal_plan, workout_plan')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart)
          .maybeSingle()

        const { data: bloodwork } = await supabase
          .from('bloodwork')
          .select('*')
          .eq('user_id', user.id)
          .limit(50)

        const bw = bloodwork || []
        const systemPrompt = buildSystemPrompt(profile, bw)

        const logs = (dailyLogs ?? []) as DailyLog[]
        const mealPlan = (weeklyPlan?.meal_plan ?? null) as MealPlan | null
        const workoutPlan = (weeklyPlan?.workout_plan ?? null) as WorkoutPlan | null

        // Always generate: meal plan, workout plan, weekly progress report
        // Conditionally generate: comprehensive health report (monthly)
        const tasks: Promise<void>[] = [
          generateAndSaveMealPlan(supabase, user.id, systemPrompt, weekStart),
          generateAndSaveWorkoutPlan(supabase, user.id, systemPrompt, weekStart, profile.workout_preferences.days_per_week),
          generateAndSaveWeeklyProgress(supabase, user.id, profile, logs, mealPlan, workoutPlan, weekStart),
        ]

        if (shouldGenerateComprehensive) {
          const reportPrompt = buildHealthReportPrompt(profile, bw)
          tasks.push(generateAndSaveReport(supabase, user.id, systemPrompt, reportPrompt, weekStart))
          console.log(`[cron] generating comprehensive health report for ${user.id} (${daysSinceLast === Infinity ? 'first time' : `${Math.round(daysSinceLast)}d since last`})`)
        } else {
          console.log(`[cron] skipping comprehensive report for ${user.id} — only ${Math.round(daysSinceLast)}d since last (need 28)`)
        }

        await Promise.all(tasks)

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateAndSaveWeeklyProgress(supabase: any, userId: string, profile: Awaited<ReturnType<typeof fetchFullProfile>>, logs: DailyLog[], mealPlan: MealPlan | null, workoutPlan: WorkoutPlan | null, weekStart: string) {
  if (!profile) return
  const prompt = buildWeeklyProgressPrompt(profile, logs, mealPlan, workoutPlan, weekStart)
  const { text } = await callOpenRouter([{ role: 'user', content: prompt }], 4096)
  if (!text) return
  await supabase.from('weekly_plans').upsert(
    { user_id: userId, week_start_date: weekStart, weekly_progress_report: text, generated_at: new Date().toISOString() },
    { onConflict: 'user_id,week_start_date' }
  )
}
