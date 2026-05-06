'use client'

import { motion } from 'framer-motion'
import { PetType, PetState } from '@/types'

interface PetAnimationProps {
  petType: PetType
  petState: PetState
  size?: 'sm' | 'md' | 'lg'
  accessories?: string[]
}

const petEmojis: Record<PetType, string> = {
  cat: '🐱',
  dog: '🐶',
  dragon: '🐉',
  bunny: '🐰',
  fox: '🦊',
}

const stateAccessories: Record<PetState, string> = {
  thriving: '',
  happy: '',
  neutral: '',
  sad: '😢',
  sick: '🤒',
  critical: '💀',
}

const petAnimations: Record<PetState, {
  animate: Record<string, unknown>
  transition: Record<string, unknown>
}> = {
  thriving: {
    animate: { scale: [1, 1.1, 1], filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'] },
    transition: { duration: 1.5, repeat: Infinity },
  },
  happy: {
    animate: { rotate: [-5, 5, -5] },
    transition: { duration: 2, repeat: Infinity },
  },
  neutral: {
    animate: { y: [0, -4, 0] },
    transition: { duration: 3, repeat: Infinity },
  },
  sad: {
    animate: { x: [-3, 3, -3], opacity: [1, 0.8, 1] },
    transition: { duration: 4, repeat: Infinity },
  },
  sick: {
    animate: { x: [-6, 6, -6] },
    transition: { duration: 0.4, repeat: Infinity, repeatDelay: 2 },
  },
  critical: {
    animate: { opacity: [1, 0.5, 1] },
    transition: { duration: 2, repeat: Infinity },
  },
}

const sizes = {
  sm: 'text-4xl',
  md: 'text-7xl',
  lg: 'text-9xl',
}

export function PetAnimation({ petType, petState, size = 'md', accessories = [] }: PetAnimationProps) {
  const anim = petAnimations[petState]

  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.div
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animate={anim.animate as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transition={anim.transition as any}
        className={`${sizes[size]} select-none`}
        style={{ display: 'inline-block', lineHeight: 1 }}
      >
        {petEmojis[petType]}
      </motion.div>

      {/* State accessory overlay */}
      {stateAccessories[petState] && (
        <span className="absolute -bottom-1 -right-1 text-2xl">
          {stateAccessories[petState]}
        </span>
      )}

      {/* Streak accessories */}
      {accessories.includes('crown') && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">👑</span>
      )}
      {accessories.includes('sunglasses') && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-xl">🕶️</span>
      )}

      {/* Thriving glow effect */}
      {petState === 'thriving' && (
        <div className="absolute inset-0 -m-2 rounded-full bg-yellow-200/30 blur-lg animate-pulse" />
      )}
    </div>
  )
}
