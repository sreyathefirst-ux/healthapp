'use client'

import { useState, useEffect } from 'react'
import { Dumbbell } from 'lucide-react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
  onGifLoaded?: (exerciseId: string, gifUrl: string) => void
}

export function ExerciseItem({ exercise, onGifLoaded }: ExerciseItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [gifUrl, setGifUrl] = useState<string | null>(exercise.gif_url || null)
  const [gifError, setGifError] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)

  useEffect(() => {
    // If gif_url is already stored (from Supabase cache), skip the API call
    if (exercise.gif_url) {
      console.log('[ExerciseItem] using cached gif_url for', exercise.name, '→', exercise.gif_url.slice(0, 80))
      setGifUrl(exercise.gif_url)
      return
    }
    if (gifUrl || gifError) return

    console.log('[ExerciseItem] fetching gif for:', exercise.name)
    setGifLoading(true)
    fetch(`/api/exercises/gif?name=${encodeURIComponent(exercise.name)}`)
      .then((r) => r.json())
      .then((d) => {
        console.log('[ExerciseItem] API response for', exercise.name, '→', d.gif_url ?? 'null')
        if (d.gif_url) {
          setGifUrl(d.gif_url)
          onGifLoaded?.(exercise.id, d.gif_url)
        } else {
          setGifError(true)
        }
      })
      .catch((err) => {
        console.error('[ExerciseItem] fetch failed for', exercise.name, ':', err)
        setGifError(true)
      })
      .finally(() => setGifLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.name, exercise.gif_url])

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

        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-bg-2 flex items-center justify-center">
          {gifLoading ? (
            <div className="skeleton-shimmer w-full h-full" />
          ) : gifUrl && !gifError ? (
            <img
              src={gifUrl}
              alt={exercise.name}
              className="w-full h-full object-cover"
              onError={() => {
                console.error('[ExerciseItem] image load failed for', exercise.name, '| url:', gifUrl?.slice(0, 80))
                setGifError(true)
              }}
            />
          ) : (
            // Clean fallback: dumbbell icon + sets×reps, no emoji
            <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full bg-bg-3">
              <Dumbbell size={20} className="text-vitalia-muted" />
              {exercise.sets && exercise.reps && (
                <span className="text-[9px] font-semibold text-vitalia-muted leading-none">
                  {exercise.sets}×{exercise.reps}
                </span>
              )}
            </div>
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
