'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { PetType } from '@/types'
import { Check, X, Loader2, RefreshCw } from 'lucide-react'

const pets: { type: PetType; emoji: string; name: string; description: string }[] = [
  { type: 'cat', emoji: '🐱', name: 'Cat', description: 'Elegant and independent, but deeply loyal' },
  { type: 'dog', emoji: '🐶', name: 'Dog', description: 'Enthusiastic and supportive every single day' },
  { type: 'dragon', emoji: '🐉', name: 'Dragon', description: 'Fierce, powerful, and legendary' },
  { type: 'bunny', emoji: '🐰', name: 'Bunny', description: 'Gentle, hopeful, and endlessly encouraging' },
  { type: 'fox', emoji: '🦊', name: 'Fox', description: 'Clever, quick, and full of surprises' },
]

const LOADING_MESSAGES = [
  'Reviewing your health profile...',
  'Analyzing your bloodwork markers...',
  'Crafting your personalized meal plan...',
  'Designing your workout routine...',
  'Building your morning habits...',
  'Preparing your health report...',
  'Consulting your specialist team...',
  'Finalizing your night routine...',
  'Almost ready — this is worth the wait!',
]

type TaskStatus = 'pending' | 'running' | 'done' | 'error'

interface Task {
  key: string
  label: string
  emoji: string
  endpoint: string
  status: TaskStatus
}

const TASK_DEFINITIONS: Omit<Task, 'status'>[] = [
  { key: 'report',  label: 'Health Report',    emoji: '🩺', endpoint: '/api/plans/report'  },
  { key: 'meal',    label: 'Meal Plan',         emoji: '🥗', endpoint: '/api/plans/meal'    },
  { key: 'workout', label: 'Workout Plan',      emoji: '💪', endpoint: '/api/plans/workout' },
  { key: 'morning', label: 'Morning Routine',   emoji: '🌅', endpoint: '/api/plans/routine' },
  { key: 'night',   label: 'Night Routine',     emoji: '🌙', endpoint: ''                   },
]

function makeTasks(): Task[] {
  return TASK_DEFINITIONS.map((t) => ({ ...t, status: 'pending' }))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callWithRetry(endpoint: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        if (attempt === 0) { await sleep(2000); continue }
        return false
      }
      const data = await res.json()
      if (data.success) return true
      if (attempt === 0) { await sleep(2000); continue }
      return false
    } catch {
      if (attempt === 0) { await sleep(2000); continue }
      return false
    }
  }
  return false
}

export function PetSelector() {
  const router = useRouter()
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null)
  const [petName, setPetName] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tasks, setTasks] = useState<Task[]>(makeTasks())
  const [msgIndex, setMsgIndex] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const [hasErrors, setHasErrors] = useState(false)
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (generating) {
      msgTimer.current = setInterval(() => {
        setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
      }, 3000)
    }
    return () => { if (msgTimer.current) clearInterval(msgTimer.current) }
  }, [generating])

  function setTaskStatus(key: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, status } : t)))
  }

  async function runGeneration(tasksToRun: Task[]) {
    const activeKeys = new Set(tasksToRun.map((t) => t.key))
    const apiCalls: { keys: string[]; endpoint: string }[] = []

    for (const task of tasksToRun) {
      if (task.key === 'morning') {
        apiCalls.push({ keys: ['morning', 'night'], endpoint: '/api/plans/routine' })
      } else if (task.key === 'night') {
        if (!activeKeys.has('morning')) {
          apiCalls.push({ keys: ['morning', 'night'], endpoint: '/api/plans/routine' })
        }
      } else {
        apiCalls.push({ keys: [task.key], endpoint: task.endpoint })
      }
    }

    setTasks((prev) => prev.map((t) =>
      activeKeys.has(t.key) ? { ...t, status: 'running' } : t
    ))

    await Promise.all(
      apiCalls.map(async ({ keys, endpoint }) => {
        const success = await callWithRetry(endpoint)
        const status: TaskStatus = success ? 'done' : 'error'
        setTasks((prev) => prev.map((t) => keys.includes(t.key) ? { ...t, status } : t))
      })
    )
  }

  async function handleMeetPet() {
    if (!selectedPet || !petName.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    await supabase.from('pet').upsert(
      { user_id: user.id, pet_type: selectedPet, pet_name: petName.trim(), accessories: [], current_streak: 0, longest_streak: 0 },
      { onConflict: 'user_id' }
    )

    await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id)

    if ('Notification' in window && 'serviceWorker' in navigator) {
      Notification.requestPermission().then(async (permission) => {
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
      }).catch(() => {})
    }

    setLoading(false)
    setGenerating(true)
    const initialTasks = makeTasks()
    setTasks(initialTasks)

    await runGeneration(initialTasks)

    setTasks((prev) => {
      const errors = prev.filter((t) => t.status === 'error')
      if (errors.length === 0) {
        setAllDone(true)
      } else {
        setHasErrors(true)
      }
      return prev
    })
  }

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => router.push('/onboarding/results'), 800)
      return () => clearTimeout(t)
    }
  }, [allDone, router])

  async function handleRetryFailed() {
    const failedTasks = tasks.filter((t) => t.status === 'error')
    if (failedTasks.length === 0) return
    setHasErrors(false)

    await runGeneration(failedTasks)

    setTasks((prev) => {
      const errors = prev.filter((t) => t.status === 'error')
      if (errors.length === 0) {
        setAllDone(true)
      } else {
        setHasErrors(true)
      }
      return prev
    })
  }

  const petEmoji = pets.find((p) => p.type === selectedPet)?.emoji ?? '🌿'
  const doneCount = tasks.filter((t) => t.status === 'done').length

  if (generating) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-center">
            <motion.div
              animate={
                allDone
                  ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] }
                  : hasErrors
                  ? { scale: [1, 0.95, 1] }
                  : { y: [0, -12, 0] }
              }
              transition={
                allDone
                  ? { duration: 0.6, repeat: 2 }
                  : hasErrors
                  ? { duration: 1.5, repeat: Infinity }
                  : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
              }
              className="text-8xl select-none"
            >
              {petEmoji}
            </motion.div>
          </div>

          <div className="text-center">
            <AnimatePresence mode="wait">
              {allDone ? (
                <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                  <h2 className="text-2xl font-bold text-text-primary">Your plan is ready! 🎉</h2>
                  <p className="text-text-secondary text-sm">Taking you to your results...</p>
                </motion.div>
              ) : hasErrors ? (
                <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
                  <h2 className="text-xl font-bold text-text-primary">Some items failed</h2>
                  <p className="text-text-secondary text-sm">
                    {tasks.filter((t) => t.status === 'error').length} item
                    {tasks.filter((t) => t.status === 'error').length > 1 ? 's' : ''} couldn't be generated.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={msgIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-1"
                >
                  <h2 className="text-xl font-bold text-text-primary">Building your plan...</h2>
                  <p className="text-text-secondary text-sm">{LOADING_MESSAGES[msgIndex]}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!hasErrors && (
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E8E6E3' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#A8D5BA' }}
                initial={{ width: '0%' }}
                animate={{ width: `${(doneCount / tasks.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          )}

          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.key}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  task.status === 'done'
                    ? 'bg-accent-sage/15 border border-accent-sage/25'
                    : task.status === 'error'
                    ? 'bg-red-50 border border-red-100'
                    : task.status === 'running'
                    ? 'bg-accent-primary/8 border border-accent-primary/15'
                    : 'bg-white border border-vitalia-border'
                }`}
                style={task.status === 'running' ? { backgroundColor: 'rgba(168,213,186,0.08)' } : undefined}
              >
                <span className="text-xl w-8 text-center flex-shrink-0">{task.emoji}</span>
                <span className={`flex-1 text-sm font-medium ${
                  task.status === 'done' ? 'text-accent-primary' :
                  task.status === 'error' ? 'text-red-600' :
                  'text-text-primary'
                }`}>
                  {task.label}
                </span>
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                  {task.status === 'done' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <Check size={16} className="text-accent-primary" />
                    </motion.div>
                  )}
                  {task.status === 'error' && <X size={16} className="text-red-500" />}
                  {task.status === 'running' && (
                    <Loader2 size={16} className="text-accent-primary animate-spin" />
                  )}
                  {task.status === 'pending' && (
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E8E6E3' }} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Button onClick={handleRetryFailed} className="w-full">
                <RefreshCw size={16} />
                Retry failed items
              </Button>
              <p className="text-center text-xs text-text-secondary mt-2">
                Successfully generated items are already saved — only failed items will be retried.
              </p>
            </motion.div>
          )}
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
              className={`p-6 rounded-card text-left transition-all border-2 ${
                selectedPet === pet.type
                  ? 'bg-accent-primary/10 border-accent-primary shadow-card'
                  : 'bg-white border-vitalia-border shadow-card hover:border-accent-primary/40'
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
            className="bg-white rounded-card shadow-card border border-accent-primary/15 p-6 space-y-4"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#A8D5BA' }}>
                What will you name your {pets.find((p) => p.type === selectedPet)?.emoji}?
              </label>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && petName.trim() && handleMeetPet()}
                placeholder="Enter a name..."
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-vitalia-border focus:outline-none focus:border-accent-primary text-sm transition-colors"
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
