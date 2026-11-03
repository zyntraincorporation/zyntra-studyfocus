/**
 * ExitQuoteModal.tsx -> DailyFocusBriefingModal
 *
 * Clean, lightweight Daily Focus Briefing Modal that opens on app load.
 * Displays:
 * 1. Target Exam Deadlines (Days remaining countdown)
 * 2. Today's Scheduled Live Classes status (Live / Upcoming / None)
 * 3. Quick action to start studying or join today's class immediately.
 *
 * Zero guilt-tripping quotes or laggy animations — 100% focused and fast.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Clock, Radio, CheckCircle2,
  X, ChevronRight, BookOpen, AlertCircle
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getLockedSchedules } from '@/services/schedule.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import type { ScheduledClass } from '@/types/schedule.types'
import {
  deriveScheduleStatus,
  formatScheduleTimeRange,
  formatCountdown,
} from '@/utils/schedule.utils'
import { buildRoute, ROUTES } from '@/constants/routes'
import { getThumbnailUrl } from '@/utils/youtube.utils'

const DEFAULT_HSC = '2026-04-02'

// ── Exam Countdown Helper ─────────────────────────────────────────────
export function getDaysLeft(hscDate?: string): number {
  const target = new Date(`${hscDate ?? DEFAULT_HSC}T00:00:00`)
  const diff = target.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

// ── Friendly, Healthy Break Tips (used by BreakReminderModal) ──────────
export const QUOTES: string[] = [
  'চোখকে বিশ্রাম দিন — ২০ সেকেন্ড দূরে কোনো বস্তুর দিকে তাকান (20-20-20 Rule)।',
  'এক গ্লাস বিশুদ্ধ পানি পান করুন ও নিজেকে হাইড্রেটেড রাখুন।',
  'চেয়ার ছেড়ে একটু উঠে দাঁড়ান ও হালকা স্ট্রেচিং করুন।',
  'গভীর শ্বাস নিন এবং পরবর্তী সেশনের জন্য মন শান্ত করুন।',
  'ছোট ছোট বিরতি একটানা দীর্ঘ সময় পড়াশোনায় মনোযোগ ধরে রাখতে সাহায্য করে।',
  'পড়ার টেবিল গুছিয়ে রাখুন, পরিচ্ছন্ন পরিবেশ পড়ার স্পিড বাড়িয়ে দেয়।',
]

// ── BreakQuote (Used by TimerPage during break intervals) ──────────────
export function BreakQuote() {
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  return (
    <div className="max-w-xs text-center px-4 mt-6">
      <div className="w-6 h-px bg-[#818CF8]/40 mx-auto mb-2 rounded-full" />
      <p className="text-xs text-[#94A3B8] leading-relaxed">💧 {quote}</p>
    </div>
  )
}

// ── Main Daily Briefing Modal Component ───────────────────────────────
export default function DailyBriefingModal() {
  const { user, userDoc } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [todayClasses, setTodayClasses] = useState<ScheduledClass[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())

  const hscDate = userDoc?.hscDate || DEFAULT_HSC
  const daysLeft = useMemo(() => getDaysLeft(hscDate), [hscDate])

  const formattedTargetDate = useMemo(() => {
    try {
      const d = new Date(`${hscDate}T00:00:00`)
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return hscDate
    }
  }, [hscDate])

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      timeZone: 'Asia/Dhaka',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }, [])

  // Close with Escape key
  const dismiss = useCallback(() => setDismissed(true), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dismiss])

  // Fetch today's locked classes
  useEffect(() => {
    if (!user) {
      setIsLoadingClasses(false)
      return
    }

    let isMounted = true

    initClockSync().then(() => {
      if (!isMounted) return
      const now = getReliableTime()
      setReliableNowMs(now)
      const todayKey = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

      getLockedSchedules(user.uid)
        .then((all) => {
          if (!isMounted) return
          const todayOnly = all.filter((s) => {
            const classDateKey = new Date(s.startAt.toMillis()).toLocaleDateString('en-CA', {
              timeZone: 'Asia/Dhaka',
            })
            return classDateKey === todayKey
          })
          setTodayClasses(todayOnly)
        })
        .catch((err) => {
          console.warn('[DailyBriefingModal] failed to load classes:', err)
        })
        .finally(() => {
          if (isMounted) setIsLoadingClasses(false)
        })
    })

    return () => {
      isMounted = false
    }
  }, [user])

  if (dismissed) return null

  // Urgent color indicator
  const deadlineColor = daysLeft <= 45 ? '#EF4444' : daysLeft <= 90 ? '#F59E0B' : '#818CF8'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Modal Container — Crisp, lightweight, fast loading */}
      <div className="relative w-full max-w-md bg-[#0D1117] border border-[#1E2A36] rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1E2A36] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h2 className="text-sm font-bold text-[#F8FAFC]">আজকের ফোকাস ব্রিফিং</h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">{todayFormatted} (Asia/Dhaka)</p>
          </div>

          <button
            onClick={dismiss}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E2A36] transition-colors cursor-pointer"
            title="বন্ধ করুন (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Section 1: Deadlines / Exam Countdown ── */}
        <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays size={12} className="text-[#818CF8]" />
              পরীক্ষার ডেডলাইন কাউন্টডাউন
            </span>
            <span className="text-[11px] text-[#94A3B8] font-medium bg-[#0B0F14] px-2 py-0.5 rounded-md border border-[#1E2A36]">
              লক্ষ্য: {formattedTargetDate}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-4xl font-black font-mono tracking-tight tabular-nums"
              style={{ color: deadlineColor }}
            >
              {daysLeft}
            </span>
            <span className="text-sm font-bold text-[#F8FAFC]">দিন বাকি</span>
            <span className="text-xs text-[#64748B] ml-auto">
              {daysLeft <= 45 ? '⚠️ অতি গুরুত্বপূর্ণ সময়' : daysLeft <= 90 ? '⚡ রিভিশন সময়' : '🎯 মূল প্রস্তুতি'}
            </span>
          </div>
        </div>

        {/* ── Section 2: Today's Scheduled Live Class ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
              <Radio size={12} className="text-[#22C55E]" />
              আজকের লাইভ ক্লাস শিডিউল
            </span>
            <Link
              to={ROUTES.SCHEDULE}
              onClick={dismiss}
              className="text-[11px] text-[#818CF8] hover:text-[#A5B4FC] transition-colors font-medium flex items-center gap-0.5"
            >
              রুটিন <ChevronRight size={12} />
            </Link>
          </div>

          {isLoadingClasses ? (
            <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 h-16 flex items-center justify-center text-xs text-[#64748B]">
              শিডিউল লোড হচ্ছে…
            </div>
          ) : todayClasses.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
              {todayClasses.map((c) => {
                const status = deriveScheduleStatus(c, reliableNowMs)
                const isLive = status === 'live'
                const isEnded = status === 'ended'
                const isUpcoming = status === 'upcoming'
                const countdown = isUpcoming ? c.startAt.toMillis() - reliableNowMs : 0

                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isLive
                        ? 'bg-[#0C1A0F] border-[#22C55E]/40'
                        : isEnded
                        ? 'bg-[#111820]/60 border-[#1E2A36] opacity-75'
                        : 'bg-[#111820] border-[#1E2A36]'
                    }`}
                  >
                    <img
                      src={c.thumbnailUrl || getThumbnailUrl(c.youtubeVideoId, 'medium')}
                      alt=""
                      className="w-14 h-9 object-cover rounded-lg bg-[#17202A] shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-[#F8FAFC] truncate">{c.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatScheduleTimeRange(c.startAt, c.endAt)}
                        </span>
                        {isUpcoming && countdown > 0 && (
                          <span className="text-[#818CF8] font-mono font-semibold">
                            ({formatCountdown(countdown)} বাকি)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isLive && (
                        <Link
                          to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: c.id })}
                          onClick={dismiss}
                          className="flex items-center gap-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                        >
                          <Radio size={11} />
                          Join Live
                        </Link>
                      )}
                      {isUpcoming && (
                        <Link
                          to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: c.id })}
                          onClick={dismiss}
                          className="flex items-center gap-1 bg-[#1E2A36] hover:bg-[#2A3B4D] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border border-[#2A3B4D]"
                        >
                          <Clock size={11} />
                          Waiting
                        </Link>
                      )}
                      {isEnded && (
                        <Link
                          to={buildRoute(ROUTES.WATCH, { lectureId: c.lectureId })}
                          onClick={dismiss}
                          className="flex items-center gap-1 bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#818CF8] text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors border border-[#6366F1]/30"
                        >
                          Review
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-[#22C55E] shrink-0" />
                <div>
                  <p className="font-semibold text-[#F8FAFC]">আজকে কোনো লাইভ ক্লাস নেই</p>
                  <p className="text-[11px] text-[#64748B]">আজ সেলফ-স্টাডি ও রেকর্ড ক্লাস করার দিন।</p>
                </div>
              </div>

              <Link
                to={ROUTES.SCHEDULE_CREATE}
                onClick={dismiss}
                className="text-[11px] font-semibold text-[#818CF8] hover:text-[#A5B4FC] bg-[#6366F1]/10 px-2.5 py-1 rounded-lg border border-[#6366F1]/25 shrink-0"
              >
                + শিডিউল
              </Link>
            </div>
          )}
        </div>

        {/* ── Footer CTA Button ── */}
        <div className="pt-1">
          <button
            onClick={dismiss}
            className="w-full flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] active:bg-[#4338CA] text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <BookOpen size={14} />
            পড়াশোনা শুরু করি
          </button>
        </div>
      </div>
    </div>
  )
}
