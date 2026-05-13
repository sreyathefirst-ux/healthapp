'use client'

import { useState, useEffect } from 'react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
}

export function ExerciseItem({ exercise }: ExerciseItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [gifUrl, setGifUrl] = useState<string | null>(exercise.gif_url || null)
  const [gifError, setGifError] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)

  useEffect(() => {
    if (gifUrl || gifError) return
    setGifLoading(true)
    fetch(`/api/exercises/gif?name=${encodeURIComponent(exercise.name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.gif_url) setGifUrl(d.gif_url)
        else setGifError(true)
      })
      .catch(() => setGifError(true))
      .finally(() => setGifLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.name])

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
              <span className="text-xs text-text-secondary">
                {Math.floor(exercise.duration_seconds / 60)}:{String(exercise.duration_seconds % 60).padStart(2, '0')} min
              </span>
            )}
            {exercise.rest_seconds && (
              <span className="text-xs text-text-secondary">Rest: {exercise.rest_seconds}s</span>
            )}
          </div>
        </div>

        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-bg flex items-center justify-center">
          {gifLoading ? (
            <div className="skeleton-shimmer w-full h-full" />
          ) : gifUrl && !gifError ? (
            <img
              src={gifUrl}
              alt={exercise.name}
              className="w-full h-full object-cover"
              onError={() => setGifError(true)}
            />
          ) : (
            <span className="text-2xl">💪</span>
          )}
        </div>
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
