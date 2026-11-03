/**
 * LiveStatusBadge.tsx
 *
 * Displays the current live sync status in the player overlay.
 *
 * States:
 *   FOLLOWING_LIVE + playing  → pulsing red "● LIVE"
 *   DELAYED + playing         → "▶ Xm Ys behind"
 *   Paused                    → "⏸ Paused · Xs behind"
 *
 * PRD reference: §11 (Live Player UI)
 */

import type { SyncMode } from '@/types/schedule.types'
import { formatBehindLive } from '@/utils/schedule.utils'
import { formatDuration } from '@/utils/time.utils'

interface LiveStatusBadgeProps {
  syncMode: SyncMode
  behindLiveSeconds: number
  isPlaying: boolean
  isBreak?: boolean
  breakRemainingSeconds?: number
  onClick?: () => void
  className?: string
}

export default function LiveStatusBadge({
  syncMode,
  behindLiveSeconds,
  isPlaying,
  isBreak = false,
  breakRemainingSeconds = 0,
  onClick,
  className = '',
}: LiveStatusBadgeProps) {
  if (isBreak) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-[#F59E0B] text-slate-950 px-2.5 py-0.5 rounded-full shadow-[0_2px_8px_rgba(245,158,11,0.45)] select-none font-black text-[11px] tracking-wider uppercase shrink-0 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950" />
        </span>
        <span>BREAK {breakRemainingSeconds > 0 ? formatDuration(breakRemainingSeconds) : ''}</span>
      </div>
    )
  }

  if (syncMode === 'FOLLOWING_LIVE' && isPlaying) {
    // Real-Life Authentic Solid Red LIVE Badge (Facebook / YouTube Live style)
    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-[#EF4444] text-white px-2.5 py-0.5 rounded-full shadow-[0_2px_8px_rgba(239,68,68,0.45)] select-none font-extrabold text-[11px] tracking-wider uppercase shrink-0 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <span>LIVE</span>
      </div>
    )
  }

  if (syncMode === 'DELAYED' && isPlaying) {
    return (
      <button
        onClick={onClick}
        type="button"
        className={`inline-flex items-center gap-1.5 bg-[#1E293B]/90 hover:bg-[#EF4444] text-[#E2E8F0] hover:text-white px-2.5 py-0.5 rounded-full transition-all duration-200 border border-white/10 select-none font-semibold text-[11px] tracking-wider cursor-pointer shadow-sm group shrink-0 ${className}`}
        title="লাইভ পজিশনে ফিরে যান"
      >
        <span className="h-2 w-2 rounded-full bg-[#94A3B8] group-hover:bg-white transition-colors" />
        <span>{formatBehindLive(behindLiveSeconds)}</span>
        <span className="text-[10px] text-[#94A3B8] group-hover:text-white font-bold">· LIVE</span>
      </button>
    )
  }

  // Paused state
  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 text-[#94A3B8] px-2.5 py-0.5 rounded-full select-none font-medium text-[11px] shrink-0 ${className}`}
    >
      <span className="text-[9px]">⏸</span>
      <span>{behindLiveSeconds > 2 ? `${formatBehindLive(behindLiveSeconds)}` : 'PAUSED'}</span>
    </div>
  )
}

