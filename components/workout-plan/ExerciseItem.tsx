'use client'

import { useState } from 'react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
}

export function ExerciseItem({ exercise }: ExerciseItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [gifError, setGifError] = useState(false)

  return (
    <div className="p-4 bg-bg rounded-xl space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-text-primary text-sm">{exercise.name}</h4>
          <div className="flex gap-2 mt-1 flex-wrap">
            {exercise.sets && exercise.reps && (
              <span className="text-xs text-text-secondary">{exercise.sets} sets × {exercise.reps} reps</span>
            )}
            {exercise.duration_seconds && (
              <span className="text-xs text-text-secondary">{Math.floor(exercise.duration_seconds / 60)}:{String(exercise.duration_seconds % 60).padStart(2, '0')} mins</span>
            )}
            {exercise.rest_seconds && (
              <span className="text-xs text-text-secondary">Rest: {exercise.rest_seconds}s</span>
            )}
          </div>
        </div>
        {exercise.gif_url && !gifError && (
          <img
            src={exercise.gif_url}
            alt={exercise.name}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            onError={() => setGifError(true)}
          />
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-accent-primary font-medium hover:underline"
      >
        {expanded ? 'Hide explanation' : 'Why this? →'}
      </button>

      {expanded && (
        <p className="text-xs text-text-secondary leading-relaxed">{exercise.reasoning}</p>
      )}
    </div>
  )
}
