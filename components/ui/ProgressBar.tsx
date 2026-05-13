'use client'

interface ProgressBarProps {
  value: number
  color?: string
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, color = '#A8D5BA', className = '', showLabel }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full ${className}`}>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E8E6E3' }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedValue}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-text-secondary mt-1 block text-right">{clampedValue}%</span>
      )}
    </div>
  )
}
