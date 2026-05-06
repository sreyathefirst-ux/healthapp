'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export default function NotificationsSettingsPage() {
  const { toast } = useToast()
  const [wakeTime, setWakeTime] = useState('07:00')
  const [sleepTime, setSleepTime] = useState('23:00')
  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
      setPushEnabled(Notification.permission === 'granted')
    }
    async function fetchPrefs() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('routine_preferences').select('wake_time, sleep_time').eq('user_id', user.id).single()
      if (data) {
        setWakeTime(data.wake_time || '07:00')
        setSleepTime(data.sleep_time || '23:00')
      }
    }
    fetchPrefs()
  }, [])

  async function enablePush() {
    if (!('Notification' in window)) {
      toast('Push notifications not supported in this browser', 'error')
      return
    }
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    if (permission === 'granted') {
      setPushEnabled(true)
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub }),
        })
        toast('Notifications enabled! 🔔', 'success')
      } catch (err) {
        toast('Failed to set up notifications', 'error')
      }
    } else {
      toast('Notification permission denied', 'error')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('routine_preferences').upsert({ user_id: user.id, wake_time: wakeTime, sleep_time: sleepTime })
      toast('Notification times saved!', 'success')
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>

        <Card>
          <h2 className="font-bold text-text-primary mb-3">Push Notifications</h2>
          <p className="text-text-secondary text-sm mb-4">
            Get reminders for your routines, meals, and workouts throughout the day.
          </p>
          {pushEnabled ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <span>✅</span> Push notifications are enabled
            </div>
          ) : (
            <Button onClick={enablePush} variant="primary">
              🔔 Enable Notifications
            </Button>
          )}
          {notifPermission === 'denied' && (
            <p className="text-sm text-red-600 mt-2">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-text-primary mb-4">Reminder Schedule</h2>
          <p className="text-text-secondary text-sm mb-4">
            Set your daily schedule so reminders arrive at the right time.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Wake Up Time</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Bedtime</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-3">
            You&apos;ll receive reminders for morning routine, workouts, meals, and night routine based on these times.
          </p>
        </Card>

        <Button onClick={handleSave} loading={saving} className="w-full">
          Save Schedule
        </Button>
      </div>
    </AppShell>
  )
}
