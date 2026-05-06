'use client'

interface ProgressBarProps {
  value: number
  color?: string
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, color = '#C9B8FF', className = '', showLabel }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full ${className}`}>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
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
