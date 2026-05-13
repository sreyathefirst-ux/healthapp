'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, Play, X, Check, Bookmark } from 'lucide-react'
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
      setGifUrl(exercise.gif_url)
      return
    }
    if (gifUrl || gifError) return

    setGifLoading(true)
    fetch(`/api/exercises/gif?name=${encodeURIComponent(exercise.name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.gif_url) {
          setGifUrl(d.gif_url)
          onGifLoaded?.(exercise.id, d.gif_url)
        } else {
          setGifError(true)
        }
      })
      .catch(() => setGifError(true))
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">

        {/* Full-width image on top */}
        <div
          onClick={() => hasImage && setModalOpen(true)}
          className={`relative w-full h-56 bg-slate-100 ${hasImage ? 'cursor-pointer group' : ''}`}
        >
          {gifLoading ? (
            <div className="skeleton-shimmer w-full h-full" />
          ) : hasImage ? (
            <>
              <img
                src={gifUrl}
                alt={exercise.name}
                className="w-full h-full object-cover"
                onError={() => setGifError(true)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Play size={20} className="text-slate-800 fill-slate-800 ml-0.5" />
                </div>
              </div>
              <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-medium">
                Tap for form
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
                <Dumbbell size={24} className="text-slate-400" />
              </div>
              {exercise.sets && exercise.reps && (
                <span className="text-sm font-bold text-slate-400">
                  {exercise.sets} × {exercise.reps}
                </span>
              )}
            </div>
          )}

          {/* Exercise number badge */}
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            #{index + 1}
          </div>
        </div>

        {/* Details below image */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-text-primary mb-3">{exercise.name}</h3>

          {/* Specs chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {exercise.sets && (
              <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="font-bold text-blue-900 text-sm">{exercise.sets}</span>
                <span className="text-blue-600 text-xs ml-1">sets</span>
              </div>
            )}
            {exercise.reps && (
              <div className="px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                <span className="font-bold text-orange-900 text-sm">×{exercise.reps}</span>
                <span className="text-orange-600 text-xs ml-1">reps</span>
              </div>
            )}
            {exercise.duration_seconds && (
              <div className="px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                <span className="font-bold text-orange-900 text-sm">
                  {Math.floor(exercise.duration_seconds / 60)}:{String(exercise.duration_seconds % 60).padStart(2, '0')}
                </span>
                <span className="text-orange-600 text-xs ml-1">min</span>
              </div>
            )}
            {restLabel && (
              <div className="px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-purple-600 text-xs">Rest:</span>
                <span className="font-bold text-purple-900 text-sm ml-1">{restLabel}</span>
              </div>
            )}
          </div>

          {/* Why this exercise */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-teal hover:text-accent-sage font-medium text-sm flex items-center gap-1 mb-3 transition-colors"
          >
            {expanded ? '▾ Hide explanation' : '▸ Why this exercise?'}
          </button>
          {expanded && (
            <p className="text-xs text-text-secondary leading-relaxed mb-4 bg-slate-50 rounded-xl p-3 border border-slate-200">
              {exercise.reasoning}
            </p>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => setChecked(!checked)}
              title="Mark done"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                checked
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Check size={14} />
              {checked ? 'Done' : 'Mark done'}
            </button>
            <button
              onClick={() => setSaved(!saved)}
              title="Save exercise"
              className={`p-2 rounded-lg transition-all ${
                saved ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                title="Remove exercise"
                className="ml-auto p-2 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* GIF Modal */}
      {modalOpen && hasImage && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
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
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center shadow-md transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 border-t border-slate-200">
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
