'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RoutineItem, DailyLog } from '@/types'

export function useRoutine(type: 'morning' | 'night') {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [checkedIds, setCheckedIds] = useState<string[]>([])
  const [completion, setCompletion] = useState(0)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function fetchRoutine() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [routineRes, logRes] = await Promise.all([
        supabase.from('routine_preferences').select('*').eq('user_id', user.id).single(),
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).single(),
      ])

      const itemsKey = type === 'morning' ? 'morning_items' : 'night_items'
      const checkedKey = type === 'morning' ? 'morning_items_checked' : 'night_items_checked'
      const completionKey = type === 'morning' ? 'morning_routine_completion' : 'night_routine_completion'

      setItems(routineRes.data?.[itemsKey] || [])
      setCheckedIds((logRes.data as DailyLog)?.[checkedKey] || [])
      setCompletion((logRes.data as DailyLog)?.[completionKey] || 0)
      setLoading(false)
    }
    fetchRoutine()
  }, [type, today])

  async function toggleItem(itemId: string, checked: boolean) {
    // Optimistic update
    setCheckedIds((prev) => checked ? [...prev, itemId] : prev.filter((id) => id !== itemId))
    const newCompletion = checked
      ? Math.round(((checkedIds.length + 1) / Math.max(items.length, 1)) * 100)
      : Math.round(((checkedIds.length - 1) / Math.max(items.length, 1)) * 100)
    setCompletion(newCompletion)

    const res = await fetch('/api/routine/log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, itemId, checked, date: today }),
    })
    const data = await res.json()
    if (data.completion !== undefined) setCompletion(data.completion)
  }

  return { items, checkedIds, completion, loading, toggleItem }
}
