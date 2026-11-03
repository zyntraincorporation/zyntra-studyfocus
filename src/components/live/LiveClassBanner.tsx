/**
 * LiveClassBanner.tsx
 *
 * In-app notification reminder for upcoming and live classes.
 * PRD Section 15: "Schedule Notifications & Reminders"
 *
 * Rules:
 *   - Shows when a class is currently LIVE (status === 'live')
 *   - Or when a class starts in <= 15 minutes (status === 'upcoming')
 *   - Sleek, non-intrusive banner with Join / Waiting Room action
 *   - User can dismiss it for the current session
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Radio, Clock, X, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getLockedSchedules } from '@/services/schedule.service'
import { getReliableTime } from '@/services/serverTime.service'
import { deriveScheduleStatus, formatCountdown } from '@/utils/schedule.utils'
import { buildRoute, ROUTES } from '@/constants/routes'
import type { ScheduledClass } from '@/types/schedule.types'

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

export default function LiveClassBanner() {
  const { user } = useAuth()
  const location = useLocation()
  const [schedules, setSchedules] = useState<ScheduledClass[]>([])
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())

  // Don't show the reminder if the user is already on the live watch page
  const isAlreadyOnLivePage = location.pathname.startsWith('/live/')

  useEffect(() => {
    if (!user) return

    let cancelled = false
    const load = async () => {
      try {
        const locked = await getLockedSchedules(user.uid)
        if (!cancelled) setSchedules(locked)
      } catch {
        /* ignore */
      }
    }

    load()

    const timer = setInterval(() => {
      setReliableNowMs(getReliableTime())
    }, 10000) // check every 10s

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [user])

  // Find the most urgent class (LIVE first, then closest upcoming within 15m)
  const activeAlert = useMemo(() => {
    if (isAlreadyOnLivePage) return null

    let liveClass: ScheduledClass | null = null
    let startingSoonClass: ScheduledClass | null = null
    let minCountdown = Infinity

    for (const s of schedules) {
      if (s.id === dismissedId) continue
      const status = deriveScheduleStatus(s, reliableNowMs)

      if (status === 'live') {
        liveClass = s
        break
      }

      if (status === 'upcoming') {
        const countdown = s.startAt.toMillis() - reliableNowMs
        if (countdown <= FIFTEEN_MINUTES_MS && countdown > 0 && countdown < minCountdown) {
          minCountdown = countdown
          startingSoonClass = s
        }
      }
    }

    if (liveClass) return { schedule: liveClass, type: 'live' as const }
    if (startingSoonClass) return { schedule: startingSoonClass, type: 'soon' as const, countdown: minCountdown }
    return null
  }, [schedules, reliableNowMs, dismissedId, isAlreadyOnLivePage])

  if (!activeAlert) return null

  const { schedule, type } = activeAlert

  return (
    <div
      className={`px-4 py-2.5 border-b transition-all duration-300 flex items-center justify-between gap-3 text-xs ${
        type === 'live'
          ? 'bg-[#16A34A]/10 border-[#22C55E]/30 text-[#4ADE80]'
          : 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#FCD34D]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {type === 'live' ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]" />
          </span>
        ) : (
          <Clock size={14} className="shrink-0 text-[#F59E0B]" />
        )}
        <span className="truncate">
          <strong className="font-semibold text-white mr-1.5">{schedule.title}</strong>
          {type === 'live' ? (
            <span>এখন Live সম্প্রচারিত হচ্ছে!</span>
          ) : (
            <span>
              শুরু হতে বাকি{' '}
              <span className="font-mono font-bold">
                {formatCountdown(schedule.startAt.toMillis() - reliableNowMs)}
              </span>
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={buildRoute(ROUTES.LIVE_WATCH, { scheduleId: schedule.id })}
          className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer text-[11px] ${
            type === 'live'
              ? 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-sm'
              : 'bg-[#F59E0B] hover:bg-[#D97706] text-black shadow-sm'
          }`}
        >
          {type === 'live' ? <Radio size={11} /> : <Clock size={11} />}
          <span>{type === 'live' ? 'Live Room' : 'Waiting Room'}</span>
          <ChevronRight size={12} />
        </Link>
        <button
          onClick={() => setDismissedId(schedule.id)}
          className="p-1 rounded text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

