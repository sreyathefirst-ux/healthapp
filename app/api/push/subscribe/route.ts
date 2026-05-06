import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { subscription } = await req.json()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
