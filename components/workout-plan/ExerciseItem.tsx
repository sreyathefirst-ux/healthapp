'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, Play, X } from 'lucide-react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
  index: number
  onGifLoaded?: (exerciseId: string, gifUrl: string) => void
  onRemove?: () => void
}

export function ExerciseItem({ exercise, index, onGifLoaded, onRemove }: ExerciseItemProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(exercise.gif_url || null)
  const [gifError, setGifError] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
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

  const hasImage = gifUrl && !gifError

  const restLabel = exercise.rest_seconds
    ? exercise.rest_seconds >= 60
      ? `${Math.floor(exercise.rest_seconds / 60)}m${exercise.rest_seconds % 60 ? `${exercise.rest_seconds % 60}s` : ''}`
      : `${exercise.rest_seconds}s`
    : null

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-vitalia-border hover:shadow-card-hover transition-shadow">
        <div className="flex flex-col sm:flex-row gap-6">

          {/* Thumbnail — click to open modal */}
          <div
            onClick={() => hasImage && setModalOpen(true)}
            className={`sm:w-40 flex-shrink-0 ${hasImage ? 'cursor-pointer group' : ''}`}
          >
            <div className="relative rounded-xl overflow-hidden h-48 sm:h-52 bg-bg-3">
              {gifLoading ? (
                <div className="skeleton-shimmer w-full h-full" />
              ) : hasImage ? (
                <>
                  <img
                    src={gifUrl}
                    alt={exercise.name}
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error('[ExerciseItem] image load failed:', exercise.name)
                      setGifError(true)
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Play size={36} className="text-white fill-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Dumbbell size={28} className="text-vitalia-muted" />
                  {exercise.sets && exercise.reps && (
                    <span className="text-xs font-semibold text-vitalia-muted">
                      {exercise.sets}×{exercise.reps}
                    </span>
                  )}
                </div>
              )}
            </div>
            {hasImage && (
              <p className="text-xs text-text-secondary mt-1.5 text-center">Click to see form</p>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-secondary mb-1">Exercise {index + 1}</p>
            <h3 className="text-xl font-bold text-text-primary mb-4">{exercise.name}</h3>

            {/* Specs chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {exercise.sets && (
                <div className="px-3 py-1.5 bg-blue-100 rounded-lg border border-blue-200">
                  <span className="font-semibold text-blue-900 text-sm">{exercise.sets}</span>
                  <span className="text-blue-700 text-xs ml-1">sets</span>
                </div>
              )}
              {exercise.reps && (
                <div className="px-3 py-1.5 bg-orange-100 rounded-lg border border-orange-200">
                  <span className="font-semibold text-orange-900 text-sm">×{exercise.reps}</span>
                  <span className="text-orange-700 text-xs ml-1">reps</span>
                </div>
              )}
              {exercise.duration_seconds && (
                <div className="px-3 py-1.5 bg-orange-100 rounded-lg border border-orange-200">
                  <span className="font-semibold text-orange-900 text-sm">
                    {Math.floor(exercise.duration_seconds / 60)}:{String(exercise.duration_seconds % 60).padStart(2, '0')}
                  </span>
                  <span className="text-orange-700 text-xs ml-1">min</span>
                </div>
              )}
              {restLabel && (
                <div className="px-3 py-1.5 bg-purple-100 rounded-lg border border-purple-200">
                  <span className="text-purple-700 text-xs">Rest:</span>
                  <span className="font-semibold text-purple-900 text-sm ml-1">{restLabel}</span>
                </div>
              )}
            </div>

            {/* Why this exercise */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-teal hover:text-accent-sage font-medium text-sm flex items-center gap-1 mb-4 transition-colors"
            >
              {expanded ? '▾ Hide explanation' : '▸ Why this exercise?'}
            </button>
            {expanded && (
              <p className="text-xs text-text-secondary leading-relaxed mb-4 bg-bg-2 rounded-lg p-3">
                {exercise.reasoning}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChecked(!checked)}
                title="Mark done"
                className={`w-10 h-10 rounded-xl text-lg transition-all ${
                  checked ? 'bg-teal/20 ring-2 ring-teal text-teal' : 'hover:bg-bg-2 text-text-secondary'
                }`}
              >
                ✓
              </button>
              <button
                onClick={() => setSaved(!saved)}
                title="Save exercise"
                className={`w-10 h-10 rounded-xl text-lg transition-all ${
                  saved ? 'bg-lavender/20 ring-2 ring-lavender' : 'hover:bg-bg-2 text-text-secondary'
                }`}
              >
                {saved ? '🔖' : '☐'}
              </button>
              {onRemove && (
                <button
                  onClick={onRemove}
                  title="Remove exercise"
                  className="w-10 h-10 rounded-xl text-lg hover:bg-red-50 text-red-500 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GIF Modal */}
      {modalOpen && hasImage && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={gifUrl!}
                alt={exercise.name}
                className="w-full object-cover max-h-80"
              />
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white hover:bg-bg-2 flex items-center justify-center shadow-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 border-t border-vitalia-border">
              <h3 className="text-lg font-bold text-text-primary mb-1">{exercise.name}</h3>
              <p className="text-text-secondary text-sm">
                {exercise.sets && exercise.reps && `${exercise.sets} sets × ${exercise.reps} reps`}
                {restLabel && ` · Rest: ${restLabel}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
