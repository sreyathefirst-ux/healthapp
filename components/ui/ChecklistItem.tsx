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
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-bg cursor-pointer transition-colors group"
      style={{ backgroundColor: checked ? 'rgba(201,184,255,0.08)' : undefined }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(id, e.target.checked)}
        className="w-5 h-5 rounded-md border-2 border-accent-primary accent-accent-primary cursor-pointer flex-shrink-0"
      />
      <span className={`flex-1 text-sm font-medium transition-all ${checked ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
        {label}
      </span>
      {timeTarget && (
        <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
          {timeTarget}
        </span>
      )}
    </label>
  )
}
