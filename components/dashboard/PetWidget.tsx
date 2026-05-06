'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PetAnimation } from '@/components/pet/PetAnimation'
import { usePetState } from '@/hooks/usePetState'
import { PetState } from '@/types'
import { Skeleton } from '@/components/ui/Skeleton'

const stateColors: Record<PetState, string> = {
  thriving: '#B8E4C9',
  happy: '#C9B8FF',
  neutral: '#FFE4A0',
  sad: '#FFB5A0',
  sick: '#FFB5A0',
  critical: '#FF6B6B',
}

const stateLabels: Record<PetState, string> = {
  thriving: '✨ Thriving',
  happy: '😊 Happy',
  neutral: '😐 Neutral',
  sad: '😢 Feeling Sad',
  sick: '🤒 Sick',
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
      <Card>
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </Card>
    )
  }

  if (!pet) return null

  const accessories: string[] = []
  if (pet.current_streak >= 7) accessories.push('crown')
  if (pet.current_streak >= 30) accessories.push('sunglasses')

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer" onClick={handlePetClick}>
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg text-text-primary">{pet.pet_name}</h3>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: stateColors[petState] + '40', color: stateColors[petState].replace(/40$/, '') }}
            >
              {stateLabels[petState]}
            </span>
          </div>
          <p className="text-text-secondary text-sm mb-3">
            {pet.current_streak > 0
              ? `🔥 ${pet.current_streak}-day streak! Keep it up!`
              : 'Complete your routines to start a streak!'}
          </p>
          <ProgressBar
            value={avgCompletion}
            color={stateColors[petState]}
            showLabel
          />
          <p className="text-xs text-text-secondary mt-1">7-day average completion</p>
        </div>
      </div>

      {/* Speech bubble */}
      <AnimatePresence>
        {speechBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute top-4 left-28 right-4 bg-white rounded-2xl shadow-card p-3 border border-accent-primary/20 text-sm z-10"
          >
            <div className="absolute left-[-8px] top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white border-b-8 border-b-transparent" />
            {speechBubble}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
