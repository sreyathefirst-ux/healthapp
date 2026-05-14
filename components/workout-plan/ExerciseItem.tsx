'use client'

import { useState, useEffect } from 'react'
import { Dumbbell, X, Check, Play } from 'lucide-react'
import { Exercise } from '@/types'

interface ExerciseItemProps {
  exercise: Exercise
  index: number
  gender: 'male' | 'female'
  onVideoLoaded?: (exerciseId: string, videoId: string, thumbnailUrl: string, videoGender: 'male' | 'female') => void
  onRemove?: () => void
}

export function ExerciseItem({ exercise, index, gender, onVideoLoaded, onRemove }: ExerciseItemProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setPlaying(false)

    // Use Supabase-cached values if they match the current gender
    if (exercise.video_id && exercise.thumbnail_url && exercise.video_gender === gender) {
      setVideoId(exercise.video_id)
      setThumbnailUrl(exercise.thumbnail_url)
      setVideoTitle(null)
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
          setVideoTitle(d.title ?? null)
          onVideoLoaded?.(exercise.id, d.videoId, d.thumbnailUrl ?? '', gender)
        }
      })
      .catch(() => {/* silent — fallback placeholder shown */})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.name, gender, exercise.video_id, exercise.video_gender])

  const restLabel = exercise.rest_seconds
    ? exercise.rest_seconds >= 60
      ? `${Math.floor(exercise.rest_seconds / 60)}m${exercise.rest_seconds % 60 ? `${exercise.rest_seconds % 60}s` : ''}`
      : `${exercise.rest_seconds}s`
    : null

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
      style={{ border: '1px solid #EBEBF0' }}
    >
      {/* ── Video / thumbnail area ── */}
      <div className="relative overflow-hidden" style={{ height: 200, borderRadius: '16px 16px 0 0' }}>
        {loading ? (
          /* Loading skeleton */
          <div className="w-full h-full bg-slate-100 flex items-center justify-center animate-pulse">
            <Dumbbell size={28} className="text-slate-300" />
          </div>
        ) : playing && videoId ? (
          /* YouTube embed */
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0`}
            width="100%"
            height="200"
            style={{ border: 'none', display: 'block' }}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={exercise.name}
          />
        ) : videoId && thumbnailUrl ? (
          /* Thumbnail with play button overlay */
          <button
            className="w-full h-full relative block focus:outline-none group"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${exercise.name} tutorial`}
          >
            <img
              src={thumbnailUrl}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/15 group-hover:bg-black/30 transition-colors" />
            {/* Play button */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <div
                className="flex items-center justify-center rounded-full bg-white shadow-lg group-hover:scale-105 transition-transform"
                style={{ width: 48, height: 48 }}
              >
                <Play size={20} className="text-slate-800 fill-slate-800 ml-1" />
              </div>
            </div>
          </button>
        ) : (
          /* Fallback — no video found */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
              <Dumbbell size={24} className="text-slate-400" />
            </div>
            <span className="text-base font-semibold text-center px-6 text-slate-700" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              {exercise.name}
            </span>
            {exercise.sets && exercise.reps && (
              <span className="text-sm text-slate-400" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                {exercise.sets} sets × {exercise.reps} reps
              </span>
            )}
          </div>
        )}

        {/* Exercise number badge */}
        {!playing && (
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm z-10">
            #{index + 1}
          </div>
        )}

        {/* Gender badge */}
        {!playing && videoId && (
          <div
            className={`absolute top-3 right-3 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm z-10 ${
              gender === 'female' ? 'bg-pink-500/70' : 'bg-blue-500/70'
            }`}
          >
            {gender === 'female' ? '♀ Female' : '♂ Male'}
          </div>
        )}

        {/* Collapse button when playing */}
        {playing && (
          <button
            onClick={() => setPlaying(false)}
            className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors"
            aria-label="Close video"
          >
            <X size={14} className="text-white" />
          </button>
        )}
      </div>

      {/* YouTube attribution — required by ToS */}
      {(playing || videoId) && (
        <div className="px-5 pt-1.5 pb-0 flex items-center gap-1">
          <span style={{ fontSize: 10, color: '#9B9BAA' }}>via YouTube</span>
          {videoTitle && !playing && (
            <span className="truncate" style={{ fontSize: 10, color: '#9B9BAA' }}>
              · {videoTitle}
            </span>
          )}
        </div>
      )}

      {/* ── Details ── */}
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

        {/* Actions */}
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
}
