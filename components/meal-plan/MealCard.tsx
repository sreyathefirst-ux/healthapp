'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { Meal, MealLogStatus } from '@/types'

interface MealCardProps {
  meal: Meal
  mealType: string
  day: string
  logStatus?: MealLogStatus
  onSwap: (meal: Meal, mealType: string, day: string) => void
  onReplace: (meal: Meal, mealType: string, day: string) => void
  onLog: (mealType: string, day: string, status: MealLogStatus) => void
  onViewRecipe: (meal: Meal, mealType: string) => void
}

const mealEmoji: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
}

function MacroRing({
  value, max, color, label, unit, size = 88,
}: {
  value: number; max: number; color: string; label: string; unit: string; size?: number
}) {
  const r = size * 0.39
  const sw = size * 0.09
  const cx = size / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(value / max, 1) * circ

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EBEBF0" strokeWidth={sw} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${cx} ${cx})`} />
        <text x={cx} y={cx - 1} textAnchor="middle" dominantBaseline="auto"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: size * 0.21, fill: '#1A1A2E' }}>
          {value}
        </text>
        <text x={cx} y={cx + size * 0.17} textAnchor="middle" dominantBaseline="auto"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: size * 0.135, fill: '#9B9BAA' }}>
          {unit}
        </text>
      </svg>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#6B6B8A', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}

export function MealCard({ meal, mealType, day, logStatus, onSwap, onReplace, onLog, onViewRecipe }: MealCardProps) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
    if (meal.image_url) {
      console.log('[MealCard]', meal.name, '— image_url:', meal.image_url.slice(0, 80))
    }
  }, [meal.image_url, meal.name])

  const timeLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1)

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-card-hover transition-shadow">
      {/* Image */}
      <div className="relative h-56 sm:h-64 w-full bg-gradient-to-br from-teal/10 to-lavender/15">
        {meal.image_url && !imageError ? (
          <Image
            src={meal.image_url}
            alt={meal.name}
            fill
            className="object-cover"
            onError={() => {
              console.error('[MealCard] image failed:', meal.name, '|', meal.image_url?.slice(0, 80))
              setImageError(true)
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">
            {mealEmoji[mealType] ?? '🍴'}
          </div>
        )}
        <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm text-green-700 font-semibold text-sm rounded-full shadow-sm">
          {timeLabel}
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        <button onClick={() => onViewRecipe(meal, mealType)} className="text-left w-full group mb-2">
          <h3 className="text-xl font-bold text-text-primary group-hover:text-teal transition-colors leading-snug">
            {meal.name}
          </h3>
        </button>
        <p className="text-text-secondary text-sm mb-4 line-clamp-2">{meal.description}</p>

        {/* Links */}
        <div className="flex gap-4 mb-5 text-sm">
          <details>
            <summary className="text-teal hover:text-accent-sage font-medium cursor-pointer transition-colors list-none">
              ▸ Why this meal?
            </summary>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">{meal.reasoning}</p>
          </details>
        </div>

        {/* Nutrition rings */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
          <MacroRing value={meal.calories} max={700} color="#10b981" label="Cal" unit="kcal" size={72} />
          <MacroRing value={meal.protein_g} max={40} color="#60a5fa" label="Protein" unit="g" size={72} />
          <MacroRing value={meal.carbs_g} max={80} color="#f97316" label="Carbs" unit="g" size={72} />
          <MacroRing value={meal.fat_g} max={30} color="#a855f7" label="Fat" unit="g" size={72} />
        </div>

        {/* Log + Replace/Swap */}
        <div>
          {/* Log Meal button */}
          <button
            onClick={() => onLog(mealType, day, logStatus === 'eaten' ? null : 'eaten')}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all border-2 ${
              logStatus === 'eaten'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
          >
            {logStatus === 'eaten' ? '✓ Logged' : 'Log Meal'}
          </button>
          {/* Replace + Swap row */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onReplace(meal, mealType, day)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <RotateCcw size={14} />
              Replace
            </button>
            <button
              onClick={() => onSwap(meal, mealType, day)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <RefreshCw size={14} />
              Swap
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
