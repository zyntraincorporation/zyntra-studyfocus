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
  CheckCircle2, RefreshCw, History, Lock, XCircle,
  BookOpen, FolderOpen, ArrowUpDown, RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getLockedSchedules, getEndedSchedules } from '@/services/schedule.service'
import { getAttendanceForSchedules } from '@/services/attendance.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import { getSubjects, getAllChapters } from '@/services/curriculum.service'
import type { Subject, Chapter } from '@/types/curriculum.types'
import type { ScheduledClass, ScheduleAttendanceSummary } from '@/types/schedule.types'
import {
  deriveScheduleStatus,
  formatScheduleDate,
  formatScheduleDateNumeric,
  formatScheduleTimeRange,
  formatCountdown,
  formatLiveDuration,
} from '@/utils/schedule.utils'
import { formatDurationHuman } from '@/utils/time.utils'
import { buildRoute, ROUTES } from '@/constants/routes'
import Button from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

// ── Helper ────────────────────────────────────────────────────────────
function getDhakaDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

function groupSchedulesByChapter(schedules: ScheduledClass[]) {
  const groups: { key: string; chapterName: string; subjectName: string; schedules: ScheduledClass[] }[] = []
  const map = new Map<string, typeof groups[0]>()

  schedules.forEach((s) => {
    const key = s.chapterId || s.chapterName || 'other'
    if (!map.has(key)) {
      const g = {
        key,
        chapterName: s.chapterName || 'অধ্যায় নির্ধারিত নয়',
        subjectName: s.subjectName || 'সাধারণ বিষয়',
        schedules: [],
      }
      map.set(key, g)
      groups.push(g)
    }
    map.get(key)!.schedules.push(s)
  })

  return groups.sort((a, b) =>
    (a.subjectName || '').localeCompare(b.subjectName || '', 'bn') ||
    (a.chapterName || '').localeCompare(b.chapterName || '', 'bn')
  )
}

// ── Schedule Card ─────────────────────────────────────────────────────
function ScheduleCard({
  schedule,
  reliableNowMs,
  attendance,
}: {
  schedule: ScheduledClass
  reliableNowMs: number
  attendance?: ScheduleAttendanceSummary
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
                {attendance?.status === 'complete' ? (
                  <CheckCircle2 size={18} className="text-[#4ADE80]" />
                ) : attendance?.status === 'partial' ? (
                  <Clock size={18} className="text-[#FBBF24]" />
                ) : attendance?.status === 'not_attended' ? (
                  <XCircle size={18} className="text-[#F87171]" />
                ) : (
                  <CheckCircle2 size={18} className="text-[#4ADE80]" />
                )}
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

            {/* Time range / Date & duration */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B] flex-wrap pt-0.5">
              {isEnded ? (
                <span className="flex items-center gap-1 text-[#818CF8] font-mono">
                  <CalendarDays size={11} className="text-[#818CF8] shrink-0" />
                  {formatScheduleDateNumeric(schedule.startAt)}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#818CF8] font-mono">
                  <Clock size={11} className="text-[#818CF8] shrink-0" />
                  {formatScheduleTimeRange(schedule.startAt, schedule.endAt)}
                </span>
              )}
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

        {/* Action & Countdown / Attendance Section */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2.5 sm:pt-0 border-t border-[#1E2A36]/70 sm:border-t-0 shrink-0">
          {/* Countdown / Status Pill for Upcoming */}
          {isUpcoming && countdown > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#818CF8] bg-[#6366F1]/10 px-2.5 py-1 rounded-lg border border-[#6366F1]/20">
              <Clock size={12} className="text-[#818CF8]" />
              <span>{formatCountdown(countdown)} বাকি</span>
            </div>
          )}

          {/* Ended: Simple Clean Attendance Badge (Completed / Partial / Not Attended only) */}
          {isEnded && (
            <div>
              {attendance ? (
                attendance.status === 'complete' ? (
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#4ADE80] bg-[#22C55E]/10 px-2.5 py-1 rounded-lg border border-[#22C55E]/25">
                    <CheckCircle2 size={12} className="text-[#22C55E] shrink-0" />
                    <span>Completed</span>
                  </div>
                ) : attendance.status === 'partial' ? (
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#FBBF24] bg-[#F59E0B]/10 px-2.5 py-1 rounded-lg border border-[#F59E0B]/25">
                    <Clock size={12} className="text-[#F59E0B] shrink-0" />
                    <span>Partial</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#F87171] bg-[#EF4444]/10 px-2.5 py-1 rounded-lg border border-[#EF4444]/25">
                    <XCircle size={12} className="text-[#EF4444] shrink-0" />
                    <span>Not Attended</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1 text-xs text-[#64748B] bg-[#1E2A36]/40 px-2.5 py-1 rounded-lg border border-[#1E2A36]">
                  <CheckCircle2 size={11} className="text-[#64748B]" />
                  <span>Completed</span>
                </div>
              )}
            </div>
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
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'time' | 'chapter'>('time')
  const [attendanceMap, setAttendanceMap] = useState<Record<string, ScheduleAttendanceSummary>>({})
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (!user) return
    setIsLoading(true)
    await initClockSync()
    const now = getReliableTime()
    setReliableNowMs(now)

    // Concurrently fetch locked schedules, subjects, and chapters
    const [allLocked, allSubjects, allChapters] = await Promise.all([
      getLockedSchedules(user.uid, forceRefresh),
      getSubjects(user.uid).catch(() => []),
      getAllChapters(user.uid).catch(() => []),
    ])

    const chapterMap = new Map(allChapters.map((c) => [c.id, c.name]))
    const subjectMap = new Map(allSubjects.map((s) => [s.id, s.name]))

    // Dynamically synchronize chapterName & subjectName so any edits are immediately reflected
    const synchronized = allLocked.map((s) => ({
      ...s,
      chapterName: chapterMap.get(s.chapterId) || s.chapterName,
      subjectName: subjectMap.get(s.subjectId) || s.subjectName,
    }))

    setSubjects(allSubjects)
    setChapters(allChapters)

    const notEnded = synchronized.filter((s) => s.endAt && s.endAt.toMillis() > now)
    const ended = synchronized
      .filter((s) => s.endAt && s.endAt.toMillis() <= now)
      .sort((a, b) => b.endAt.toMillis() - a.endAt.toMillis())
      .slice(0, 50)

    setUpcomingSchedules(notEnded)
    setEndedSchedules(ended)

    if (ended.length > 0) {
      getAttendanceForSchedules(user.uid, ended).then(setAttendanceMap)
    }

    setIsLoading(false)
  }, [user])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => setReliableNowMs(getReliableTime()), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const todayKey = getDhakaDateKey(reliableNowMs)
  const tomorrowKey = getDhakaDateKey(reliableNowMs + 86400000)

  // Filter options
  const filteredChapterOptions = selectedSubjectId === 'all'
    ? chapters
    : chapters.filter((c) => c.subjectId === selectedSubjectId)

  const filterSchedule = (s: ScheduledClass) => {
    if (selectedSubjectId !== 'all' && s.subjectId !== selectedSubjectId) return false
    if (selectedChapterId !== 'all' && s.chapterId !== selectedChapterId) return false
    return true
  }

  const filteredUpcoming = upcomingSchedules.filter(filterSchedule)
  const filteredEnded = endedSchedules.filter(filterSchedule)

  const todayClasses = filteredUpcoming.filter(
    (s) => getDhakaDateKey(s.startAt.toMillis()) === todayKey
  )
  const tomorrowClasses = filteredUpcoming.filter(
    (s) => getDhakaDateKey(s.startAt.toMillis()) === tomorrowKey
  )
  const laterClasses = filteredUpcoming.filter((s) => {
    const dk = getDhakaDateKey(s.startAt.toMillis())
    return dk !== todayKey && dk !== tomorrowKey
  })

  const upcomingByChapter = groupSchedulesByChapter(filteredUpcoming)
  const endedByChapter = groupSchedulesByChapter(filteredEnded)

  const liveCount = upcomingSchedules.filter(
    (s) => deriveScheduleStatus(s, reliableNowMs) === 'live'
  ).length

  return (
    <div className="animate-fade-in max-w-4xl mx-auto w-full px-3 sm:px-6 space-y-5 sm:space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => load(true)}
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

      {/* ── Simple Subject & Chapter Filter & Sort Bar ── */}
      {!isLoading && (upcomingSchedules.length > 0 || endedSchedules.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 sm:p-2.5 bg-[#0B0F14] border border-[#1E2A36] rounded-xl text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 min-w-[130px] sm:min-w-[150px]">
              <BookOpen size={13} className="text-[#818CF8] shrink-0" />
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value)
                  setSelectedChapterId('all')
                }}
                className="w-full bg-[#111820] border border-[#1E2A36] text-[#F8FAFC] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6366F1] cursor-pointer"
              >
                <option value="all">সকল বিষয়</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter Filter */}
            <div className="flex items-center gap-1.5 min-w-[140px] sm:min-w-[160px]">
              <FolderOpen size={13} className="text-[#38BDF8] shrink-0" />
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full bg-[#111820] border border-[#1E2A36] text-[#F8FAFC] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6366F1] cursor-pointer"
              >
                <option value="all">সকল অধ্যায়</option>
                {filteredChapterOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters button */}
            {(selectedSubjectId !== 'all' || selectedChapterId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId('all')
                  setSelectedChapterId('all')
                }}
                className="flex items-center gap-1 text-[11px] text-[#818CF8] hover:text-[#A5B4FC] px-1.5 py-1 rounded transition-colors cursor-pointer"
                title="ফিল্টার রিসেট করুন"
              >
                <RotateCcw size={11} />
                <span>রিসেট</span>
              </button>
            )}
          </div>

          {/* Sort Selector: By Time vs By Chapter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpDown size={12} className="text-[#64748B]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'time' | 'chapter')}
              className="bg-[#111820] border border-[#1E2A36] text-[#F8FAFC] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#6366F1] cursor-pointer text-xs"
            >
              <option value="time">সময় অনুযায়ী</option>
              <option value="chapter">অধ্যায় অনুযায়ী</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <SkeletonList count={4} />
      ) : tab === 'upcoming' ? (
        <div className="space-y-4 sm:space-y-5">
          {upcomingSchedules.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={36} />}
              title="কোনো আসন্ন ক্লাস নেই"
              action={
                <Link to={ROUTES.SCHEDULE_CREATE}>
                  <Button leftIcon={<Plus size={14} />}>নতুন শিডিউল</Button>
                </Link>
              }
            />
          ) : filteredUpcoming.length === 0 ? (
            <div className="text-center py-8 text-[#64748B] text-xs sm:text-sm border border-dashed border-[#1E2A36] rounded-xl bg-[#0D1117] space-y-2">
              <p>কোনো ক্লাস পাওয়া যায়নি</p>
              <button
                onClick={() => {
                  setSelectedSubjectId('all')
                  setSelectedChapterId('all')
                }}
                className="text-xs text-[#818CF8] hover:underline cursor-pointer font-medium"
              >
                ফিল্টার মুছুন
              </button>
            </div>
          ) : sortBy === 'chapter' ? (
            <div className="space-y-4">
              {upcomingByChapter.map((group) => (
                <DateSection
                  key={group.key}
                  title={`${group.subjectName} · ${group.chapterName}`}
                  icon={<FolderOpen size={13} className="text-[#38BDF8]" />}
                  schedules={group.schedules}
                  reliableNowMs={reliableNowMs}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
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
            </div>
          )}
        </div>
      ) : (
        /* History tab */
        <div className="space-y-3">
          {endedSchedules.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={36} />}
              title="কোনো সম্পন্ন ক্লাস নেই"
            />
          ) : filteredEnded.length === 0 ? (
            <div className="text-center py-8 text-[#64748B] text-xs sm:text-sm border border-dashed border-[#1E2A36] rounded-xl bg-[#0D1117] space-y-2">
              <p>কোনো ক্লাস পাওয়া যায়নি</p>
              <button
                onClick={() => {
                  setSelectedSubjectId('all')
                  setSelectedChapterId('all')
                }}
                className="text-xs text-[#818CF8] hover:underline cursor-pointer font-medium"
              >
                ফিল্টার মুছুন
              </button>
            </div>
          ) : sortBy === 'chapter' ? (
            <div className="space-y-4">
              {endedByChapter.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  <div className="flex items-center gap-2 py-1">
                    <FolderOpen size={13} className="text-[#38BDF8]" />
                    <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                      {group.subjectName} · {group.chapterName}
                    </span>
                    <div className="flex-1 h-px bg-[#1E2A36]" />
                    <span className="text-[11px] text-[#64748B] font-mono">{group.schedules.length}টি ক্লাস</span>
                  </div>
                  <div className="space-y-2">
                    {group.schedules.map((s) => (
                      <ScheduleCard
                        key={s.id}
                        schedule={s}
                        reliableNowMs={reliableNowMs}
                        attendance={attendanceMap[s.id]}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEnded.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  reliableNowMs={reliableNowMs}
                  attendance={attendanceMap[s.id]}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
