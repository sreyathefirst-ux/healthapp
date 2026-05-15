'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UtensilsCrossed, Dumbbell, Sun, Moon, CheckCircle2, BarChart2, ChevronRight } from 'lucide-react'

function getRoutineMode(): 'morning' | 'night' {
  const h = new Date().getHours()
  return (h >= 19 || h < 3) ? 'night' : 'morning'
}

const STATIC_LINKS = [
  {
    href: '/meal-plan',
    label: 'Meal Plan',
    subtitle: 'View this week',
    icon: UtensilsCrossed,
    accent: 'from-green-100 to-green-50',
    iconColor: 'text-green-600',
  },
  {
    href: '/workout-plan',
    label: 'Workout',
    subtitle: 'Check schedule',
    icon: Dumbbell,
    accent: 'from-purple-100 to-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    href: '/insights',
    label: 'Insights',
    subtitle: 'View insights',
    icon: BarChart2,
    accent: 'from-teal-100 to-teal-50',
    iconColor: 'text-teal-600',
  },
]

const MORNING_LINK = {
  href: '/routine/morning',
  label: 'Morning Routine',
  subtitle: 'Complete checklist',
  icon: Sun,
  accent: 'from-amber-100 to-amber-50',
  iconColor: 'text-amber-600',
}

const NIGHT_LINK = {
  href: '/routine/night',
  label: 'Night Routine',
  subtitle: 'Complete checklist',
  icon: Moon,
  accent: 'from-blue-900/10 to-indigo-50',
  iconColor: 'text-blue-800',
}

export function QuickLinks() {
  const [routineMode, setRoutineMode] = useState<'morning' | 'night'>(getRoutineMode)

  useEffect(() => {
    function scheduleNextCheck() {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const s = now.getSeconds()

      let msUntilNext: number
      if (h < 3) {
        msUntilNext = ((3 - h) * 60 - m) * 60000 - s * 1000
      } else if (h < 19) {
        msUntilNext = ((19 - h) * 60 - m) * 60000 - s * 1000
      } else {
        msUntilNext = ((27 - h) * 60 - m) * 60000 - s * 1000
      }

      return setTimeout(() => {
        setRoutineMode(getRoutineMode())
        scheduleNextCheck()
      }, msUntilNext + 1000)
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') setRoutineMode(getRoutineMode())
    }

    const timer = scheduleNextCheck()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const routineLink = routineMode === 'morning' ? MORNING_LINK : NIGHT_LINK
  // Insert routine link at position 2 (after Meal Plan and Workout, before Health Report)
  const links = [STATIC_LINKS[0], STATIC_LINKS[1], routineLink, STATIC_LINKS[2]]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {links.map(({ href, label, subtitle, icon: Icon, accent, iconColor }) => (
        <Link key={href} href={href}>
          <div
            className={`bg-gradient-to-br ${accent} rounded-xl p-5 shadow-card border border-vitalia-border hover:shadow-card-hover transition-all duration-200 cursor-pointer group h-full`}
          >
            <div className="mb-4">
              <div className="p-2.5 rounded-lg bg-white/60 group-hover:bg-white transition-colors inline-flex">
                <Icon size={22} className={iconColor} />
              </div>
            </div>
            <h4 className="font-bold text-text-primary mb-1 text-sm">{label}</h4>
            <p className="text-xs text-text-secondary">{subtitle}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
              Go to routine
              <ChevronRight size={14} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
