'use client'

interface ProgressBarProps {
  value: number
  color?: string
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, color, className = '', showLabel }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))
  const isGradient = !color

  return (
    <div className={`w-full ${className}`}>
      <div className="w-full h-2 rounded-pill overflow-hidden" style={{ backgroundColor: '#EBEBF0' }}>
        <div
          className="h-full rounded-pill transition-all duration-500 ease-out"
          style={isGradient
            ? { width: `${clampedValue}%`, background: 'linear-gradient(90deg, #10b981, #34d399, #9333ea)' }
            : { width: `${clampedValue}%`, backgroundColor: color }
          }
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-secondary mt-1 block text-right">{clampedValue}%</span>
      )}
    </div>
  )
}
