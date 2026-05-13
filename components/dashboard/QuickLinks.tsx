import Link from 'next/link'
import { UtensilsCrossed, Dumbbell, Clock, CheckCircle2, ChevronRight } from 'lucide-react'

const quickLinks = [
  {
    href: '/meal-plan',
    label: 'Meal Plan',
    subtitle: 'View this week',
    icon: UtensilsCrossed,
    accent: 'from-green-100 to-green-50',
  },
  {
    href: '/workout-plan',
    label: 'Workout',
    subtitle: 'Check schedule',
    icon: Dumbbell,
    accent: 'from-purple-100 to-purple-50',
  },
  {
    href: '/routine/morning',
    label: 'Morning Routine',
    subtitle: 'Complete checklist',
    icon: Clock,
    accent: 'from-orange-100 to-orange-50',
  },
  {
    href: '/health-report',
    label: 'Health Report',
    subtitle: 'View insights',
    icon: CheckCircle2,
    accent: 'from-blue-100 to-blue-50',
  },
]

export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {quickLinks.map(({ href, label, subtitle, icon: Icon, accent }) => (
        <Link key={href} href={href}>
          <div
            className={`bg-gradient-to-br ${accent} rounded-xl p-5 shadow-card border border-vitalia-border hover:shadow-card-hover transition-all duration-200 cursor-pointer group h-full`}
          >
            <div className="mb-4">
              <div className="p-2.5 rounded-lg bg-white/60 group-hover:bg-white transition-colors inline-flex">
                <Icon size={22} className="text-text-body" />
              </div>
            </div>
            <h4 className="font-bold text-text-primary mb-1 text-sm">{label}</h4>
            <p className="text-xs text-text-secondary">{subtitle}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
              Learn more
              <ChevronRight size={14} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
