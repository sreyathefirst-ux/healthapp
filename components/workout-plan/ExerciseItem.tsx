'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Dumbbell, Check, X } from 'lucide-react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
  index: number
  gender: 'male' | 'female'
  onVideoLoaded?: (exerciseId: string, videoId: string, thumbnailUrl: string, videoGender: 'male' | 'female') => void
  onRemove?: () => void
}

// Only re-render when exercise identity, name, gender, or index actually changes.
// Intentionally excludes exercise.video_id so that onVideoLoaded updating the
// exercise object in Supabase does NOT trigger a re-render → breaks the fetch loop.
function arePropsEqual(prev: ExerciseItemProps, next: ExerciseItemProps) {
  return (
    prev.exercise.id === next.exercise.id &&
    prev.exercise.name === next.exercise.name &&
    prev.gender === next.gender &&
    prev.index === next.index
  )
}

export const ExerciseItem = React.memo(function ExerciseItem({
  exercise,
  index,
  gender,
  onVideoLoaded,
  onRemove,
}: ExerciseItemProps) {
  // Seed state from Supabase cache on first render if gender matches
  const hasCached = !!exercise.video_id && exercise.video_gender === gender
  const [videoId, setVideoId] = useState<string | null>(hasCached ? exercise.video_id! : null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(hasCached ? (exercise.thumbnail_url ?? null) : null)
  const [loading, setLoading] = useState(!hasCached)
  const [playing, setPlaying] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState(false)

  // Tracks which name::gender combo we last fetched — prevents duplicate calls
  const fetchedKey = useRef(hasCached ? `${exercise.name}::${gender}` : '')

  useEffect(() => {
    const key = `${exercise.name}::${gender}`
    if (fetchedKey.current === key) return // already loaded for this combo
    fetchedKey.current = key

    setPlaying(false)
    setVideoError(false)

    // Use Supabase-cached data if it matches current gender
    if (exercise.video_id && exercise.video_gender === gender) {
      setVideoId(exercise.video_id)
      setThumbnailUrl(exercise.thumbnail_url ?? null)
      setLoading(false)
      return
    }

    setVideoId(null)
    setThumbnailUrl(null)
    setLoading(true)

    fetch(`/api/exercises/video?exercise=${encodeURIComponent(exercise.name)}&gender=${gender}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.videoId) {
          setVideoId(d.videoId)
          setThumbnailUrl(d.thumbnailUrl ?? null)
          // Save to Supabase via parent — captured via closure at call time
          onVideoLoaded?.(exercise.id, d.videoId, d.thumbnailUrl ?? '', gender)
        }
        // If null: stay with null, fallback placeholder renders
      })
      .catch(() => { /* silent — fallback shows */ })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.name, gender])

  const restLabel = exercise.rest_seconds
    ? exercise.rest_seconds >= 60
      ? `${Math.floor(exercise.rest_seconds / 60)}m${exercise.rest_seconds % 60 ? `${exercise.rest_seconds % 60}s` : ''}`
      : `${exercise.rest_seconds}s`
    : null

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow mb-3"
      style={{ border: '1px solid #EBEBF0', borderRadius: 16 }}
    >
      {/* ── Video area ── */}
      <div style={{ position: 'relative', height: 200, background: '#F8F9FA', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>

        {loading ? (
          /* Loading skeleton */
          <div className="w-full h-full flex items-center justify-center animate-pulse bg-slate-100">
            <Dumbbell size={28} className="text-slate-300" />
          </div>

        ) : playing && videoId && !videoError ? (
          /* ── YouTube embed ── */
          <div className="relative w-full h-full" style={{ height: 220 }}>
            <iframe
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0&showinfo=0`}
              width="100%"
              height="220"
              style={{ border: 'none', display: 'block', borderRadius: '16px 16px 0 0', opacity: 1, transition: 'opacity 0.3s ease' }}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={exercise.name}
              onError={() => { setVideoError(true); setPlaying(false) }}
            />
            <button
              onClick={() => setPlaying(false)}
              className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              aria-label="Close video"
            >
              <X size={14} className="text-white" />
            </button>
          </div>

        ) : videoId && thumbnailUrl && !videoError ? (
          /* ── Thumbnail with play button ── */
          <button
            className="w-full h-full relative block focus:outline-none group"
            onClick={() => setPlaying(true)}
            style={{ height: 200 }}
            aria-label={`Play ${exercise.name} tutorial`}
          >
            <img
              src={thumbnailUrl}
              alt={exercise.name}
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
              onError={() => setVideoError(true)}
            />
            {/* Gradient overlay */}
            <div
              className="absolute inset-0 transition-opacity"
              style={{
                background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.30) 100%)',
                opacity: 1,
              }}
            />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="flex items-center justify-center rounded-full bg-white shadow-lg transition-transform group-hover:scale-110"
                style={{ width: 52, height: 52 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="ml-1">
                  <polygon points="4,2 18,10 4,18" fill="#1A1A2E" />
                </svg>
              </div>
            </div>
          </button>

        ) : (
          /* ── Fallback placeholder ── */
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ background: '#fff' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(93,218,184,0.12)' }}
            >
              <Dumbbell size={26} style={{ color: '#5DDAB8' }} />
            </div>
            <span
              className="text-center px-6"
              style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 16, color: '#1A1A2E' }}
            >
              {exercise.name}
            </span>
            {exercise.sets && exercise.reps && (
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 14, color: '#6B6B8A' }}>
                {exercise.sets} sets × {exercise.reps} reps
              </span>
            )}
          </div>
        )}

        {/* Exercise number badge */}
        {!playing && (
          <div
            className="absolute top-3 left-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', zIndex: 10 }}
          >
            #{index + 1}
          </div>
        )}

        {/* Gender badge */}
        {!playing && (videoId && !videoError) && (
          <div
            className="absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: gender === 'female' ? 'rgba(236,72,153,0.70)' : 'rgba(59,130,246,0.70)',
              backdropFilter: 'blur(4px)',
              zIndex: 10,
            }}
          >
            {gender === 'female' ? '♀ Female' : '♂ Male'}
          </div>
        )}
      </div>

      {/* YouTube attribution — required by ToS */}
      {(videoId && !videoError) && (
        <div className="px-5 pt-1.5 flex items-center gap-1">
          <span style={{ fontSize: 10, color: '#9B9BAA' }}>via YouTube</span>
        </div>
      )}

      {/* ── Details ── */}
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
  )
}, arePropsEqual)
