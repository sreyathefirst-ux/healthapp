'use client'

interface ChecklistItemProps {
  id: string
  label: string
  checked: boolean
  timeTarget?: string
  onChange: (id: string, checked: boolean) => void
}

export function ChecklistItem({ id, label, checked, timeTarget, onChange }: ChecklistItemProps) {
  return (
    <label
      className="flex items-center gap-3 p-3 rounded-card cursor-pointer transition-colors group"
      style={{ backgroundColor: checked ? 'rgba(93,218,184,0.06)' : undefined }}
    >
      <div className="relative w-5 h-5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(id, e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
            checked ? 'border-transparent' : 'border-vitalia-border bg-white'
          }`}
          style={checked ? { background: 'linear-gradient(135deg, #6FD8A0, #5DDAB8)' } : undefined}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
      <span className={`flex-1 text-sm font-medium transition-all ${checked ? 'line-through text-vitalia-muted' : 'text-text-primary'}`}>
        {label}
      </span>
      {timeTarget && (
        <span className="text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-pill font-semibold">
          {timeTarget}
        </span>
      )}
    </label>
  )
}
