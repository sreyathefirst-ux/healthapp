'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PetAnimation } from '@/components/pet/PetAnimation'
import { usePetState } from '@/hooks/usePetState'
import { PetState } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

const stateBadgeStyle: Record<PetState, { bg: string; text: string }> = {
  thriving: { bg: 'rgba(93,218,184,0.15)', text: '#2aa87a' },
  happy:    { bg: 'rgba(93,218,184,0.15)', text: '#2aa87a' },
  neutral:  { bg: 'rgba(235,235,240,0.8)', text: '#5D5D6D' },
  sad:      { bg: 'rgba(180,143,232,0.15)', text: '#7c52c8' },
  sick:     { bg: 'rgba(180,143,232,0.15)', text: '#7c52c8' },
  critical: { bg: 'rgba(232,93,117,0.15)', text: '#c42b4a' },
}

const stateLabels: Record<PetState, string> = {
  thriving: '✨ Thriving',
  happy:    '😊 Happy',
  neutral:  '😐 Neutral',
  sad:      '😢 Feeling Sad',
  sick:     '🤒 Sick',
  critical: '💔 Critical',
}

export function PetWidget() {
  const { pet, petState, avgCompletion, loading } = usePetState()
  const [speechBubble, setSpeechBubble] = useState<string | null>(null)
  const [fetchingMessage, setFetchingMessage] = useState(false)

  async function handlePetClick() {
    if (!pet || fetchingMessage) return
    setFetchingMessage(true)
    try {
      const res = await fetch('/api/pet/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petName: pet.pet_name,
          petType: pet.pet_type,
          petState,
          completionPercent: avgCompletion,
          currentStreak: pet.current_streak,
        }),
      })
      const data = await res.json()
      setSpeechBubble(data.message)
      setTimeout(() => setSpeechBubble(null), 5000)
    } catch {
      setSpeechBubble('Meow! 🐾')
      setTimeout(() => setSpeechBubble(null), 3000)
    } finally {
      setFetchingMessage(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!pet) return null

  const accessories: string[] = []
  if (pet.current_streak >= 7) accessories.push('crown')
  if (pet.current_streak >= 30) accessories.push('sunglasses')

  const badge = stateBadgeStyle[petState]

  return (
    <div className="bg-white rounded-2xl p-7 shadow-card border border-vitalia-border relative overflow-hidden">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative cursor-pointer flex-shrink-0" onClick={handlePetClick}>
              <PetAnimation
                petType={pet.pet_type}
                petState={petState}
                size="md"
                accessories={accessories}
              />
              {fetchingMessage && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                  <div className="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">{pet.pet_name}</h3>
              <span
                className="inline-block mt-1 px-3 py-1 text-xs font-semibold rounded-full"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {stateLabels[petState]}
              </span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">
            {pet.current_streak > 0
              ? `🔥 ${pet.current_streak}-day streak! Keep it up!`
              : 'Complete your routines to start a streak!'}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm text-text-secondary font-medium mb-1">7-day average completion</p>
          <p
            className="text-4xl font-bold"
            style={{
              background: 'linear-gradient(to right, #10b981, #9333ea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {avgCompletion}%
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProgressBar value={avgCompletion} />
      </div>

      <AnimatePresence>
        {speechBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute top-4 left-28 right-4 bg-white rounded-2xl shadow-card border border-accent-primary/20 p-3 text-sm z-10"
          >
            <div className="absolute left-[-8px] top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white border-b-8 border-b-transparent" />
            {speechBubble}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
