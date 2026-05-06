'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ExerciseItem } from './ExerciseItem'
import { WorkoutDay, WorkoutLogStatus } from '@/types'
import { RefreshCw } from 'lucide-react'

interface WorkoutDayCardProps {
  workout: WorkoutDay
  day: string
  logStatus?: WorkoutLogStatus
  onSwap: (workout: WorkoutDay, day: string) => void
  onLog: (day: string, status: WorkoutLogStatus) => void
}

const locationEmoji: Record<string, string> = {
  gym: '🏋️',
  home: '🏠',
  class: '🧘',
}

export function WorkoutDayCard({ workout, day, logStatus, onSwap, onLog }: WorkoutDayCardProps) {
  if (workout.type === 'rest') {
    return (
      <div className="bg-white rounded-card shadow-card p-6 text-center">
        <div className="text-5xl mb-3">🧘</div>
        <h3 className="font-bold text-text-primary text-lg mb-2">Rest Day</h3>
        {workout.recovery_note && (
          <p className="text-text-secondary text-sm leading-relaxed">{workout.recovery_note}</p>
        )}
      </div>
    )
  }

  const logButtons: { status: WorkoutLogStatus; label: string; title: string }[] = [
    { status: 'completed', label: '✅', title: 'Completed' },
    { status: 'modified', label: '⚡', title: 'Modified' },
    { status: 'skipped', label: '❌', title: 'Skipped' },
  ]

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-text-primary text-lg">{workout.workout_name}</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          {workout.location && (
            <Badge color="primary">
              {locationEmoji[workout.location]} {workout.location}
            </Badge>
          )}
          {workout.duration_mins && (
            <Badge color="sage">⏱️ {workout.duration_mins} min</Badge>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {workout.exercises?.map((exercise) => (
          <ExerciseItem key={exercise.id} exercise={exercise} />
        ))}
      </div>

      <div className="p-5 border-t border-gray-100 flex items-center justify-between">
        <div className="flex gap-1">
          {logButtons.map(({ status, label, title }) => (
            <button
              key={status}
              onClick={() => onLog(day, logStatus === status ? null : status)}
              className={`w-10 h-10 rounded-xl text-lg transition-all ${
                logStatus === status
                  ? 'bg-accent-primary/20 ring-2 ring-accent-primary'
                  : 'hover:bg-gray-100'
              }`}
              title={title}
            >
              {label}
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
