import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-card shadow-card border border-accent-primary/15 p-5 transition-shadow hover:shadow-card-hover ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {children}
    </div>
  )
}
