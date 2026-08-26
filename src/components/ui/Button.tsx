import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[#6366F1] text-white hover:bg-[#5254CC] active:bg-[#4547B8] disabled:opacity-50',
  secondary:
    'bg-[#17202A] text-[#F8FAFC] border border-[#1E2A36] hover:bg-[#1E2A36] active:bg-[#243240] disabled:opacity-50',
  ghost:
    'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#17202A] active:bg-[#1E2A36] disabled:opacity-50',
  danger:
    'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C] disabled:opacity-50',
  success:
    'bg-[#22C55E] text-white hover:bg-[#16A34A] active:bg-[#15803D] disabled:opacity-50',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-6 text-base rounded-lg gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F14]',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(' ')}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  )
}
