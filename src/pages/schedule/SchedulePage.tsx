/**
 * SchedulePage.tsx — /schedule
 *
 * Complete timetable view for all scheduled classes.
 * PRD Section 9: "Full Schedule Page"
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Plus, Radio, CalendarDays, Clock, Play,
  CheckCircle2, RefreshCw, History, Lock,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getLockedSchedules, getEndedSchedules } from '@/services/schedule.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import type { ScheduledClass } from '@/types/schedule.types'
import {
  deriveScheduleStatus,
  formatScheduleDate,
  formatScheduleTimeRange,
  formatCountdown,
  formatLiveDuration,
} from '@/utils/schedule.utils'
import { buildRoute, ROUTES } from '@/constants/routes'
import Button from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

// ── Helper ────────────────────────────────────────────────────────────
function getDhakaDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

// ── Schedule Card ─────────────────────────────────────────────────────
function ScheduleCard({
  schedule,
  reliableNowMs,
}: {
  schedule: ScheduledClass
  reliableNowMs: number
}) {
  const status = deriveScheduleStatus(schedule, reliableNowMs)
  const isLive = status === 'live'
  const isEnded = status === 'ended'
  const isUpcoming = status === 'upcoming'
  const countdown = isUpcoming ? schedule.startAt.toMillis() - reliableNowMs : 0
  const effectiveDuration = schedule.playbackSpeed && schedule.playbackSpeed !== 1
    ? Math.round(schedule.durationSeconds / schedule.playbackSpeed)
    : schedule.durationSeconds

  const targetRoute = isLive
    ? buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })
    : isEnded
    ? buildRoute(ROUTES.WATCH, { lectureId: schedule.lectureId })
    : buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })

  return (
    <div
      className={`group relative rounded-2xl p-3 sm:p-4 border transition-all duration-200 ${
        isLive
          ? 'bg-gradient-to-r from-[#0C1A0F] to-[#0B1610] border-[#22C55E]/60 shadow-[0_0_0_1px_rgba(34,197,94,0.1),0_4px_20px_rgba(34,197,94,0.1)]'
          : isEnded
          ? 'bg-[#0D1117] border-[#1E2A36]/80 opacity-75'
          : 'bg-[#111820] border-[#1E2A36] hover:border-[#6366F1]/40 hover:bg-[#131D28]'
      }`}
    >
      {/* Left accent bar for live */}
      {isLive && (
        <div className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full bg-[#22C55E]" />
      )}

      {/* Main Container: responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Top/Left: Thumbnail & Info */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Thumbnail */}
          <Link
            to={targetRoute}
            className="relative shrink-0 w-24 h-16 sm:w-32 sm:h-20 rounded-xl overflow-hidden bg-[#17202A] shadow-md border border-white/5 block group-hover:opacity-95"
          >
            <img
              src={schedule.thumbnailUrl}
              alt={schedule.title}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                isEnded ? 'grayscale-[25%]' : ''
              }`}
              loading="lazy"
            />
            {/* Overlay status badge */}
            {isLive && (
              <div className="absolute top-1 left-1 flex items-center gap-1 bg-[#16A34A] px-1.5 py-0.5 rounded shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
              </div>
            )}
            {isEnded && (
              <div className="absolute inset-0 bg-black/45 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={18} className="text-[#4ADE80]" />
              </div>
            )}
            {isUpcoming && (
              <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/75 backdrop-blur-xs px-1.5 py-0.5 rounded">
                <Lock size={9} className="text-[#94A3B8]" />
                <span className="text-[9px] text-[#CBD5E1] font-medium">LOCKED</span>
              </div>
            )}
          </Link>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <Link to={targetRoute} className="block">
              <p className="text-sm sm:text-base font-bold text-[#F8FAFC] line-clamp-2 leading-snug group-hover:text-[#818CF8] transition-colors">
                {schedule.title}
              </p>
            </Link>

            <p className="text-xs text-[#94A3B8] truncate">
              <span className="font-medium text-[#CBD5E1]">{schedule.subjectName}</span>
              {schedule.chapterName && (
                <>
                  <span className="text-[#475569] mx-1">·</span>
                  <span>{schedule.chapterName}</span>
                </>
              )}
            </p>

            {/* Time range & duration */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B] flex-wrap pt-0.5">
              <span className="flex items-center gap-1 text-[#818CF8] font-mono">
                <Clock size={11} className="text-[#818CF8] shrink-0" />
                {formatScheduleTimeRange(schedule.startAt, schedule.endAt)}
              </span>
              <span className="text-[#334155]">·</span>
              <span className="font-mono text-[#94A3B8]">
                {formatLiveDuration(effectiveDuration)}
              </span>
              {schedule.playbackSpeed && schedule.playbackSpeed !== 1 && (
                <>
                  <span className="text-[#334155]">·</span>
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/25">
                    ⚡{schedule.playbackSpeed}x
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action & Countdown Section */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2.5 sm:pt-0 border-t border-[#1E2A36]/70 sm:border-t-0 shrink-0">
          {/* Countdown / Status Pill */}
          {isUpcoming && countdown > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#818CF8] bg-[#6366F1]/10 px-2.5 py-1 rounded-lg border border-[#6366F1]/20">
              <Clock size={12} className="text-[#818CF8]" />
              <span>{formatCountdown(countdown)} বাকি</span>
            </div>
          )}

          {isLive && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80] sm:hidden">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ADE80]" />
              </span>
              <span>লাইভ চলছে</span>
            </div>
          )}

          {isEnded && (
            <span className="text-xs text-[#64748B] sm:hidden">ক্লাস সমাপ্ত</span>
          )}

          {/* Action button */}
          <div className="shrink-0">
            {isLive && (
              <Link
                to={targetRoute}
                className="flex items-center gap-1.5 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-[#16A34A]/20"
              >
                <Radio size={13} className="animate-pulse" />
                <span>Join Live</span>
              </Link>
            )}
            {isUpcoming && (
              <Link
                to={targetRoute}
                className="flex items-center gap-1.5 bg-[#1E2A36] hover:bg-[#2A3B4D] active:scale-95 text-[#CBD5E1] hover:text-[#F8FAFC] text-xs font-semibold px-3.5 py-2 rounded-xl transition-all border border-[#2A3B4D] hover:border-[#3B4F66]"
              >
                <Clock size={12} />
                <span>Waiting Room</span>
              </Link>
            )}
            {isEnded && (
              <Link
                to={targetRoute}
                className="flex items-center gap-1.5 bg-[#6366F1]/10 hover:bg-[#6366F1]/20 active:scale-95 text-[#818CF8] hover:text-[#A5B4FC] text-xs font-semibold px-3.5 py-2 rounded-xl transition-all border border-[#6366F1]/25 hover:border-[#6366F1]/50"
              >
                <Play size={12} />
                <span>Review</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Date Section ──────────────────────────────────────────────────────
function DateSection({
  title,
  icon,
  schedules,
  reliableNowMs,
}: {
  title: string
  icon?: React.ReactNode
  schedules: ScheduledClass[]
  reliableNowMs: number
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 py-1">
        {icon && <span className="text-[#818CF8]">{icon}</span>}
        <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
          {title}
        </span>
        <div className="flex-1 h-px bg-[#1E2A36]" />
        <span className="text-[11px] text-[#64748B] font-mono">{schedules.length}টি ক্লাস</span>
      </div>
      <div className="space-y-2.5">
        {schedules.map((s) => (
          <ScheduleCard key={s.id} schedule={s} reliableNowMs={reliableNowMs} />
        ))}
      </div>
    </div>
  )
}

// ── Tab type ──────────────────────────────────────────────────────────
type Tab = 'upcoming' | 'history'

// ── Main Page ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { user } = useAuth()
  const location = useLocation()
  const [tab, setTab] = useState<Tab>(
    location.pathname.includes('/history') ? 'history' : 'upcoming'
  )

  useEffect(() => {
    if (location.pathname.includes('/history')) setTab('history')
  }, [location.pathname])

  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduledClass[]>([])
  const [endedSchedules, setEndedSchedules] = useState<ScheduledClass[]>([])
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    await initClockSync()
    const now = getReliableTime()
    setReliableNowMs(now)

    const [upcoming, ended] = await Promise.all([
      getLockedSchedules(user.uid),
      getEndedSchedules(user.uid, now, 50),
    ])

    const notEnded = upcoming.filter((s) => s.endAt.toMillis() > now)
    setUpcomingSchedules(notEnded)
    setEndedSchedules(ended)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => setReliableNowMs(getReliableTime()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const todayKey = getDhakaDateKey(reliableNowMs)
  const tomorrowKey = getDhakaDateKey(reliableNowMs + 86400000)

  const todayClasses = upcomingSchedules.filter(
    (s) => getDhakaDateKey(s.startAt.toMillis()) === todayKey
  )
  const tomorrowClasses = upcomingSchedules.filter(
    (s) => getDhakaDateKey(s.startAt.toMillis()) === tomorrowKey
  )
  const laterClasses = upcomingSchedules.filter((s) => {
    const dk = getDhakaDateKey(s.startAt.toMillis())
    return dk !== todayKey && dk !== tomorrowKey
  })

  const liveCount = upcomingSchedules.filter(
    (s) => deriveScheduleStatus(s, reliableNowMs) === 'live'
  ).length

  return (
    <div className="animate-fade-in max-w-4xl mx-auto w-full px-3 sm:px-6 space-y-5 sm:space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#F8FAFC]">ক্লাস রুটিন</h1>
            {liveCount > 0 && (
              <span className="flex items-center gap-1 bg-[#16A34A]/15 border border-[#16A34A]/30 text-[#4ADE80] text-[10px] font-bold px-2 py-0.5 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4ADE80]" />
                </span>
                {liveCount}টি LIVE
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#64748B]">
            আপনার নির্ধারিত সকল লাইভ ক্লাসের ধারাবাহিক রুটিন
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="p-2 rounded-xl text-[#475569] hover:text-[#F8FAFC] border border-[#1E2A36] hover:border-[#334155] hover:bg-[#111820] transition-colors cursor-pointer"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw size={14} />
          </button>
          <Link to={ROUTES.SCHEDULE_CREATE}>
            <Button leftIcon={<Plus size={14} />} size="sm">
              নতুন শিডিউল
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-1">
        {([
          {
            id: 'upcoming' as Tab,
            label: 'আসন্ন রুটিন',
            count: upcomingSchedules.length,
            icon: CalendarDays,
          },
          {
            id: 'history' as Tab,
            label: 'সম্পন্ন ক্লাস',
            count: endedSchedules.length,
            icon: History,
          },
        ]).map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === id
                ? 'bg-[#6366F1] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820]'
            }`}
          >
            <Icon size={13} />
            {label}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === id
                  ? 'bg-white/20 text-white'
                  : 'bg-[#1E2A36] text-[#475569]'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <SkeletonList count={4} />
      ) : tab === 'upcoming' ? (
        <div className="space-y-6">
          {upcomingSchedules.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={36} />}
              title="কোনো আসন্ন ক্লাস রুটিন নেই"
              description="নতুন ক্লাস শিডিউল তৈরি করে আপনার রুটিন সাজান।"
              action={
                <Link to={ROUTES.SCHEDULE_CREATE}>
                  <Button leftIcon={<Plus size={14} />}>নতুন শিডিউল তৈরি করুন</Button>
                </Link>
              }
            />
          ) : (
            <>
              {todayClasses.length > 0 && (
                <DateSection
                  title="আজকের রুটিন"
                  icon={<Radio size={13} className="text-[#22C55E]" />}
                  schedules={todayClasses}
                  reliableNowMs={reliableNowMs}
                />
              )}
              {tomorrowClasses.length > 0 && (
                <DateSection
                  title="আগামীকালের রুটিন"
                  icon={<CalendarDays size={13} className="text-[#818CF8]" />}
                  schedules={tomorrowClasses}
                  reliableNowMs={reliableNowMs}
                />
              )}
              {laterClasses.length > 0 && (
                <DateSection
                  title="পরবর্তী দিনসমূহ"
                  icon={<Clock size={13} className="text-[#F59E0B]" />}
                  schedules={laterClasses}
                  reliableNowMs={reliableNowMs}
                />
              )}
            </>
          )}
        </div>
      ) : (
        /* History tab */
        <div className="space-y-2">
          {endedSchedules.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={36} />}
              title="কোনো সম্পন্ন ক্লাস নেই"
              description="ক্লাস শেষ হলে এখানে ইতিহাস দেখাবে।"
            />
          ) : (
            <div className="space-y-2">
              {endedSchedules.map((s) => (
                <ScheduleCard key={s.id} schedule={s} reliableNowMs={reliableNowMs} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
