'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ExerciseItem } from './ExerciseItem'
import { WorkoutDay, WorkoutLogStatus, Exercise } from '@/types'
import { RefreshCw, Plus, Check, X, ChevronDown, Dumbbell, Home, Users, Leaf, BedDouble, Clock, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface WorkoutDayCardProps {
  workout: WorkoutDay
  day: string
  logStatus?: WorkoutLogStatus
  onSwap: (workout: WorkoutDay, day: string) => void
  onLog: (day: string, status: WorkoutLogStatus) => void
  onUpdate?: (day: string, updated: WorkoutDay) => void
}

const locationIcon: Record<string, LucideIcon> = { gym: Dumbbell, home: Home, class: Users }
function LocationIcon({ loc, size = 13 }: { loc: string; size?: number }) {
  const Ic = locationIcon[loc] || Dumbbell
  return <Ic size={size} className="inline -mt-0.5" />
}
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

  const logButtons: { status: WorkoutLogStatus; Icon: LucideIcon; title: string; activeColor: string }[] = [
    { status: 'completed', Icon: Check, title: 'Completed', activeColor: '#07C281' },
    { status: 'modified', Icon: Zap, title: 'Modified', activeColor: '#FF9A2E' },
    { status: 'skipped', Icon: X, title: 'Skipped', activeColor: '#FF4D8D' },
  ]

  if (workout.type === 'rest') {
    return (
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="p-6 text-center">
          <Leaf size={40} className="mx-auto mb-3 text-green" />
          <h3 className="font-bold text-text-primary text-lg mb-2">Rest Day</h3>
          {workout.recovery_note && (
            <p className="text-text-secondary text-sm leading-relaxed">{workout.recovery_note}</p>
          )}
        </div>
        {onUpdate && (
          <div className="px-5 pb-5 flex justify-center">
            <button
              onClick={() => handleChangeType('workout')}
              className="text-sm text-accent-primary font-medium hover:underline flex items-center gap-1"
            >
              <RefreshCw size={13} /> Switch to workout day
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="p-5 border-b border-vitalia-border">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-text-primary text-lg">{workout.workout_name}</h3>
          {onUpdate && (
            <div className="relative">
              <button
                onClick={() => setShowTypeMenu(!showTypeMenu)}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded-lg hover:bg-bg transition-colors"
              >
                Edit <ChevronDown size={12} />
              </button>
              {showTypeMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-card border border-vitalia-border z-20 min-w-[160px]">
                    <button
                      onClick={() => handleChangeType('rest')}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg transition-colors rounded-t-xl text-text-primary flex items-center gap-2"
                    >
                      <BedDouble size={14} /> Make rest day
                    </button>
                    <div className="border-t border-vitalia-border px-3 py-2">
                      <p className="text-xs text-text-secondary font-medium mb-1.5">Location</p>
                      <div className="flex flex-col gap-1">
                        {LOCATION_OPTIONS.map((loc) => (
                          <button
                            key={loc}
                            onClick={() => handleChangeLocation(loc)}
                            className={`text-xs px-2 py-1.5 rounded-lg transition-colors text-left flex items-center gap-1.5 ${workout.location === loc ? 'bg-accent-primary/20 text-text-primary font-medium' : 'hover:bg-bg text-text-secondary'}`}
                          >
                            <LocationIcon loc={loc} /> {loc.charAt(0).toUpperCase() + loc.slice(1)}
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
        <div className="flex gap-2 flex-wrap">
          {workout.location && (
            <Badge color="primary"><span className="inline-flex items-center gap-1 capitalize"><LocationIcon loc={workout.location} size={12} /> {workout.location}</span></Badge>
          )}
          {workout.duration_mins && (
            <Badge color="sage"><span className="inline-flex items-center gap-1"><Clock size={12} /> {workout.duration_mins} min</span></Badge>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {workout.exercises?.map((exercise) => (
          <ExerciseItem key={exercise.id} exercise={exercise} />
        ))}

        {onUpdate && (
          showAddExercise ? (
            <div className="p-3 bg-accent-primary/5 border border-accent-primary/20 rounded-xl space-y-2">
              <p className="text-xs font-medium text-text-primary">Add custom exercise</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExercise()}
                autoFocus
                placeholder="Exercise name (e.g. Hip Thrust)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary"
              />
              <div className="flex gap-2">
                {[
                  { label: 'Sets', val: newSets, set: setNewSets },
                  { label: 'Reps', val: newReps, set: setNewReps },
                  { label: 'Rest (s)', val: newRest, set: setNewRest },
                ].map(({ label, val, set }) => (
                  <div key={label} className="flex-1">
                    <label className="text-xs text-text-secondary block mb-0.5">{label}</label>
                    <input type="number" value={val} onChange={(e) => set(e.target.value)} min={0}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-vitalia-border focus:outline-none focus:border-accent-primary" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddExercise} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 text-sm font-medium text-text-primary transition-colors">
                  <Check size={13} /> Add
                </button>
                <button onClick={() => setShowAddExercise(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-bg text-sm text-text-secondary transition-colors">
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddExercise(true)}
              className="flex items-center gap-1.5 text-sm text-accent-primary font-medium hover:underline"
            >
              <Plus size={14} /> Add exercise
            </button>
          )
        )}
      </div>

      <div className="p-5 border-t border-vitalia-border flex items-center justify-between">
        <div className="flex gap-1">
          {logButtons.map(({ status, Icon, title, activeColor }) => (
            <button
              key={status}
              onClick={() => onLog(day, logStatus === status ? null : status)}
              className="w-10 h-10 rounded-xl transition-all flex items-center justify-center hover:bg-bg"
              style={logStatus === status ? { background: activeColor + '22', boxShadow: `inset 0 0 0 2px ${activeColor}` } : undefined}
              title={title}
            >
              <Icon size={18} style={{ color: logStatus === status ? activeColor : '#969C95' }} />
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSwap(workout, day)}>
          <RefreshCw size={14} />
          Swap workout
        </Button>
      </div>
    </div>
  )
}
