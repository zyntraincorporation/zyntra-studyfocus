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
  CheckCircle2, RefreshCw, History,
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

  return (
    <div
      className={`group relative flex items-center gap-3.5 sm:gap-5 rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 ${
        isLive
          ? 'bg-gradient-to-r from-[#0C1A0F] to-[#0B1610] border-[#22C55E]/60 shadow-[0_0_0_1px_rgba(34,197,94,0.1),0_4px_24px_rgba(34,197,94,0.08)]'
          : isEnded
          ? 'bg-[#0D1117] border-[#1E2A36]/80 opacity-70'
          : 'bg-[#111820] border-[#1E2A36] hover:border-[#6366F1]/40 hover:bg-[#131D28]'
      }`}
    >
      {/* Left accent bar for live */}
      {isLive && (
        <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[#22C55E]" />
      )}

      {/* Thumbnail */}
      <div className="relative shrink-0 w-28 h-18 sm:w-36 sm:h-22 rounded-xl overflow-hidden bg-[#17202A] shadow-md">
        <img
          src={schedule.thumbnailUrl}
          alt={schedule.title}
          className={`w-full h-full object-cover transition-all ${
            isEnded ? 'grayscale-[30%]' : ''
          }`}
          loading="lazy"
        />
        {/* Status overlay on thumbnail */}
        {isLive && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-[#16A34A] px-1.5 py-0.5 rounded-md shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            <span className="text-[9px] font-bold text-white tracking-wide">LIVE</span>
          </div>
        )}
        {isEnded && (
          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
            <CheckCircle2 size={20} className="text-[#4ADE80]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
        <div className="space-y-0.5">
          <p className="text-sm sm:text-base font-bold text-[#F8FAFC] truncate leading-snug">
            {schedule.title}
          </p>
          <p className="text-xs sm:text-sm text-[#94A3B8] truncate">
            {schedule.subjectName} · {schedule.chapterName}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] sm:text-xs text-[#64748B]">
            <CalendarDays size={11} className="text-[#818CF8]" />
            {formatScheduleDate(schedule.startAt)}
          </span>
          <span className="text-[#334155]">·</span>
          <span className="flex items-center gap-1 text-[11px] sm:text-xs text-[#64748B]">
            <Clock size={11} className="text-[#818CF8]" />
            {formatScheduleTimeRange(schedule.startAt, schedule.endAt)}
          </span>
          <span className="text-[#334155]">·</span>
          <span className="text-[11px] sm:text-xs text-[#64748B] font-mono">
            {formatLiveDuration(schedule.durationSeconds)}
          </span>

          {isUpcoming && countdown > 0 && (
            <span className="ml-auto text-[11px] sm:text-xs font-mono font-bold text-[#818CF8] bg-[#6366F1]/10 px-2.5 py-0.5 rounded-full border border-[#6366F1]/20">
              {formatCountdown(countdown)}
            </span>
          )}
          {isLive && (
            <span className="ml-auto text-[11px] sm:text-xs font-bold text-[#4ADE80] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              চলছে এখন
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0 flex items-center">
        {isLive && (
          <Link
            to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })}
            className="flex items-center gap-1.5 bg-[#16A34A] hover:bg-[#15803D] active:bg-[#166534] text-white text-xs sm:text-sm font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl transition-colors shadow-md"
          >
            <Radio size={14} />
            Join Live
          </Link>
        )}
        {isUpcoming && (
          <Link
            to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })}
            className="flex items-center gap-1.5 text-[#94A3B8] hover:text-[#F8FAFC] text-xs sm:text-sm font-semibold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-colors border border-[#1E2A36] hover:border-[#334155] hover:bg-[#111820]"
          >
            <Clock size={13} />
            Waiting Room
          </Link>
        )}
        {isEnded && (
          <Link
            to={buildRoute(ROUTES.WATCH, { lectureId: schedule.lectureId })}
            className="flex items-center gap-1.5 text-[#818CF8] hover:text-[#A5B4FC] text-xs sm:text-sm font-semibold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-colors border border-[#6366F1]/20 hover:border-[#6366F1]/50 bg-[#6366F1]/8 hover:bg-[#6366F1]/15"
          >
            <Play size={13} />
            Review
          </Link>
        )}
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 py-1">
        {icon && <span className="text-[#475569]">{icon}</span>}
        <span className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
          {title}
        </span>
        <div className="flex-1 h-px bg-[#1E2A36]" />
        <span className="text-[11px] text-[#334155]">{schedules.length}টি ক্লাস</span>
      </div>
      <div className="space-y-2">
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
    <div className="animate-fade-in max-w-5xl mx-auto w-full px-2 sm:px-6 space-y-6 sm:space-y-8 pb-12">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#F8FAFC]">ক্লাস রুটিন</h1>
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
          <p className="text-sm text-[#475569]">
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
                  icon={<Radio size={12} />}
                  schedules={todayClasses}
                  reliableNowMs={reliableNowMs}
                />
              )}
              {tomorrowClasses.length > 0 && (
                <DateSection
                  title="আগামীকালের রুটিন"
                  icon={<CalendarDays size={12} />}
                  schedules={tomorrowClasses}
                  reliableNowMs={reliableNowMs}
                />
              )}
              {laterClasses.length > 0 && (
                <DateSection
                  title="পরবর্তী দিনসমূহ"
                  icon={<Clock size={12} />}
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
