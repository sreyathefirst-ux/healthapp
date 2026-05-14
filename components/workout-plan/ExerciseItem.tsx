'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, X, Check } from 'lucide-react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
  index: number
  gender: 'male' | 'female'
  onGifLoaded?: (exerciseId: string, gifUrl: string) => void
  onRemove?: () => void
}

export function ExerciseItem({ exercise, index, gender, onGifLoaded, onRemove }: ExerciseItemProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [gifUrl2, setGifUrl2] = useState<string | null>(null)
  const [isAnimated, setIsAnimated] = useState(false)
  const [gifError, setGifError] = useState(false)
  const [gifLoading, setGifLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState(false)
  // For two-frame flip animation (free DB fallback)
  const [frameIndex, setFrameIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Always re-fetch when name or gender changes — never short-circuit on cached values
  useEffect(() => {
    setGifUrl(null)
    setGifUrl2(null)
    setGifError(false)
    setIsAnimated(false)
    setFrameIndex(0)
    setGifLoading(true)

    fetch(`/api/exercises/gif?name=${encodeURIComponent(exercise.name)}&gender=${gender}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.gif_url) {
          setGifUrl(d.gif_url)
          setGifUrl2(d.gif_url2 ?? null)
          setIsAnimated(d.is_animated ?? false)
          onGifLoaded?.(exercise.id, d.gif_url)
        } else {
          setGifError(true)
        }
      })
      .catch(() => setGifError(true))
      .finally(() => setGifLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.name, gender])

  // Flip between two frames when we have static images (free DB)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (gifUrl && gifUrl2 && !isAnimated) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((i) => (i === 0 ? 1 : 0))
      }, 700)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [gifUrl, gifUrl2, isAnimated])

  const frames = [gifUrl, gifUrl2].filter(Boolean) as string[]
  const displayUrl = frames.length > 1 ? frames[frameIndex] : (gifUrl ?? null)
  const hasMedia = !!displayUrl && !gifError
  const isPlaying = hasMedia && (isAnimated || frames.length > 1)

  const restLabel = exercise.rest_seconds
    ? exercise.rest_seconds >= 60
      ? `${Math.floor(exercise.rest_seconds / 60)}m${exercise.rest_seconds % 60 ? `${exercise.rest_seconds % 60}s` : ''}`
      : `${exercise.rest_seconds}s`
    : null

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">

        {/* Video player area */}
        <div
          onClick={() => hasMedia && setModalOpen(true)}
          className={`relative w-full h-56 bg-slate-900 ${hasMedia ? 'cursor-pointer group' : ''}`}
        >
          {gifLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
            </div>
          ) : hasMedia ? (
            <>
              <img
                src={displayUrl}
                alt={exercise.name}
                className="w-full h-full object-cover"
                onError={() => setGifError(true)}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <Play size={22} className="text-slate-800 fill-slate-800 ml-1" />
                </div>
              </div>
              {/* Playing badge — only shown when content is actually animated/flipping */}
              {isPlaying && (
                <span className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {isAnimated ? 'Playing' : 'Demo'}
                </span>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center">
                <Play size={24} className="text-slate-400 ml-1" />
              </div>
              <span className="text-sm font-medium text-slate-400 text-center px-4">{exercise.name}</span>
              <span className="text-xs text-slate-600">Demo unavailable</span>
            </div>
          )}

          {/* Exercise number + gender badge row */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
              #{index + 1}
            </div>
            <div className={`text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${gender === 'female' ? 'bg-pink-500/70' : 'bg-blue-500/70'}`}>
              {gender === 'female' ? '♀ Female' : '♂ Male'}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-text-primary mb-3">{exercise.name}</h3>

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

          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <button
              onClick={() => setChecked(!checked)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                checked
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'
              }`}
            >
              <Check size={14} />
              {checked ? 'Completed' : 'Complete'}
            </button>
            {onRemove && (
              <button
                onClick={onRemove}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-200 transition-all"
              >
                <X size={14} />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && hasMedia && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={displayUrl}
                alt={exercise.name}
                className="w-full object-cover max-h-96"
              />
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <h3 className="text-white font-bold text-lg">{exercise.name}</h3>
                <p className="text-slate-300 text-sm">
                  {exercise.sets && exercise.reps && `${exercise.sets} sets × ${exercise.reps} reps`}
                  {restLabel && ` · Rest: ${restLabel}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
