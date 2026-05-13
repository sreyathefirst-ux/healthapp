'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/Skeleton'
import { useRoutine } from '@/hooks/useRoutine'
import { Pencil, Trash2, Check, X, Plus, Sun, Moon } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface RoutineChecklistProps {
  type: 'morning' | 'night'
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDates(): string[] {
  const today = new Date()
  const day = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export function RoutineChecklist({ type }: RoutineChecklistProps) {
  const { items, checkedIds, completion, loading, toggleItem, removeItem, updateItem, addItem } = useRoutine(type)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTime, setEditTime] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [weekCompletions, setWeekCompletions] = useState<Record<string, boolean>>({})

  const isMorning = type === 'morning'
  const isComplete = completion === 100 && items.length > 0

  // Color tokens
  const accentColor = isMorning ? '#f59e0b' : '#1e40af'
  const accentLight = isMorning ? 'bg-amber-50' : 'bg-blue-50'
  const accentBorder = isMorning ? 'border-amber-200' : 'border-blue-200'
  const accentText = isMorning ? 'text-amber-700' : 'text-blue-700'
  const accentBg = isMorning ? 'bg-amber-400' : 'bg-blue-700'
  const progressFrom = isMorning ? 'from-amber-300' : 'from-blue-600'
  const progressTo = isMorning ? 'to-amber-400' : 'to-blue-800'
  const headerGrad = isMorning
    ? 'from-amber-50 to-orange-50 border-amber-100'
    : 'from-blue-50 to-indigo-50 border-blue-100'
  const checkColor = isMorning ? 'text-amber-500' : 'text-blue-600'
  const checkedRowBg = isMorning ? 'rgba(245,158,11,0.07)' : 'rgba(30,64,175,0.06)'

  const otherHref = isMorning ? '/routine/night' : '/routine/morning'
  const otherLabel = isMorning ? 'Switch to Night Routine →' : '← Switch to Morning Routine'

  useEffect(() => {
    async function fetchWeekCompletions() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dates = getWeekDates()
      const { data } = await supabase
        .from('daily_logs')
        .select('date, morning_routine_completion, night_routine_completion')
        .eq('user_id', user.id)
        .in('date', dates)
      if (!data) return
      const completionKey = isMorning ? 'morning_routine_completion' : 'night_routine_completion'
      const map: Record<string, boolean> = {}
      for (const row of data) {
        map[row.date] = (row[completionKey] ?? 0) === 100
      }
      setWeekCompletions(map)
    }
    fetchWeekCompletions()
  }, [isMorning, completion])

  function startEdit(id: string, label: string, time_target?: string) {
    setEditingId(id)
    setEditLabel(label)
    setEditTime(time_target || '')
  }

  async function saveEdit() {
    if (!editingId || !editLabel.trim()) return
    await updateItem(editingId, editLabel.trim(), editTime.trim())
    setEditingId(null)
  }

  function cancelEdit() { setEditingId(null) }

  async function handleAddItem() {
    if (!newLabel.trim()) return
    await addItem(newLabel.trim(), newTime.trim())
    setNewLabel('')
    setNewTime('')
    setShowAddForm(false)
  }

  const weekDates = getWeekDates()
  const todayStr = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Routine selector tabs */}
      <div className="flex gap-2">
        <Link href="/routine/morning" className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all ${
          isMorning
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
        }`}>
          <Sun size={16} />
          Morning
        </Link>
        <Link href="/routine/night" className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all ${
          !isMorning
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
        }`}>
          <Moon size={16} />
          Night
        </Link>
      </div>

      {/* Weekly tracker */}
      <div className={`bg-gradient-to-br ${headerGrad} border rounded-2xl p-5`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">This Week</p>
        <div className="flex gap-2">
          {DAYS.map((day, i) => {
            const date = weekDates[i]
            const done = weekCompletions[date] ?? false
            const isToday = date === todayStr
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                <span className={`text-xs font-medium ${isToday ? accentText : 'text-slate-400'}`}>{day}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? `${accentBg} border-transparent`
                    : isToday
                    ? `bg-white ${accentBorder}`
                    : 'bg-white border-slate-200'
                }`}>
                  {done && <Check size={14} className="text-white" strokeWidth={3} />}
                  {!done && isToday && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Checklist card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isMorning
              ? <Sun size={20} className="text-amber-500" />
              : <Moon size={20} className="text-blue-600" />}
            <h2 className="font-bold text-text-primary">
              {isMorning ? 'Morning Routine' : 'Night Routine'}
            </h2>
          </div>
          <span className="text-sm font-medium text-text-secondary">
            {checkedIds.length}/{items.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full mb-5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${progressFrom} ${progressTo}`}
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-3xl block mb-2">{isMorning ? '☀️' : '🌙'}</span>
            <p className="text-text-secondary text-sm mb-3">No routine items yet</p>
            <Link href="/settings/routine" className={`text-sm font-medium hover:underline ${accentText}`}>
              Set up routine →
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const checked = checkedIds.includes(item.id)

              if (editingId === item.id) {
                return (
                  <div key={item.id} className={`flex items-center gap-2 p-2 rounded-xl ${accentLight} border ${accentBorder}`}>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                      placeholder="Item label..."
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                      placeholder="7:00 AM"
                      className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none"
                    />
                    <button onClick={saveEdit} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-text-secondary transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-1 rounded-xl hover:bg-slate-50 transition-colors group"
                  style={{ backgroundColor: checked ? checkedRowBg : undefined }}
                >
                  <label className="flex items-center gap-3 p-3 flex-1 cursor-pointer">
                    <div
                      onClick={() => toggleItem(item.id, !checked)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        checked
                          ? `border-transparent ${accentBg}`
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`flex-1 text-sm font-medium transition-all ${checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                      {item.label}
                    </span>
                    {item.time_target && (
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${accentLight} ${accentText}`}>
                        {item.time_target}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(item.id, item.label, item.time_target)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add item */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          {showAddForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setShowAddForm(false) }}
                autoFocus
                placeholder="New item..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none"
              />
              <input
                type="text"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setShowAddForm(false) }}
                placeholder="7:00 AM"
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none"
              />
              <button onClick={handleAddItem} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
                <Check size={14} />
              </button>
              <button onClick={() => setShowAddForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-text-secondary transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className={`flex items-center gap-1.5 text-sm font-medium hover:underline ${accentText}`}
            >
              <Plus size={14} />
              Add item
            </button>
          )}
        </div>
      </div>

      {/* Completion celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`${accentLight} border ${accentBorder} rounded-2xl p-6 text-center`}
          >
            <div className="text-5xl mb-2">🎉</div>
            <h3 className={`font-bold text-lg ${accentText}`}>
              {isMorning ? 'Morning complete!' : 'Night routine done!'}
            </h3>
            <p className="text-text-secondary text-sm mt-1">Amazing work! Your streak is growing 🔥</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch routine link */}
      <Link href={otherHref} className="block">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors">
          {otherLabel}
        </div>
      </Link>
    </div>
  )
}
