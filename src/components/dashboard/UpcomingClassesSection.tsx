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
  formatScheduleDateWithWeekday,
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

  const targetRoute = isLive
    ? buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })
    : isEnded
    ? buildRoute(ROUTES.WATCH, { lectureId: schedule.lectureId })
    : buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })

  return (
    <div
      className={`group relative flex items-center gap-2.5 sm:gap-3 rounded-xl p-2 sm:p-2.5 border transition-all duration-200 overflow-hidden ${
        isLive
          ? 'bg-[#0C1A0F] border-[#22C55E]/40 hover:border-[#22C55E]/70 shadow-[0_0_12px_rgba(34,197,94,0.08)]'
          : isEnded
          ? 'bg-[#111820] border-[#1E2A36] opacity-70'
          : 'bg-[#111820] border-[#1E2A36] hover:border-[#6366F1]/30 hover:bg-[#131D28]'
      }`}
    >
      {/* Live pulse background */}
      {isLive && (
        <div className="absolute inset-0 bg-[#22C55E]/5 pointer-events-none rounded-xl" />
      )}

      {/* Thumbnail: Crisp, fixed 16:9 */}
      <Link
        to={targetRoute}
        className="relative shrink-0 w-16 h-11 sm:w-20 sm:h-13 rounded-lg overflow-hidden bg-[#17202A] shadow-sm border border-white/5 block"
      >
        <img
          src={schedule.thumbnailUrl}
          alt={schedule.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Status overlay */}
        {isLive && (
          <div className="absolute top-0.5 left-0.5 flex items-center gap-1 bg-[#16A34A] px-1 py-0.2 rounded shadow-sm">
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
          <div className="absolute top-0.5 left-0.5 flex items-center gap-1 bg-black/75 px-1 py-0.2 rounded">
            <Lock size={8} className="text-[#94A3B8]" />
            <span className="text-[8px] text-[#CBD5E1] font-medium">LOCKED</span>
          </div>
        )}
      </Link>

      {/* Info: strictly 2 clean compact lines in one row */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <Link to={targetRoute} className="block">
          <p className="text-xs sm:text-sm font-semibold text-[#F8FAFC] truncate leading-tight group-hover:text-[#818CF8] transition-colors">
            {schedule.title}
          </p>
        </Link>

        {isLive ? (
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#4ADE80] font-medium truncate">
            <span className="flex items-center gap-1 font-semibold text-[#4ADE80]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4ADE80]" />
              </span>
              লাইভ চলছে
            </span>
            <span className="text-[#334155]">·</span>
            <span className="text-[#94A3B8] truncate">{schedule.subjectName}</span>
          </div>
        ) : isUpcoming ? (
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#94A3B8] truncate whitespace-nowrap">
            <span className="truncate font-medium text-[#CBD5E1]">
              {schedule.subjectName}
            </span>
            <span className="text-[#334155] shrink-0">·</span>
            <span className="shrink-0 text-[#818CF8] font-medium flex items-center gap-1">
              <CalendarDays size={10} className="hidden sm:inline text-[#818CF8]" />
              {formatScheduleDateWithWeekday(schedule.startAt)} · {formatScheduleTime(schedule.startAt)}
            </span>
            {info.countdownMs > 0 && (
              <>
                <span className="text-[#334155] shrink-0">·</span>
                <span className="shrink-0 text-[#A5B4FC] font-mono font-medium">
                  {formatCountdown(info.countdownMs)} বাকি
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#64748B] truncate">
            <span className="truncate">{schedule.subjectName}</span>
            <span>·</span>
            <span>ক্লাস সমাপ্ত</span>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="shrink-0 flex items-center">
        {isLive && (
          <Link
            to={targetRoute}
            className="flex items-center gap-1 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white text-[10px] sm:text-xs font-semibold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition-all shadow-sm shrink-0 whitespace-nowrap"
          >
            <Radio size={12} className="animate-pulse shrink-0" />
            <span>Join Live</span>
          </Link>
        )}
        {isUpcoming && (
          <Link
            to={targetRoute}
            className="flex items-center gap-1 bg-[#1E2A36] hover:bg-[#243447] active:scale-95 text-[#CBD5E1] hover:text-[#F8FAFC] text-[10px] sm:text-xs font-medium px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition-all border border-[#2A3B4D] shrink-0 whitespace-nowrap"
          >
            <Clock size={11} className="shrink-0 text-[#818CF8]" />
            <span>Waiting Room</span>
          </Link>
        )}
        {isEnded && (
          <Link
            to={targetRoute}
            className="flex items-center gap-1 bg-[#1E2A36] hover:bg-[#243447] active:scale-95 text-[#64748B] hover:text-[#F8FAFC] text-[10px] sm:text-xs font-medium px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition-all border border-[#2A3B4D] shrink-0 whitespace-nowrap"
          >
            <Play size={11} className="shrink-0 text-[#818CF8]" />
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

