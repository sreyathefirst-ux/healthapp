import Link from 'next/link'
import { Card } from '@/components/ui/Card'

const quickLinks = [
  { href: '/meal-plan', emoji: '🍽️', label: 'Meal Plan', status: 'View this week' },
  { href: '/workout-plan', emoji: '💪', label: 'Workout', status: 'Check schedule' },
  { href: '/routine/morning', emoji: '☀️', label: 'Morning Routine', status: 'Complete checklist' },
  { href: '/health-report', emoji: '📋', label: 'Health Report', status: 'View insights' },
]

export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {quickLinks.map(({ href, emoji, label, status }) => (
        <Link key={href} href={href}>
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <span className="text-3xl block mb-2">{emoji}</span>
            <h3 className="font-semibold text-text-primary text-sm">{label}</h3>
            <p className="text-text-secondary text-xs mt-1">{status}</p>
          </Card>
        </Link>
      ))}
    </div>
  )
}
