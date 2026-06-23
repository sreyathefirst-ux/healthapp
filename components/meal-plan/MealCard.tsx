'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Meal, MealLogStatus } from '@/types'
import { RefreshCw, Check, X, Flame, Coffee, Salad, Utensils, Apple, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MealCardProps {
  meal: Meal
  mealType: string
  day: string
  logStatus?: MealLogStatus
  onSwap: (meal: Meal, mealType: string, day: string) => void
  onLog: (mealType: string, day: string, status: MealLogStatus) => void
  onViewRecipe: (meal: Meal, mealType: string) => void
}

export function MealCard({ meal, mealType, day, logStatus, onSwap, onLog, onViewRecipe }: MealCardProps) {
  const [imageError, setImageError] = useState(false)

  // Reset error state whenever image_url changes (e.g. after background generation completes)
  useEffect(() => {
    setImageError(false)
    if (meal.image_url) {
      console.log('[MealCard]', meal.name, '— image_url:', meal.image_url.slice(0, 80))
    }
  }, [meal.image_url, meal.name])

  const logButtons: { status: MealLogStatus; Icon: LucideIcon; activeColor: string }[] = [
    { status: 'eaten', Icon: Check, activeColor: '#07C281' },
    { status: 'swapped', Icon: RefreshCw, activeColor: '#2BAEE6' },
    { status: 'skipped', Icon: X, activeColor: '#FF4D8D' },
  ]

  const mealTypeIcon: Record<string, LucideIcon> = { breakfast: Coffee, lunch: Salad, dinner: Utensils }
  const PlaceholderIcon = mealTypeIcon[mealType] || Apple

  return (
    <div className="bg-white rounded-card shadow-card border border-accent-primary/15 overflow-hidden">
      {/* Meal image */}
      <div className="h-40 bg-gradient-to-br from-accent-primary/10 to-accent-coral/15 relative">
        {meal.image_url && !imageError ? (
          <Image
            src={meal.image_url}
            alt={meal.name}
            fill
            className="object-cover"
            onError={() => {
              console.error('[MealCard] image failed to load for:', meal.name, '| src:', meal.image_url?.slice(0, 80))
              setImageError(true)
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <PlaceholderIcon size={44} className="text-green/60" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge color="primary" className="capitalize">{mealType}</Badge>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={() => onViewRecipe(meal, mealType)}
          className="text-left w-full group"
        >
          <h3 className="font-bold text-text-primary text-base mb-1 group-hover:text-accent-primary transition-colors">{meal.name}</h3>
          <p className="text-text-secondary text-sm mb-1 line-clamp-2">{meal.description}</p>
          <p className="text-xs text-green-deep font-medium mb-2 inline-flex items-center gap-1">View recipe <ArrowRight size={11} /></p>
        </button>

        {/* Reasoning */}
        <details className="mb-3">
          <summary className="text-xs text-accent-primary cursor-pointer font-medium">Why this meal?</summary>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">{meal.reasoning}</p>
        </details>

        {/* Macros */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge color="coral"><span className="inline-flex items-center gap-1"><Flame size={11} /> {meal.calories} cal</span></Badge>
          <Badge color="primary">P: {meal.protein_g}g</Badge>
          <Badge color="sage">C: {meal.carbs_g}g</Badge>
          <Badge color="yellow">F: {meal.fat_g}g</Badge>
          <Badge>Fiber: {meal.fiber_g}g</Badge>
        </div>

        {/* Log status + swap */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {logButtons.map(({ status, Icon, activeColor }) => (
              <button
                key={status}
                onClick={() => onLog(mealType, day, (logStatus === status ? null : status) as MealLogStatus)}
                className="w-9 h-9 rounded-xl transition-all flex items-center justify-center hover:bg-bg"
                style={logStatus === status ? { background: activeColor + '22', boxShadow: `inset 0 0 0 2px ${activeColor}` } : undefined}
                title={status || ''}
              >
                <Icon size={16} style={{ color: logStatus === status ? activeColor : '#969C95' }} />
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSwap(meal, mealType, day)}
            className="text-vitalia-muted"
          >
            <RefreshCw size={14} />
            Swap
          </Button>
        </div>
      </div>
    </div>
  )
}
