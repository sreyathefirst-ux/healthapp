import { ReactNode } from 'react'

type BadgeColor = 'primary' | 'coral' | 'sage' | 'yellow' | 'default'

interface BadgeProps {
  children: ReactNode
  color?: BadgeColor
  className?: string
}

const colorStyles: Record<BadgeColor, string> = {
  primary: 'bg-accent-primary/20 text-accent-primary',
  coral: 'bg-accent-coral/20 text-orange-600',
  sage: 'bg-accent-sage/20 text-green-700',
  yellow: 'bg-accent-yellow/20 text-yellow-700',
  default: 'bg-gray-100 text-text-secondary',
}

export function Badge({ children, color = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-btn px-3 py-1 text-xs font-medium ${colorStyles[color]} ${className}`}
    >
      {children}
    </span>
  )
}
