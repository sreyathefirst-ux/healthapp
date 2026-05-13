import { ReactNode } from 'react'

type BadgeColor = 'primary' | 'coral' | 'sage' | 'yellow' | 'default'

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  className?: string
}

const colorStyles: Record<BadgeColor, string> = {
  primary: 'bg-teal/12 text-teal',         // teal tint — success/active
  coral: 'bg-lavender/12 text-lavender',   // lavender tint — AI/info
  sage: 'bg-accent-sage/15 text-accent-sage', // gradient-start green
  yellow: 'bg-bg-3 text-text-secondary',   // neutral
  default: 'bg-bg-3 text-text-secondary',  // neutral grey
}

export function Badge({ children, color = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold ${colorStyles[color]} ${className}`}
    >
      {children}
    </span>
  )
}
