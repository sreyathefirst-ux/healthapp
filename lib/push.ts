import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushNotification(
  subscription: { endpoint: string; auth: string; p256dh: string },
  payload: { title: string; body: string; icon?: string }
) {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { auth: subscription.auth, p256dh: subscription.p256dh },
    },
    JSON.stringify(payload)
  )
}

export { webpush }
