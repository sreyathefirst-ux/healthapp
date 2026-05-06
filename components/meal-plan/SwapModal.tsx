'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Meal } from '@/types'
import { X } from 'lucide-react'

interface SwapModalProps {
  meal: Meal
  mealType: string
  day: string
  onClose: () => void
  onConfirm: (newMeal: Meal) => void
}

export function SwapModal({ meal, mealType, day, onClose, onConfirm }: SwapModalProps) {
  const [loading, setLoading] = useState(true)
  const [alternatives, setAlternatives] = useState<Meal[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useState(() => {
    fetch('/api/meals/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal, mealType, day }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAlternatives(data.alternatives || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  })

  async function handleConfirm() {
    const newMeal = alternatives.find((m) => m.id === selected)
    if (!newMeal) return
    setConfirming(true)
    onConfirm(newMeal)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-card shadow-card w-full max-w-lg max-h-[80vh] overflow-y-auto"
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-text-primary">Swap {mealType}</h2>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <X size={20} />
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-gray-200 rounded-xl" />
                  </div>
                ))}
                <p className="text-center text-text-secondary text-sm">Finding alternatives...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => setSelected(alt.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selected === alt.id
                        ? 'border-accent-primary bg-accent-primary/5'
                        : 'border-gray-100 hover:border-accent-primary/40'
                    }`}
                  >
                    <h3 className="font-semibold text-text-primary">{alt.name}</h3>
                    <p className="text-text-secondary text-sm mt-1 mb-2">{alt.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge color="coral">🔥 {alt.calories} cal</Badge>
                      <Badge color="primary">P: {alt.protein_g}g</Badge>
                      <Badge color="sage">C: {alt.carbs_g}g</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!loading && (
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
              <Button
                onClick={handleConfirm}
                disabled={!selected}
                loading={confirming}
                className="flex-1"
              >
                Swap Meal
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
