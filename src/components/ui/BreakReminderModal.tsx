import { Coffee, Clock } from 'lucide-react'
import Button from '@/components/ui/Button'

interface BreakReminderModalProps {
  isVisible: boolean
  studiedMinutes: number
  onStartBreak(): void
  onSnooze(): void
  onDismiss(): void
}

/**
 * BreakReminderModal — rendered inside the fullscreen container so it
 * appears correctly in both normal and fullscreen modes.
 *
 * Usage: render this as a child of the player's containerRef element,
 * positioned with `absolute inset-0 z-[100]`.
 */
export default function BreakReminderModal({
  isVisible,
  studiedMinutes,
  onStartBreak,
  onSnooze,
  onDismiss,
}: BreakReminderModalProps) {
  if (!isVisible) return null

  return (
    <div
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Break reminder"
    >
      <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm space-y-5 animate-fade-in">
        {/* Icon + Title */}
        <div className="text-center space-y-2">
          <div className="text-4xl">☕</div>
          <h2 className="text-lg font-bold text-[#F8FAFC]">Time for a Break!</h2>
          <p className="text-sm text-[#94A3B8]">
            You've been studying for{' '}
            <span className="text-[#818CF8] font-semibold">{studiedMinutes} minute{studiedMinutes !== 1 ? 's' : ''}</span>.
            <br />
            Take a short break and rest your eyes.
          </p>
        </div>

        {/* Timer indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#475569]">
          <Clock size={12} />
          <span>{studiedMinutes} min of active study time</span>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={onStartBreak}
          >
            <Coffee size={16} />
            Start Break
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={onSnooze}
          >
            Snooze 5 min
          </Button>
          <button
            onClick={onDismiss}
            className="w-full py-2 text-sm text-[#64748B] hover:text-[#94A3B8] transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
