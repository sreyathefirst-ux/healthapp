'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useRoutine } from '@/hooks/useRoutine'
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react'
import Link from 'next/link'

interface RoutineChecklistProps {
  type: 'morning' | 'night'
}

export function RoutineChecklist({ type }: RoutineChecklistProps) {
  const { items, checkedIds, completion, loading, toggleItem, removeItem, updateItem, addItem } = useRoutine(type)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editTime, setEditTime] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const isComplete = completion === 100 && items.length > 0

  const isMorning = type === 'morning'
  const emoji = isMorning ? '☀️' : '🌙'
  const title = isMorning ? 'Morning Routine' : 'Night Routine'
  const otherHref = isMorning ? '/routine/night' : '/routine/morning'
  const otherLabel = isMorning ? 'Night Routine →' : '← Morning Routine'

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

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleAddItem() {
    if (!newLabel.trim()) return
    await addItem(newLabel.trim(), newTime.trim())
    setNewLabel('')
    setNewTime('')
    setShowAddForm(false)
  }

  if (loading) {
    return (
      <Card>
        <Skeleton className="h-6 w-1/3 mb-4" />
        <Skeleton className="h-3 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card>
        <div className="text-center py-8">
          <span className="text-4xl block mb-3">{emoji}</span>
          <h3 className="font-semibold text-text-primary mb-2">No routine items yet</h3>
          <p className="text-text-secondary text-sm mb-4">Set up your routine in Settings</p>
          <Link href="/settings/routine" className="text-accent-primary text-sm font-medium hover:underline">
            Set up routine →
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <h2 className="font-bold text-text-primary">{title}</h2>
          </div>
          <span className="text-sm font-medium text-text-secondary">
            {checkedIds.length} of {items.length} ({completion}%)
          </span>
        </div>

        <ProgressBar
          value={completion}
          color={isMorning ? '#A8D5BA' : '#D4C5E8'}
          className="mb-5"
        />

        <div className="space-y-1">
          {items.map((item) => {
            const checked = checkedIds.includes(item.id)

            if (editingId === item.id) {
              return (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl bg-accent-primary/5 border border-accent-primary/20">
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                    autoFocus
                    placeholder="Item label..."
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary"
                  />
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                    placeholder="7:00 AM"
                    className="w-24 px-3 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary"
                  />
                  <button onClick={saveEdit} className="p-1.5 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 text-text-primary transition-colors">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className="flex items-center gap-1 rounded-xl hover:bg-bg transition-colors group"
                style={{ backgroundColor: checked ? 'rgba(168,213,186,0.08)' : undefined }}
              >
                <label className="flex items-center gap-3 p-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleItem(item.id, e.target.checked)}
                    className="w-5 h-5 rounded-md border-2 border-accent-primary accent-accent-primary cursor-pointer flex-shrink-0"
                  />
                  <span className={`flex-1 text-sm font-medium transition-all ${checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                    {item.label}
                  </span>
                  {item.time_target && (
                    <span className="text-xs text-text-secondary bg-accent-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {item.time_target}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(item.id, item.label, item.time_target)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary hover:text-text-primary transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add item UI */}
        <div className="mt-3 pt-3 border-t border-vitalia-border">
          {showAddForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setShowAddForm(false) }}
                autoFocus
                placeholder="New item..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary"
              />
              <input
                type="text"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setShowAddForm(false) }}
                placeholder="7:00 AM"
                className="w-24 px-3 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary"
              />
              <button onClick={handleAddItem} className="p-1.5 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 text-text-primary transition-colors">
                <Check size={14} />
              </button>
              <button onClick={() => setShowAddForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm text-accent-primary font-medium hover:underline"
            >
              <Plus size={14} />
              Add item
            </button>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-accent-sage/20 border border-accent-sage/30 rounded-card p-6 text-center"
          >
            <div className="text-5xl mb-2">🎉</div>
            <h3 className="font-bold text-accent-primary text-lg">
              {isMorning ? 'Morning complete!' : 'Night routine done!'}
            </h3>
            <p className="text-text-secondary text-sm mt-1">Amazing work! Your streak is growing 🔥</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={otherHref} className="block">
        <div className="bg-white rounded-card shadow-card border border-accent-primary/15 p-4 text-center text-accent-primary text-sm font-medium hover:bg-accent-primary/5 transition-colors">
          {otherLabel}
        </div>
      </Link>
    </div>
  )
}
