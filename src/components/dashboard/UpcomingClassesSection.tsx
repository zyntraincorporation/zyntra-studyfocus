/**
 * UpcomingClassesSection.tsx
 *
 * Dashboard widget showing the next 3 upcoming/live scheduled classes.
 * PRD Section 8: "Dashboard — Premium Upcoming Classes Experience"
 *
 * Features:
 * - Shows up to 3 next classes (live class always gets top priority)
 * - Live class card has a pulsing LIVE badge and direct "Join Now" action
 * - Upcoming cards show countdown timer that updates every second
 * - Ended cards show "Review" action linking to the recorded player
 * - Empty state when no classes are scheduled
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays, Radio, Clock, Play, ChevronRight, Plus, Lock,
  Sparkles, BookOpen,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUpcomingSchedules } from '@/services/schedule.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import type { ScheduledClass } from '@/types/schedule.types'
import {
  deriveScheduleStatus,
  formatScheduleDate,
  formatScheduleTime,
  formatScheduleTimeRange,
  formatCountdown,
  buildScheduleDisplayInfo,
} from '@/utils/schedule.utils'
import { buildRoute, ROUTES } from '@/constants/routes'

// ── Individual Class Card ──────────────────────────────────────────────

function UpcomingClassCard({
  schedule,
  reliableNowMs,
}: {
  schedule: ScheduledClass
  reliableNowMs: number
}) {
  const info = buildScheduleDisplayInfo(schedule, reliableNowMs)
  const { status } = info

  const isLive = status === 'live'
  const isEnded = status === 'ended'
  const isUpcoming = status === 'upcoming'

  return (
    <div
      className={`relative flex items-center gap-2.5 sm:gap-3 rounded-xl p-2 sm:p-2.5 border transition-all duration-200 overflow-hidden ${
        isLive
          ? 'bg-[#0C1A0F] border-[#22C55E]/40 hover:border-[#22C55E]/70'
          : isEnded
          ? 'bg-[#111820] border-[#1E2A36] opacity-70'
          : 'bg-[#111820] border-[#1E2A36] hover:border-[#6366F1]/30'
      }`}
    >
      {/* Live pulse background */}
      {isLive && (
        <div className="absolute inset-0 bg-[#22C55E]/3 pointer-events-none rounded-xl" />
      )}

      {/* Thumbnail: Crisp, fixed 16:9 */}
      <div className="relative shrink-0 w-16 h-11 sm:w-24 sm:h-16 rounded-lg overflow-hidden bg-[#17202A] shadow-sm">
        <img
          src={schedule.thumbnailUrl}
          alt={schedule.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Status overlay */}
        {isLive && (
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-[#16A34A] px-1 py-0.2 rounded shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            <span className="text-[8px] font-bold text-white tracking-wide">LIVE</span>
          </div>
        )}
        {isEnded && (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            <span className="text-[8px] font-bold text-[#94A3B8] uppercase tracking-widest">ENDED</span>
          </div>
        )}
        {isUpcoming && (
          <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/70 px-1 py-0.2 rounded">
            <Lock size={8} className="text-[#94A3B8]" />
            <span className="text-[8px] text-[#94A3B8] font-medium">LOCKED</span>
          </div>
        )}
      </div>

      {/* Info: strictly non-breaking, 2 clean lines */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p className="text-xs sm:text-sm font-semibold text-[#F8FAFC] truncate leading-tight">
          {schedule.title}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#94A3B8] truncate whitespace-nowrap">
          <span className="truncate font-medium text-[#CBD5E1]">
            {schedule.subjectName}
          </span>
          <span className="text-[#334155] shrink-0">·</span>
          <span className="shrink-0 text-[#818CF8] font-mono flex items-center gap-1">
            <Clock size={11} className="hidden sm:inline text-[#818CF8]" />
            {formatScheduleTimeRange(schedule.startAt, schedule.endAt)}
          </span>
          {schedule.playbackSpeed && schedule.playbackSpeed !== 1 && (
            <>
              <span className="text-[#334155] shrink-0">·</span>
              <span className="shrink-0 text-[9px] font-bold font-mono px-1 py-0.2 rounded bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30">
                ⚡{schedule.playbackSpeed}x
              </span>
            </>
          )}
        </div>

        {/* Status / Countdown indicator */}
        {isLive && (
          <p className="text-[10px] sm:text-xs font-semibold text-[#4ADE80] truncate">
            🔴 লাইভ চলছে — এখনই যুক্ত হন
          </p>
        )}
        {isUpcoming && info.countdownMs > 0 && (
          <p className="text-[10px] sm:text-xs text-[#94A3B8] truncate">
            <span className="text-[#818CF8] font-mono font-semibold">
              {formatCountdown(info.countdownMs)}
            </span>
            {' '}পরে শুরু হবে
          </p>
        )}
        {isEnded && (
          <p className="text-[10px] sm:text-xs text-[#64748B]">ক্লাস শেষ হয়েছে</p>
        )}
      </div>

      {/* Action button */}
      <div className="shrink-0 flex items-center">
        {isLive && (
          <Link
            to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })}
            className="flex items-center gap-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] sm:text-xs font-semibold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors shadow-sm"
          >
            <Radio size={12} className="animate-pulse" />
            <span>Join Live</span>
          </Link>
        )}
        {isUpcoming && (
          <Link
            to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })}
            className="flex items-center gap-1 bg-[#1E2A36] hover:bg-[#243447] text-[#94A3B8] hover:text-[#F8FAFC] text-[11px] sm:text-xs font-medium px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-[#2A3B4D]"
          >
            <Clock size={11} />
            <span className="hidden sm:inline">Waiting Room</span>
            <span className="sm:hidden">Wait</span>
          </Link>
        )}
        {isEnded && (
          <Link
            to={buildRoute(ROUTES.WATCH, { lectureId: schedule.lectureId })}
            className="flex items-center gap-1 bg-[#1E2A36] hover:bg-[#243447] text-[#64748B] hover:text-[#F8FAFC] text-[11px] sm:text-xs font-medium px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors border border-[#2A3B4D]"
          >
            <Play size={11} />
            <span>Review</span>
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Main Section Component ─────────────────────────────────────────────

export default function UpcomingClassesSection() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<ScheduledClass[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [reliableNowMs, setReliableNowMs] = useState<number>(Date.now())
  const [isLoading, setIsLoading] = useState(true)

  // Ref for countdown interval
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load schedules and init clock sync
  useEffect(() => {
    if (!user) return

    let cancelled = false

    const load = async () => {
      await initClockSync()
      const now = getReliableTime()

      if (cancelled) return
      setReliableNowMs(now)

      try {
        const upcoming = await getUpcomingSchedules(user.uid, now, 50)
        if (cancelled) return

        // Sort: live classes first, then by startAt ascending
        const sorted = [...upcoming].sort((a, b) => {
          const aStatus = deriveScheduleStatus(a, now)
          const bStatus = deriveScheduleStatus(b, now)
          if (aStatus === 'live' && bStatus !== 'live') return -1
          if (bStatus === 'live' && aStatus !== 'live') return 1
          return a.startAt.toMillis() - b.startAt.toMillis()
        })

        setTotalCount(sorted.length)
        setSchedules(sorted.slice(0, 3))
      } catch (err) {
        console.warn('[UpcomingClassesSection] load error:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    // Countdown updates every second (no Firestore calls — just local time)
    timerRef.current = setInterval(() => {
      setReliableNowMs(getReliableTime())
    }, 1000)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 skeleton rounded" />
        {[1, 2].map((i) => (
          <div key={i} className="h-24 skeleton rounded-2xl" />
        ))}
      </div>
    )
  }

  // Empty state — Calm, minimal self-study guidance
  if (schedules.length === 0) {
    return (
      <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1E2A36]/80 flex items-center justify-center text-[#818CF8] shrink-0">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F8FAFC]">আজকে কোনো লাইভ ক্লাস নেই</p>
            <p className="text-xs text-[#94A3B8]">
              রেকর্ডেড ক্লাসগুলো মনোযোগ দিয়ে শেষ করো এবং সেলফ স্টাডি করে আগে সিলেবাস কমপ্লিট করো।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Link
            to={ROUTES.SUBJECTS}
            className="flex items-center gap-1.5 bg-[#1E2A36] hover:bg-[#2A3B4D] text-[#F8FAFC] text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <BookOpen size={13} />
            <span>রেকর্ডেড ক্লাস</span>
          </Link>
          <Link
            to={ROUTES.SCHEDULE_CREATE}
            className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>নতুন শিডিউল</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-[#6366F1]" />
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">
            আগামী ৩টি শিডিউলড ক্লাস
          </span>
        </div>
        <Link
          to={ROUTES.SCHEDULE}
          className="flex items-center gap-1 text-xs text-[#818CF8] hover:text-[#A5B4FC] transition-colors font-medium"
        >
          <span>সম্পূর্ণ রুটিন দেখুন</span>
          <ChevronRight size={13} />
        </Link>
      </div>

      {/* Class cards */}
      <div className="space-y-2.5">
        {schedules.map((schedule) => (
          <UpcomingClassCard
            key={schedule.id}
            schedule={schedule}
            reliableNowMs={reliableNowMs}
          />
        ))}
      </div>

      {/* Link to full routine if more than 3 classes */}
      {totalCount > 3 && (
        <div className="pt-1">
          <Link
            to={ROUTES.SCHEDULE}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-[#1E2A36] hover:border-[#334155] bg-[#111820]/60 hover:bg-[#111820] text-xs font-semibold text-[#818CF8] transition-colors"
          >
            <span>সম্পূর্ণ রুটিনে আরও {totalCount - 3}টি ক্লাস রয়েছে — রুটিন দেখুন</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}

