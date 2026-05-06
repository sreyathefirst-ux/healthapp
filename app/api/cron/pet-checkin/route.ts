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

  try {
    const today = new Date().toISOString().split('T')[0]
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('onboarding_complete', true)

    if (!users) return Response.json({ success: true })

    for (const user of users) {
      try {
        // Check if user has been active today
        const { data: log } = await supabase
          .from('daily_logs')
          .select('last_seen_at')
          .eq('user_id', user.id)
          .eq('date', today)
          .single()

        const isInactive = !log || !log.last_seen_at || new Date(log.last_seen_at) < new Date(threeHoursAgo)
        if (!isInactive) continue

        const { data: pet } = await supabase
          .from('pet')
          .select('pet_name')
          .eq('user_id', user.id)
          .single()

        const { data: pushSub } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (pushSub && pet) {
          await sendPushNotification(pushSub, {
            title: `${pet.pet_name} misses you... 🥺`,
            body: "Don't forget your routine! Your health companion is waiting.",
            icon: '/icon-192.png',
          }).catch(async () => {
            await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
          })
        }
      } catch (err) {
        console.error(`Pet check-in failed for user ${user.id}:`, err)
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Pet check-in cron error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
