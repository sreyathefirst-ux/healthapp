'use client'

import { useState } from 'react'
import { ExerciseItem } from './ExerciseItem'
import { WorkoutDay, WorkoutLogStatus, Exercise } from '@/types'
import { RefreshCw, Plus, Check, X, ChevronDown, Dumbbell, Clock } from 'lucide-react'

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

  function handleChangeLocation(loc: NonNullable<WorkoutDay['location']>) {
    if (!onUpdate) return
    onUpdate(day, { ...workout, location: loc })
    setShowTypeMenu(false)
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
      <div className="bg-white rounded-2xl shadow-sm border border-vitalia-border overflow-hidden">
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
              className="flex items-center gap-1.5 px-4 py-2 border border-vitalia-border rounded-lg text-text-secondary hover:bg-bg-2 transition-colors text-sm font-medium"
            >
              Edit <ChevronDown size={14} />
            </button>
            {showTypeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-card-lg border border-vitalia-border z-20 min-w-[180px]">
                  <button
                    onClick={() => handleChangeType('rest')}
                    className="block w-full text-left px-4 py-2.5 text-sm hover:bg-bg-2 transition-colors rounded-t-xl text-text-primary"
                  >
                    🛌 Make rest day
                  </button>
                  <div className="border-t border-vitalia-border px-4 py-3">
                    <p className="text-xs text-text-secondary font-semibold mb-2">Location</p>
                    <div className="flex flex-col gap-1">
                      {LOCATION_OPTIONS.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => handleChangeLocation(loc)}
                          className={`text-sm px-2 py-1.5 rounded-lg transition-colors text-left ${
                            workout.location === loc
                              ? 'bg-teal/15 text-text-primary font-medium'
                              : 'hover:bg-bg-2 text-text-secondary'
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

      {/* Exercise cards */}
      <div className="space-y-4">
        {workout.exercises?.map((exercise, i) => (
          <ExerciseItem
            key={exercise.id}
            exercise={exercise}
            index={i}
            onRemove={onUpdate ? () => handleRemoveExercise(exercise.id) : undefined}
            onGifLoaded={onUpdate ? (exerciseId, gifUrl) => {
              onUpdate(day, {
                ...workout,
                exercises: (workout.exercises || []).map((ex) =>
                  ex.id === exerciseId ? { ...ex, gif_url: gifUrl } : ex
                ),
              })
            } : undefined}
          />
        ))}
      </div>

      {/* Add exercise */}
      {onUpdate && (
        <div className="pt-2 border-t border-vitalia-border">
          {showAddExercise ? (
            <div className="p-4 bg-teal/5 border border-teal/20 rounded-xl space-y-3">
              <p className="text-sm font-medium text-text-primary">Add custom exercise</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExercise()}
                autoFocus
                placeholder="Exercise name (e.g. Hip Thrust)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-teal"
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
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-teal"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddExercise}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal/20 hover:bg-teal/30 text-sm font-medium text-text-primary transition-colors"
                >
                  <Check size={13} /> Add
                </button>
                <button
                  onClick={() => setShowAddExercise(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-bg-2 text-sm text-text-secondary transition-colors"
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

      {/* Bottom actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={() => onLog(day, logStatus === 'completed' ? null : 'completed')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 font-medium text-sm transition-colors ${
            logStatus === 'completed'
              ? 'bg-green-100 border-green-500 text-green-700'
              : 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100'
          }`}
        >
          ✓ {logStatus === 'completed' ? 'Completed!' : 'Complete'}
        </button>
        <button
          onClick={() => onLog(day, logStatus === 'modified' ? null : 'modified')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
            logStatus === 'modified'
              ? 'bg-orange-100 border-orange-400 text-orange-700'
              : 'bg-bg-2 border-vitalia-border text-text-secondary hover:bg-bg-3'
          }`}
        >
          ⚡ Modified
        </button>
        <button
          onClick={() => onSwap(workout, day)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-vitalia-border bg-bg-2 text-text-secondary hover:bg-bg-3 font-medium text-sm transition-colors"
        >
          <RefreshCw size={14} /> Swap workout
        </button>
      </div>
    </div>
  )
}
