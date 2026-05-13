import { ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary: 'btn-vitalia text-white font-bold rounded-btn uppercase tracking-wide',
  secondary: 'border-[1.5px] border-accent-primary bg-transparent text-accent-primary font-medium rounded-btn hover:bg-accent-primary/10 transition-all duration-300',
  ghost: 'bg-transparent text-text-secondary font-medium hover:bg-black/5 rounded-xl transition-all duration-300',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-7 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 ${variantStyles[variant]} ${sizeStyles[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
