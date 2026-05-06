'use client'

import { useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { RoutineItem } from '@/types'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

function RoutineEditor({
  title,
  items,
  onChange,
}: {
  title: string
  items: RoutineItem[]
  onChange: (items: RoutineItem[]) => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTime, setEditTime] = useState('')

  function addItem() {
    if (!newLabel.trim()) return
    onChange([...items, { id: generateId(), label: newLabel.trim(), time_target: newTime.trim() || undefined }])
    setNewLabel('')
    setNewTime('')
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  function startEdit(item: RoutineItem) {
    setEditingId(item.id)
    setEditLabel(item.label)
    setEditTime(item.time_target || '')
  }

  function saveEdit() {
    if (!editingId || !editLabel.trim()) return
    onChange(items.map((item) =>
      item.id === editingId
        ? { ...item, label: editLabel.trim(), time_target: editTime.trim() || undefined }
        : item
    ))
    setEditingId(null)
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    onChange(newItems)
  }

  return (
    <Card>
      <h2 className="font-bold text-text-primary mb-4">{title}</h2>

      <div className="space-y-2 mb-4">
        {items.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-4">No items yet. Add your first routine item!</p>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className="rounded-xl group">
              {editingId === item.id ? (
                <div className="flex items-center gap-2 p-2 bg-accent-primary/5 border border-accent-primary/20 rounded-xl">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-accent-primary"
                  />
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    placeholder="7:00 AM"
                    className="w-24 px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-accent-primary"
                  />
                  <button onClick={saveEdit} className="p-1.5 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-bg rounded-xl">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveItem(i, 'up')} disabled={i === 0} className="text-text-secondary hover:text-text-primary disabled:opacity-20 text-xs">▲</button>
                    <button onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1} className="text-text-secondary hover:text-text-primary disabled:opacity-20 text-xs">▼</button>
                  </div>
                  <span className="flex-1 text-sm text-text-primary">{item.label}</span>
                  {item.time_target && (
                    <span className="text-xs text-text-secondary bg-white px-2 py-0.5 rounded-full">{item.time_target}</span>
                  )}
                  <button
                    onClick={() => startEdit(item)}
                    className="text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add new item..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm"
        />
        <input
          type="text"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="7:00 AM"
          className="w-24 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm"
        />
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-accent-primary/20 hover:bg-accent-primary/30 text-text-primary text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </Card>
  )
}

export default function RoutineSettingsPage() {
  const { toast } = useToast()
  const [morningItems, setMorningItems] = useState<RoutineItem[]>([])
  const [nightItems, setNightItems] = useState<RoutineItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function fetchRoutine() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('routine_preferences').select('morning_items, night_items').eq('user_id', user.id).maybeSingle()
      if (data) {
        setMorningItems(data.morning_items || [])
        setNightItems(data.night_items || [])
      }
      setLoaded(true)
    }
    fetchRoutine()
  }, [])

  // Auto-save with debounce whenever items change (after initial load)
  useEffect(() => {
    if (!loaded) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveToSupabase(morningItems, nightItems)
    }, 600)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morningItems, nightItems, loaded])

  async function saveToSupabase(morning: RoutineItem[], night: RoutineItem[]) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('routine_preferences').upsert(
        { user_id: user.id, morning_items: morning, night_items: night },
        { onConflict: 'user_id' }
      )
      if (error) {
        console.error('[routine settings] save error:', error.message)
        toast('Failed to save', 'error')
      }
    } catch (e) {
      console.error('[routine settings] unhandled save error:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Routine Editor</h1>
          {saving && <span className="text-xs text-text-secondary">Saving...</span>}
        </div>
        <p className="text-text-secondary text-sm">Changes save automatically. Reorder using the arrow buttons.</p>

        <RoutineEditor title="☀️ Morning Routine" items={morningItems} onChange={setMorningItems} />
        <RoutineEditor title="🌙 Night Routine" items={nightItems} onChange={setNightItems} />
      </div>
    </AppShell>
  )
}
