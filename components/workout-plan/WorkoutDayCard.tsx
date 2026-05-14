'use client'

import { useState, useEffect } from 'react'
import { ExerciseItem } from './ExerciseItem'
import { WorkoutDay, WorkoutLogStatus, Exercise } from '@/types'
import { RefreshCw, Plus, Check, X, ChevronDown, Dumbbell, Clock } from 'lucide-react'

const GENDER_KEY = 'exercise_demo_gender'

interface WorkoutDayCardProps {
  workout: WorkoutDay
  day: string
  logStatus?: WorkoutLogStatus
  onSwap: (workout: WorkoutDay, day: string) => void
  onLog: (day: string, status: WorkoutLogStatus) => void
  onUpdate?: (day: string, updated: WorkoutDay) => void
}

const locationLabel: Record<string, string> = { gym: 'Gym', home: 'Home', class: 'Class' }
const locationEmoji: Record<string, string> = { gym: '🏋️', home: '🏠', class: '🧘' }
const LOCATION_OPTIONS: NonNullable<WorkoutDay['location']>[] = ['gym', 'home', 'class']

function generateId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

export function WorkoutDayCard({ workout, day, logStatus, onSwap, onLog, onUpdate }: WorkoutDayCardProps) {
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSets, setNewSets] = useState('3')
  const [newReps, setNewReps] = useState('10')
  const [newRest, setNewRest] = useState('60')

  // Gender demo toggle — persisted in localStorage
  const [gender, setGender] = useState<'male' | 'female'>('female')

  useEffect(() => {
    const stored = localStorage.getItem(GENDER_KEY)
    if (stored === 'male' || stored === 'female') {
      setGender(stored)
    }
  }, [])

  function handleGenderChange(g: 'male' | 'female') {
    setGender(g)
    localStorage.setItem(GENDER_KEY, g)
  }

  // Location adaptation state
  const [adapting, setAdapting] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [className, setClassName] = useState('')
  const [classType, setClassType] = useState('')
  const [classLocation, setClassLocation] = useState('')

  function handleAddExercise() {
    if (!newName.trim() || !onUpdate) return
    const ex: Exercise = {
      id: generateId(),
      name: newName.trim(),
      sets: parseInt(newSets) || 3,
      reps: parseInt(newReps) || 10,
      rest_seconds: parseInt(newRest) || 60,
      reasoning: 'Custom exercise added by user.',
    }
    onUpdate(day, { ...workout, exercises: [...(workout.exercises || []), ex] })
    setNewName(''); setNewSets('3'); setNewReps('10'); setNewRest('60')
    setShowAddExercise(false)
  }

  function handleChangeType(newType: WorkoutDay['type']) {
    if (!onUpdate) return
    if (newType === 'rest') {
      onUpdate(day, { type: 'rest', recovery_note: 'Active recovery day.' })
    } else {
      onUpdate(day, {
        type: 'workout',
        workout_name: workout.workout_name || 'Custom Workout',
        location: workout.location || 'gym',
        duration_mins: workout.duration_mins || 45,
        exercises: workout.exercises || [],
      })
    }
    setShowTypeMenu(false)
  }

  async function handleChangeLocation(loc: NonNullable<WorkoutDay['location']>) {
    if (!onUpdate || loc === workout.location) return
    setShowTypeMenu(false)

    if (loc === 'class') {
      setShowClassModal(true)
      return
    }

    if (loc === 'home') {
      setAdapting(true)
      try {
        const res = await fetch('/api/workouts/adapt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workout, newLocation: 'home' }),
        })
        const data = await res.json()
        if (data.workout) {
          onUpdate(day, data.workout)
        } else {
          onUpdate(day, { ...workout, location: 'home' })
        }
      } catch {
        onUpdate(day, { ...workout, location: 'home' })
      } finally {
        setAdapting(false)
      }
      return
    }

    // gym — just update location
    onUpdate(day, { ...workout, location: loc })
  }

  async function handleClassConfirm() {
    if (!onUpdate || !className.trim()) return
    setShowClassModal(false)
    setAdapting(true)
    try {
      const res = await fetch('/api/workouts/adapt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout,
          newLocation: 'class',
          classDetails: { name: className, type: classType, location: classLocation },
        }),
      })
      const data = await res.json()
      if (data.workout) {
        onUpdate(day, data.workout)
      } else {
        onUpdate(day, { ...workout, location: 'class', workout_name: `${className}${classType ? ' – ' + classType : ''}` })
      }
    } catch {
      onUpdate(day, { ...workout, location: 'class', workout_name: className || 'Fitness Class' })
    } finally {
      setAdapting(false)
      setClassName(''); setClassType(''); setClassLocation('')
    }
  }

  function handleRemoveExercise(exerciseId: string) {
    if (!onUpdate) return
    onUpdate(day, {
      ...workout,
      exercises: (workout.exercises || []).filter((ex) => ex.id !== exerciseId),
    })
  }

  if (workout.type === 'rest') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-5xl mb-3">🧘</div>
          <h3 className="font-bold text-text-primary text-lg mb-2">Rest Day</h3>
          {workout.recovery_note && (
            <p className="text-text-secondary text-sm leading-relaxed">{workout.recovery_note}</p>
          )}
        </div>
        {onUpdate && (
          <div className="px-5 pb-6 flex justify-center">
            <button
              onClick={() => handleChangeType('workout')}
              className="text-sm text-teal font-medium hover:underline flex items-center gap-1"
            >
              <RefreshCw size={13} /> Switch to workout day
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Workout header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-text-primary mb-3">
              {workout.workout_name}
            </h3>
            <div className="flex flex-wrap gap-3">
              {workout.location && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                  <Dumbbell size={16} className="text-green-600" />
                  <span className="font-medium text-text-primary text-sm">
                    {locationLabel[workout.location] ?? workout.location}
                  </span>
                </div>
              )}
              {workout.duration_mins && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                  <Clock size={16} className="text-lavender" />
                  <span className="font-medium text-text-primary text-sm">{workout.duration_mins} min</span>
                </div>
              )}
            </div>
          </div>

          {/* Edit menu */}
          {onUpdate && (
            <div className="relative self-start">
              <button
                onClick={() => setShowTypeMenu(!showTypeMenu)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-text-secondary hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Edit <ChevronDown size={14} />
              </button>
              {showTypeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 min-w-[180px]">
                    <button
                      onClick={() => handleChangeType('rest')}
                      className="block w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors rounded-t-xl text-text-primary"
                    >
                      🛌 Make rest day
                    </button>
                    <div className="border-t border-slate-200 px-4 py-3">
                      <p className="text-xs text-text-secondary font-semibold mb-2">Location</p>
                      <div className="flex flex-col gap-1">
                        {LOCATION_OPTIONS.map((loc) => (
                          <button
                            key={loc}
                            onClick={() => handleChangeLocation(loc)}
                            className={`text-sm px-2 py-1.5 rounded-lg transition-colors text-left ${
                              workout.location === loc
                                ? 'bg-emerald-50 text-emerald-700 font-medium'
                                : 'hover:bg-slate-50 text-text-secondary'
                            }`}
                          >
                            {locationEmoji[loc]} {locationLabel[loc]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Gender demo toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium mr-1">Demo:</span>
          <button
            onClick={() => handleGenderChange('male')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              gender === 'male'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            👤 Male
          </button>
          <button
            onClick={() => handleGenderChange('female')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              gender === 'female'
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            👩 Female
          </button>
        </div>

        {/* Exercise list or adapting loader */}
        {adapting ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Adapting workout…</p>
              <p className="text-xs text-slate-400 mt-1">Adjusting exercises for your setup</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {workout.exercises?.map((exercise, i) => (
              <ExerciseItem
                key={exercise.id}
                exercise={exercise}
                index={i}
                gender={gender}
                onRemove={onUpdate ? () => handleRemoveExercise(exercise.id) : undefined}
                onVideoLoaded={onUpdate ? (exerciseId, videoId, thumbnailUrl, videoGender) => {
                  onUpdate(day, {
                    ...workout,
                    exercises: (workout.exercises || []).map((ex) =>
                      ex.id === exerciseId
                        ? { ...ex, video_id: videoId, thumbnail_url: thumbnailUrl, video_gender: videoGender }
                        : ex
                    ),
                  })
                } : undefined}
              />
            ))}
          </div>
        )}

        {/* Add exercise */}
        {onUpdate && !adapting && (
          <div className="pt-2 border-t border-slate-200">
            {showAddExercise ? (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl space-y-3">
                <p className="text-sm font-medium text-text-primary">Add custom exercise</p>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExercise()}
                  autoFocus
                  placeholder="Exercise name (e.g. Hip Thrust)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
                <div className="flex gap-2">
                  {[
                    { label: 'Sets', val: newSets, set: setNewSets },
                    { label: 'Reps', val: newReps, set: setNewReps },
                    { label: 'Rest (s)', val: newRest, set: setNewRest },
                  ].map(({ label, val, set }) => (
                    <div key={label} className="flex-1">
                      <label className="text-xs text-text-secondary block mb-0.5">{label}</label>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        min={0}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddExercise}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-sm font-medium text-emerald-800 transition-colors"
                  >
                    <Check size={13} /> Add
                  </button>
                  <button
                    onClick={() => setShowAddExercise(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-100 text-sm text-text-secondary transition-colors"
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddExercise(true)}
                className="flex items-center gap-2 text-teal hover:text-accent-sage font-medium text-sm transition-colors mt-2"
              >
                <Plus size={16} /> Add exercise
              </button>
            )}
          </div>
        )}

        {/* Bottom actions — Complete + Swap only */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => onLog(day, logStatus === 'completed' ? null : 'completed')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 font-semibold text-sm transition-colors ${
              logStatus === 'completed'
                ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                : 'bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Check size={15} />
            {logStatus === 'completed' ? 'Completed!' : 'Complete Workout'}
          </button>
          <button
            onClick={() => onSwap(workout, day)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            <RefreshCw size={14} /> Swap workout
          </button>
        </div>
      </div>

      {/* Class Details Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Class Details</h2>
            <p className="text-sm text-slate-500 mb-5">Tell us about the class you're attending</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Class Name *</label>
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. CrossFit WOD, Morning Barre, Pilates Flow"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Class Type</label>
                <input
                  value={classType}
                  onChange={(e) => setClassType(e.target.value)}
                  placeholder="e.g. HIIT, Strength, Yoga, Spin, Kickboxing"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Studio / Location</label>
                <input
                  value={classLocation}
                  onChange={(e) => setClassLocation(e.target.value)}
                  placeholder="e.g. Orangetheory, Planet Fitness, local gym"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowClassModal(false); setClassName(''); setClassType(''); setClassLocation('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClassConfirm}
                disabled={!className.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
