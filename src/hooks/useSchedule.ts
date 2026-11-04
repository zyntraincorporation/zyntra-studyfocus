/**
 * useSchedule.ts
 *
 * React hook for loading a scheduled class and computing live-derived state.
 * Uses reliable server-synced time (initClockSync) for all schedule decisions.
 *
 * Features:
 *   - Fetches schedule from Firestore once on mount
 *   - Initialises clock sync (NTP-style) before first read
 *   - Updates reliableNowMs every second (no Firestore on tick)
 *   - Exposes: schedule, status, reliableNowMs, livePositionSeconds, isLoading
 *   - Destroys clock sync on unmount
 */

import { useEffect, useState, useRef } from 'react'
import { getScheduledClass } from '@/services/schedule.service'
import { initClockSync, getReliableTime, destroyClockSync } from '@/services/serverTime.service'
import {
  deriveScheduleStatus,
  calculateExpectedLivePosition,
  calculateScheduleBreakInfo,
} from '@/utils/schedule.utils'
import type { ScheduledClass, ScheduleStatus, BreakInfo } from '@/types/schedule.types'

interface UseScheduleResult {
  schedule: ScheduledClass | null
  status: ScheduleStatus | null
  reliableNowMs: number
  livePositionSeconds: number
  breakInfo: BreakInfo
  isLoading: boolean
  error: string | null
}

/**
 * Loads a scheduled class and provides live-derived computed state.
 *
 * @param userId  - Authenticated user UID
 * @param scheduleId - Firestore document ID of the scheduledClass
 */
export function useSchedule(
  userId: string | null | undefined,
  scheduleId: string | null | undefined
): UseScheduleResult {
  const [schedule, setSchedule] = useState<ScheduledClass | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reliableNowMs, setReliableNowMs] = useState<number>(Date.now())

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    if (!userId || !scheduleId) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // 1. Sync clock with server before loading schedule data
        await initClockSync()
        if (cancelled) return

        setReliableNowMs(getReliableTime())

        // 2. Fetch schedule from Firestore
        const sc = await getScheduledClass(userId, scheduleId)
        if (cancelled) return

        if (!sc) {
          setError('Schedule পাওয়া যায়নি।')
          setIsLoading(false)
          return
        }

        if (!sc.isLocked) {
          setError('এই Schedule এখনো Lock হয়নি।')
          setIsLoading(false)
          return
        }

        setSchedule(sc)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          console.error('[useSchedule] Load error:', err)
          setError('Schedule লোড করতে সমস্যা হয়েছে।')
          setIsLoading(false)
        }
      }
    }

    load()

    // Tick every second — no Firestore calls in this interval
    timerRef.current = setInterval(() => {
      setReliableNowMs(getReliableTime())
    }, 1000)

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      destroyClockSync()
    }
  }, [userId, scheduleId])

  // Compute derived state from current reliable time
  const status: ScheduleStatus | null = schedule
    ? deriveScheduleStatus(schedule, reliableNowMs)
    : null

  const livePositionSeconds: number =
    schedule && status === 'live'
      ? calculateExpectedLivePosition(schedule, reliableNowMs)
      : 0

  const realElapsed = schedule
    ? Math.max(0, (reliableNowMs - schedule.startAt.toMillis()) / 1000)
    : 0

  const breakInfo: BreakInfo = schedule
    ? calculateScheduleBreakInfo(
        schedule.durationSeconds,
        status === 'live' ? realElapsed : 0,
        schedule.playbackSpeed ?? 1
      )
    : {
        hasBreaks: false,
        isBreakActive: false,
        currentBreakNumber: 0,
        totalBreaks: 0,
        breakRemainingSeconds: 0,
        expectedVideoPosition: 0,
        totalScheduledDurationSeconds: 0,
      }

  return {
    schedule,
    status,
    reliableNowMs,
    livePositionSeconds,
    breakInfo,
    isLoading,
    error,
  }
}

