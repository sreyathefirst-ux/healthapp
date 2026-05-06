'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { PetType } from '@/types'

const pets: { type: PetType; emoji: string; name: string; description: string }[] = [
  { type: 'cat', emoji: '🐱', name: 'Cat', description: 'Elegant and independent, but deeply loyal' },
  { type: 'dog', emoji: '🐶', name: 'Dog', description: 'Enthusiastic and supportive every single day' },
  { type: 'dragon', emoji: '🐉', name: 'Dragon', description: 'Fierce, powerful, and legendary' },
  { type: 'bunny', emoji: '🐰', name: 'Bunny', description: 'Gentle, hopeful, and endlessly encouraging' },
  { type: 'fox', emoji: '🦊', name: 'Fox', description: 'Clever, quick, and full of surprises' },
]

export function PetSelector() {
  const router = useRouter()
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null)
  const [petName, setPetName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingPlans, setGeneratingPlans] = useState(false)

  async function handleMeetPet() {
    if (!selectedPet || !petName.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save pet
    await supabase.from('pet').upsert({
      user_id: user.id,
      pet_type: selectedPet,
      pet_name: petName.trim(),
      accessories: [],
      current_streak: 0,
      longest_streak: 0,
    })

    // Mark onboarding complete
    await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id)

    // Request push notification permission
    if ('Notification' in window && 'serviceWorker' in navigator) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          })
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription }),
          })
        } catch {}
      }
    }

    setLoading(false)
    setGeneratingPlans(true)

    // Generate all plans in parallel
    await Promise.all([
      fetch('/api/plans/meal', { method: 'POST' }),
      fetch('/api/plans/workout', { method: 'POST' }),
      fetch('/api/plans/report', { method: 'POST' }),
    ])

    router.push('/')
  }

  if (generatingPlans) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-4">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-8xl"
        >
          {pets.find((p) => p.type === selectedPet)?.emoji}
        </motion.div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-2">Building your plan...</h2>
          <p className="text-text-secondary">{petName} is helping Vitalia craft your personalized health journey</p>
        </div>
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-primary animate-bounce" />
          <div className="w-3 h-3 rounded-full bg-accent-coral animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-3 h-3 rounded-full bg-accent-sage animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text-primary mb-3">Choose your companion</h1>
          <p className="text-text-secondary">Your pet&apos;s health mirrors your routine completion. Keep them thriving!</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {pets.map((pet) => (
            <motion.button
              key={pet.type}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPet(pet.type)}
              className={`p-6 rounded-card text-left transition-all ${
                selectedPet === pet.type
                  ? 'bg-accent-primary/20 border-2 border-accent-primary shadow-card'
                  : 'bg-white border-2 border-transparent shadow-card hover:border-accent-primary/40'
              }`}
            >
              <div className="text-5xl mb-3">{pet.emoji}</div>
              <h3 className="font-bold text-text-primary text-lg">{pet.name}</h3>
              <p className="text-text-secondary text-sm mt-1">{pet.description}</p>
            </motion.button>
          ))}
        </div>

        {selectedPet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-card shadow-card p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                What will you name your {pets.find((p) => p.type === selectedPet)?.emoji}?
              </label>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Enter a name..."
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-accent-primary text-sm"
              />
            </div>
            <Button
              onClick={handleMeetPet}
              disabled={!petName.trim()}
              loading={loading}
              className="w-full"
            >
              Meet {petName || 'your pet'}! 🎉
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
