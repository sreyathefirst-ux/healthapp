'use client'

import { useState } from 'react'
import { X, ChevronLeft, UtensilsCrossed, ShoppingBag } from 'lucide-react'
import { Meal } from '@/types'

interface ReplaceMealModalProps {
  mealType: string
  onClose: () => void
  onConfirm: (meal: Meal) => void
}

type Step = 'choose' | 'recipe' | 'takeout'

export function ReplaceMealModal({ mealType, onClose, onConfirm }: ReplaceMealModalProps) {
  const [step, setStep] = useState<Step>('choose')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recipe fields
  const [recipeName, setRecipeName] = useState('')
  const [notes, setNotes] = useState('')

  // Takeout fields
  const [restaurant, setRestaurant] = useState('')
  const [mealName, setMealName] = useState('')

  async function handleRecipeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipeName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meals/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'recipe',
          mealType,
          recipeName: recipeName.trim(),
          notes: notes.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.meal) {
        throw new Error(data.error || 'Failed to generate meal')
      }
      onConfirm(data.meal)
    } catch (err) {
      setError((err as Error).message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleTakeoutSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant.trim() || !mealName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meals/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'takeout',
          mealType,
          restaurant: restaurant.trim(),
          mealName: mealName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.meal) {
        throw new Error(data.error || 'Failed to generate meal')
      }
      onConfirm(data.meal)
    } catch (err) {
      setError((err as Error).message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          {step !== 'choose' ? (
            <button
              onClick={() => { setStep('choose'); setError(null) }}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <h2 className="text-base font-bold text-slate-800">
            {step === 'choose' ? 'Replace Meal' : step === 'recipe' ? 'Log Your Recipe' : 'Log Takeout'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Step: choose */}
          {step === 'choose' && (
            <div>
              <p className="text-sm text-slate-500 mb-6 text-center">How would you like to replace this meal?</p>
              <div className="space-y-3">
                <button
                  onClick={() => setStep('recipe')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">New Recipe</p>
                    <p className="text-sm text-slate-500">Log a recipe you made at home</p>
                  </div>
                </button>
                <button
                  onClick={() => setStep('takeout')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Takeout</p>
                    <p className="text-sm text-slate-500">Log a restaurant or delivery order</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step: recipe */}
          {step === 'recipe' && (
            <form onSubmit={handleRecipeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Recipe Name *
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g. Chicken Caesar Salad"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ingredients, changes you made..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !recipeName.trim()}
                className="btn-vitalia w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {loading ? 'Generating...' : 'Generate Meal Card'}
              </button>
            </form>
          )}

          {/* Step: takeout */}
          {step === 'takeout' && (
            <form onSubmit={handleTakeoutSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Restaurant *
                </label>
                <input
                  type="text"
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                  placeholder="e.g. Chick-fil-A"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  What did you order? *
                </label>
                <input
                  type="text"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  placeholder="e.g. Grilled Chicken Sandwich"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !restaurant.trim() || !mealName.trim()}
                className="btn-vitalia w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {loading ? 'Generating...' : 'Generate Meal Card'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
