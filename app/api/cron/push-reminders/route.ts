import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const currentHour = now.getUTCHours()
  const currentMinute = now.getUTCMinutes()

  try {
    const { data: subsWithPrefs } = await supabase
      .from('push_subscriptions')
      .select(`
        *,
        routine_preferences!inner(wake_time, sleep_time)
      `)

    if (!subsWithPrefs) return Response.json({ success: true })

    for (const sub of subsWithPrefs) {
      try {
        const prefs = (sub as { routine_preferences: { wake_time: string; sleep_time: string } }).routine_preferences
        const wakeTime = prefs?.wake_time || '07:00'
        const sleepTime = prefs?.sleep_time || '23:00'

        const [wakeH, wakeM] = wakeTime.split(':').map(Number)
        const [sleepH, sleepM] = sleepTime.split(':').map(Number)

        const reminderWindows = [
          { hour: wakeH, minute: wakeM, title: 'Good morning! 🌅', body: 'Time to start your morning routine.' },
          { hour: wakeH + 2, minute: wakeM, title: 'Workout reminder 💪', body: 'Have you completed your workout today?' },
          { hour: 12, minute: 0, title: 'Lunch time 🥗', body: "Don't forget to log your lunch!" },
          { hour: 18, minute: 30, title: 'Dinner time 🍽️', body: "Don't forget to log your dinner!" },
          { hour: sleepH - 1, minute: sleepM, title: 'Night routine time 🌙', body: 'Wind down with your night routine.' },
        ]

        for (const window of reminderWindows) {
          const hourDiff = Math.abs(currentHour - window.hour)
          const minDiff = Math.abs(currentMinute - window.minute)
          if (hourDiff === 0 && minDiff <= 15) {
            await sendPushNotification(sub, {
              title: window.title,
              body: window.body,
              icon: '/icon-192.png',
            }).catch(async () => {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            })
            break
          }
        }
      } catch (err) {
        console.error('Push reminder failed:', err)
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Push reminders cron error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
