'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Meal, MealLogStatus } from '@/types'
import { RefreshCw } from 'lucide-react'

interface MealCardProps {
  meal: Meal
  mealType: string
  day: string
  logStatus?: MealLogStatus
  onSwap: (meal: Meal, mealType: string, day: string) => void
  onLog: (mealType: string, day: string, status: MealLogStatus) => void
}

export function MealCard({ meal, mealType, day, logStatus, onSwap, onLog }: MealCardProps) {
  const [imageError, setImageError] = useState(false)

  const logButtons: { status: MealLogStatus; label: string }[] = [
    { status: 'eaten', label: '✅' },
    { status: 'swapped', label: '🔄' },
    { status: 'skipped', label: '❌' },
  ]

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      {/* Meal image */}
      <div className="h-40 bg-gradient-to-br from-accent-primary/10 to-accent-sage/20 relative">
        {meal.image_url && !imageError ? (
          <Image
            src={meal.image_url}
            alt={meal.name}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">
            {mealType === 'breakfast' ? '🍳' :
             mealType === 'lunch' ? '🥗' :
             mealType === 'dinner' ? '🍽️' : '🍎'}
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge color="primary" className="capitalize">{mealType}</Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-text-primary text-base mb-1">{meal.name}</h3>
        <p className="text-text-secondary text-sm mb-3 line-clamp-2">{meal.description}</p>

        {/* Reasoning */}
        <details className="mb-3">
          <summary className="text-xs text-accent-primary cursor-pointer font-medium">Why this meal?</summary>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">{meal.reasoning}</p>
        </details>

        {/* Macros */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge color="coral">🔥 {meal.calories} cal</Badge>
          <Badge color="primary">P: {meal.protein_g}g</Badge>
          <Badge color="sage">C: {meal.carbs_g}g</Badge>
          <Badge color="yellow">F: {meal.fat_g}g</Badge>
          <Badge>Fiber: {meal.fiber_g}g</Badge>
        </div>

        {/* Log status + swap */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {logButtons.map(({ status, label }) => (
              <button
                key={status}
                onClick={() => onLog(mealType, day, (logStatus === status ? null : status) as MealLogStatus)}
                className={`w-9 h-9 rounded-xl text-lg transition-all ${
                  logStatus === status
                    ? 'bg-accent-primary/20 ring-2 ring-accent-primary'
                    : 'hover:bg-gray-100'
                }`}
                title={status || ''}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSwap(meal, mealType, day)}
            className="text-text-secondary"
          >
            <RefreshCw size={14} />
            Swap
          </Button>
        </div>
      </div>
    </div>
  )
}
