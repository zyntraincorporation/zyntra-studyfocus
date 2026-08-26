interface ProgressBarProps {
  value: number          // current value
  max?: number           // default 100
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: string
  showLabel?: boolean
  className?: string
}

const sizeMap = { xs: 'h-0.5', sm: 'h-1', md: 'h-1.5', lg: 'h-2' }

export default function ProgressBar({
  value,
  max = 100,
  size = 'sm',
  color = '#6366F1',
  showLabel,
  className = '',
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-1 bg-[#17202A] rounded-full overflow-hidden ${sizeMap[size]}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-[#94A3B8] w-9 text-right shrink-0">{Math.round(pct)}%</span>
      )}
    </div>
  )
}
