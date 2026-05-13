interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = '', lines }: SkeletonProps) {
  if (lines) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton-shimmer rounded-lg h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`skeleton-shimmer rounded-xl ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card border border-accent-primary/15 p-5 space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton lines={3} />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  )
}
