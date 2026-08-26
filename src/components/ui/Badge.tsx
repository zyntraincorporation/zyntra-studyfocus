type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#17202A] text-[#94A3B8] border border-[#1E2A36]',
  brand: 'bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20',
  success: 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20',
  warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
  danger: 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
  info: 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20',
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
