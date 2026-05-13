'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Meal } from '@/types'
import { X, ChevronRight } from 'lucide-react'

interface SwapModalProps {
  meal: Meal
  mealType: string
  day: string
  onClose: () => void
  onConfirm: (newMeal: Meal) => void
}

type Phase = 'loading' | 'pick' | 'feedback' | 'skip'

export function SwapModal({ meal, mealType, day, onClose, onConfirm }: SwapModalProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [alternatives, setAlternatives] = useState<Meal[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [round, setRound] = useState(0)
  const [error, setError] = useState(false)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  useEffect(() => {
    fetchAlternatives()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAlternatives(feedback?: string) {
    setPhase('loading')
    setSelected(null)
    setError(false)
    setErrorDetail(null)
    try {
      const res = await fetch('/api/meals/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal, mealType, day, feedback }),
      })
      const data = await res.json()
      if (data.alternatives?.length) {
        setAlternatives(data.alternatives)
        setPhase('pick')
      } else {
        console.error('[SwapModal] API error:', data.error, '| details:', data.details, '| raw:', data.rawResponse?.slice(0, 200))
        setError(true)
        setErrorDetail(data.error || 'Unknown error')
        setPhase('pick')
      }
    } catch (e) {
      console.error('[SwapModal] fetch threw:', e)
      setError(true)
      setErrorDetail((e as Error).message)
      setPhase('pick')
    }
  }

  function handleNoneWork() {
    if (round >= 1) {
      setPhase('skip')
    } else {
      setFeedbackText('')
      setPhase('feedback')
    }
  }

  async function handleFeedbackSubmit() {
    if (!feedbackText.trim()) return
    const nextRound = round + 1
    setRound(nextRound)
    await fetchAlternatives(feedbackText.trim())
  }

  async function handleConfirm() {
    const newMeal = alternatives.find((m) => m.id === selected)
    if (!newMeal) return
    setConfirming(true)
    onConfirm(newMeal)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-t-3xl sm:rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-5 border-b border-vitalia-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-text-primary capitalize">Swap {mealType}</h2>
            {round > 0 && phase === 'pick' && (
              <p className="text-xs text-text-secondary mt-0.5">Refined suggestions based on your feedback</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-bg flex items-center justify-center hover:bg-accent-primary/10 transition-colors">
            <X size={16} className="text-vitalia-muted" />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {phase === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-5 skeleton-shimmer rounded w-2/3" />
                    <div className="h-3 skeleton-shimmer rounded" />
                    <div className="h-3 skeleton-shimmer rounded w-4/5" />
                  </div>
                ))}
                <p className="text-center text-text-secondary text-sm pt-2">
                  {round === 0 ? 'Finding alternatives…' : 'Refining based on your feedback…'}
                </p>
              </motion.div>
            )}

            {phase === 'pick' && (
              <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                {error ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-text-secondary text-sm">Couldn't load alternatives.</p>
                    {errorDetail && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 text-left font-mono">{errorDetail}</p>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => fetchAlternatives()}>Retry</Button>
                  </div>
                ) : (
                  <>
                    {alternatives.map((alt) => (
                      <button
                        key={alt.id}
                        onClick={() => setSelected(alt.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selected === alt.id
                            ? 'border-accent-primary bg-accent-primary/5'
                            : 'border-vitalia-border hover:border-accent-primary/40'
                        }`}
                      >
                        <h3 className="font-semibold text-text-primary">{alt.name}</h3>
                        <p className="text-text-secondary text-sm mt-1 mb-2 line-clamp-2">{alt.description}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge color="coral">🔥 {alt.calories} cal</Badge>
                          <Badge color="primary">P: {alt.protein_g}g</Badge>
                          <Badge color="sage">C: {alt.carbs_g}g</Badge>
                          <Badge color="yellow">F: {alt.fat_g}g</Badge>
                        </div>
                      </button>
                    ))}

                    <button
                      onClick={handleNoneWork}
                      className="w-full text-center text-sm text-vitalia-muted hover:text-accent-primary py-2 transition-colors flex items-center justify-center gap-1"
                    >
                      None of these work for me
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {phase === 'feedback' && (
              <motion.div key="feedback" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">What didn't work?</h3>
                  <p className="text-sm text-text-secondary">Tell us what you're looking for and we'll find better options.</p>
                </div>
                <textarea
                  autoFocus
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g. Something quicker, no dairy, more filling, I don't like fish…"
                  rows={3}
                  className="w-full border-[1.5px] border-vitalia-border rounded-xl p-3 text-sm text-text-primary placeholder:text-vitalia-dim focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/10 resize-none transition-all"
                />
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setPhase('pick')} className="flex-1">Back</Button>
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedbackText.trim()}
                    className="flex-1"
                  >
                    Find alternatives
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === 'skip' && (
              <motion.div key="skip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4 text-center py-4">
                <span className="text-5xl block">🤷</span>
                <div>
                  <h3 className="font-semibold text-text-primary mb-1">Nothing's clicking?</h3>
                  <p className="text-sm text-text-secondary">That's okay — you can keep the original or just skip this meal.</p>
                </div>
                <div className="space-y-2">
                  <Button variant="secondary" onClick={() => { setRound(0); fetchAlternatives() }} className="w-full">
                    Try again with different ideas
                  </Button>
                  <Button variant="ghost" onClick={onClose} className="w-full text-vitalia-muted">
                    Keep original meal
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer actions — only when picking */}
        {phase === 'pick' && !error && (
          <div className="p-5 border-t border-vitalia-border flex gap-3 sticky bottom-0 bg-white">
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
  )
}
