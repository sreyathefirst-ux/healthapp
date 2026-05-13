import { ReactNode } from 'react'

type BadgeColor = 'primary' | 'coral' | 'sage' | 'yellow' | 'default'

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  className?: string
}

const colorStyles: Record<BadgeColor, string> = {
  primary: 'bg-accent-primary/15 text-accent-primary',
  coral: 'bg-accent-coral/20 text-vitalia-muted',
  sage: 'bg-accent-sage/20 text-accent-sage',
  yellow: 'bg-accent-yellow text-text-secondary',
  default: 'bg-gray-100 text-text-secondary',
}

export function Badge({ children, color = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${colorStyles[color]} ${className}`}
    >
      {children}
    </span>
  )
}
