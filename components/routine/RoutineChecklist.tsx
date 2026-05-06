'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ChecklistItem } from '@/components/ui/ChecklistItem'
import { useRoutine } from '@/hooks/useRoutine'
import { Skeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'

interface RoutineChecklistProps {
  type: 'morning' | 'night'
}

export function RoutineChecklist({ type }: RoutineChecklistProps) {
  const { items, checkedIds, completion, loading, toggleItem } = useRoutine(type)
  const isComplete = completion === 100 && items.length > 0

  const isMorning = type === 'morning'
  const emoji = isMorning ? '☀️' : '🌙'
  const title = isMorning ? 'Morning Routine' : 'Night Routine'
  const otherHref = isMorning ? '/routine/night' : '/routine/morning'
  const otherLabel = isMorning ? 'Night Routine →' : '← Morning Routine'

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
          color={isMorning ? '#FFE4A0' : '#C9B8FF'}
          className="mb-5"
        />

        <div className="space-y-1">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              id={item.id}
              label={item.label}
              checked={checkedIds.includes(item.id)}
              timeTarget={item.time_target}
              onChange={toggleItem}
            />
          ))}
        </div>
      </Card>

      {/* Celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-accent-sage/30 rounded-card p-6 text-center"
          >
            <div className="text-5xl mb-2">🎉</div>
            <h3 className="font-bold text-green-700 text-lg">
              {isMorning ? 'Morning complete!' : 'Night routine done!'}
            </h3>
            <p className="text-green-600 text-sm mt-1">Amazing work! Your streak is growing 🔥</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={otherHref} className="block">
        <div className="bg-white rounded-card shadow-card p-4 text-center text-accent-primary text-sm font-medium hover:bg-accent-primary/5 transition-colors">
          {otherLabel}
        </div>
      </Link>
    </div>
  )
}
