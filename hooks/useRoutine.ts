'use client'

import { useState, useEffect, useCallback } from 'react'
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
        supabase.from('routine_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
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
    setCheckedIds((prev) => checked ? [...prev, itemId] : prev.filter((id) => id !== itemId))
    const newCount = checked ? checkedIds.length + 1 : checkedIds.length - 1
    setCompletion(Math.round((newCount / Math.max(items.length, 1)) * 100))

    const res = await fetch('/api/routine/log', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, itemId, checked, date: today }),
    })
    const data = await res.json()
    if (data.completion !== undefined) setCompletion(data.completion)
  }

  const persistItems = useCallback(async (newItems: RoutineItem[]) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const itemsKey = type === 'morning' ? 'morning_items' : 'night_items'
    await supabase.from('routine_preferences').upsert(
      { user_id: user.id, [itemsKey]: newItems },
      { onConflict: 'user_id' }
    )
  }, [type])

  async function removeItem(id: string) {
    const newItems = items.filter((item) => item.id !== id)
    setItems(newItems)
    setCheckedIds((prev) => prev.filter((cid) => cid !== id))
    await persistItems(newItems)
  }

  async function updateItem(id: string, label: string, time_target: string) {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, label, time_target: time_target || undefined } : item
    )
    setItems(newItems)
    await persistItems(newItems)
  }

  return { items, checkedIds, completion, loading, toggleItem, removeItem, updateItem }
}
