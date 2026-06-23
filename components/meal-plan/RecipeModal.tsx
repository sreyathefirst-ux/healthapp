'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Meal } from '@/types'
import { X, Clock, Users, ChefHat, Coffee, Salad, Utensils, Apple, Flame } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface RecipeData {
  prep_time_mins: number
  cook_time_mins: number
  servings: number
  ingredients_with_quantities: string[]
  instructions: string[]
}

interface RecipeModalProps {
  meal: Meal
  mealType: string
  onClose: () => void
}

export function RecipeModal({ meal, mealType, onClose }: RecipeModalProps) {
  const [recipe, setRecipe] = useState<RecipeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    fetch('/api/meals/recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealName: meal.name,
        ingredients: meal.ingredients,
        description: meal.description,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.recipe) {
          setRecipe(data.recipe)
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [meal.name, meal.ingredients, meal.description])

  const mealIconMap: Record<string, LucideIcon> = { breakfast: Coffee, lunch: Salad, dinner: Utensils }
  const MealIcon = mealIconMap[mealType] || Apple

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-t-3xl sm:rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] w-full sm:max-w-xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header image */}
        <div className="relative h-48 bg-gradient-to-br from-accent-primary/15 to-accent-coral/20 flex-shrink-0">
          {meal.image_url && !imageError ? (
            <Image
              src={meal.image_url}
              alt={meal.name}
              fill
              className="object-cover rounded-t-3xl sm:rounded-t-[24px]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full"><MealIcon size={56} className="text-green/60" /></div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
          >
            <X size={16} className="text-text-primary" />
          </button>
          <div className="absolute bottom-3 left-3">
            <span className="bg-white/90 text-text-primary text-xs font-semibold px-3 py-1 rounded-full capitalize inline-flex items-center gap-1.5">
              <MealIcon size={13} /> {mealType}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Title + description */}
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">{meal.name}</h2>
            <p className="text-text-secondary text-sm leading-relaxed">{meal.description}</p>
          </div>

          {/* Macros */}
          <div className="flex flex-wrap gap-2">
            <Badge color="coral"><span className="inline-flex items-center gap-1"><Flame size={11} /> {meal.calories} cal</span></Badge>
            <Badge color="primary">Protein {meal.protein_g}g</Badge>
            <Badge color="sage">Carbs {meal.carbs_g}g</Badge>
            <Badge color="yellow">Fat {meal.fat_g}g</Badge>
            <Badge>Fiber {meal.fiber_g}g</Badge>
          </div>

          {/* Why this meal */}
          <div className="bg-accent-primary/8 rounded-xl p-4" style={{ backgroundColor: 'rgba(93,218,184,0.08)' }}>
            <p className="text-xs font-semibold text-accent-primary uppercase tracking-wide mb-1">Why this meal</p>
            <p className="text-sm text-text-secondary leading-relaxed">{meal.reasoning}</p>
          </div>

          {/* Recipe section */}
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 skeleton-shimmer rounded w-1/3" />
              <div className="h-3 skeleton-shimmer rounded" />
              <div className="h-3 skeleton-shimmer rounded w-4/5" />
              <div className="h-3 skeleton-shimmer rounded w-3/5" />
              <p className="text-center text-xs text-text-secondary pt-2">Generating recipe...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-text-secondary text-sm">
              <p>Couldn't load full recipe. Here are the ingredients:</p>
              <ul className="mt-2 text-left space-y-1">
                {meal.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-accent-primary mt-0.5">•</span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : recipe ? (
            <>
              {/* Time + servings row */}
              <div className="flex gap-3">
                <div className="flex-1 bg-bg rounded-xl p-3 flex items-center gap-2">
                  <Clock size={16} className="text-accent-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Prep</p>
                    <p className="text-sm font-semibold text-text-primary">{recipe.prep_time_mins} min</p>
                  </div>
                </div>
                <div className="flex-1 bg-bg rounded-xl p-3 flex items-center gap-2">
                  <ChefHat size={16} className="text-accent-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Cook</p>
                    <p className="text-sm font-semibold text-text-primary">{recipe.cook_time_mins} min</p>
                  </div>
                </div>
                <div className="flex-1 bg-bg rounded-xl p-3 flex items-center gap-2">
                  <Users size={16} className="text-accent-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Serves</p>
                    <p className="text-sm font-semibold text-text-primary">{recipe.servings}</p>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <h3 className="font-semibold text-text-primary mb-3">Ingredients</h3>
                <ul className="space-y-1.5">
                  {(recipe.ingredients_with_quantities.length > 0
                    ? recipe.ingredients_with_quantities
                    : meal.ingredients
                  ).map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-4 h-4 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-accent-primary font-bold text-xs">{i + 1}</span>
                      <span className="text-text-secondary">{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instructions */}
              <div>
                <h3 className="font-semibold text-text-primary mb-3">Instructions</h3>
                <ol className="space-y-3">
                  {recipe.instructions.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-accent-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-text-secondary leading-relaxed">{step.replace(/^Step \d+:\s*/i, '')}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
