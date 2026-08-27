/**
 * useBreakReminder — tracks ACTIVE study time only.
 *
 * Design:
 *  - Uses Date.now() snapshots (not setInterval counters) for drift-free accuracy.
 *  - Paused time is NEVER counted as active study time.
 *  - Tab-hidden time is automatically paused.
 *  - Checks reminder condition every 10 seconds via a single lightweight interval.
 *  - Snooze adds minutes to the next threshold without resetting total.
 *
 * Integration (WatchPage):
 *   const br = useBreakReminder(userDoc?.breakReminderMinutes ?? 50)
 *   // Call br.start() when video plays, br.pause() when video pauses/ends.
 *   // Render <BreakReminderModal> when br.reminderDue is true.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseBreakReminderReturn {
  /** Call when the video starts playing. */
  start(): void
  /** Call when the video pauses or ends. */
  pause(): void
  /** Full reset — use when the user takes their break. */
  reset(): void
  /** Defer the next reminder by `minutes` additional minutes of active time. */
  snooze(minutes?: number): void
  /** Hide the modal without resetting the timer. */
  dismiss(): void
  /** True when the active study threshold has been reached. */
  reminderDue: boolean
  /** Current accumulated active study time in seconds. */
  activeSeconds: number
}

export function useBreakReminder(thresholdMinutes: number): UseBreakReminderReturn {
  const thresholdSeconds = thresholdMinutes * 60

  // Accumulated active seconds (from completed play-to-pause segments)
  const accumulatedRef = useRef(0)
  // Extra seconds added by snooze
  const snoozeExtraRef = useRef(0)
  // Timestamp when the current play segment started (null = paused)
  const segmentStartRef = useRef<number | null>(null)
  // Whether the reminder has been dismissed without resetting
  const dismissedRef = useRef(false)

  const [reminderDue, setReminderDue] = useState(false)
  const [activeSeconds, setActiveSeconds] = useState(0)

  /** Compute total active seconds including the current live segment */
  const getTotalActive = useCallback(() => {
    const live =
      segmentStartRef.current !== null ? (Date.now() - segmentStartRef.current) / 1000 : 0
    return accumulatedRef.current + live
  }, [])

  const checkReminder = useCallback(() => {
    const total = getTotalActive()
    setActiveSeconds(Math.floor(total))
    const effective = thresholdSeconds + snoozeExtraRef.current
    if (!dismissedRef.current && total >= effective) {
      setReminderDue(true)
    }
  }, [getTotalActive, thresholdSeconds])

  // Periodic check every 10 seconds
  useEffect(() => {
    const id = setInterval(checkReminder, 10_000)
    return () => clearInterval(id)
  }, [checkReminder])

  // Pause accumulation when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Flush current segment into accumulated
        if (segmentStartRef.current !== null) {
          accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000
          segmentStartRef.current = null
        }
      } else {
        // Resume if we were playing before tab was hidden
        // (WatchPage will call start() again on play; nothing to do here)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const start = useCallback(() => {
    // Only start a new segment if not already running
    if (segmentStartRef.current === null) {
      segmentStartRef.current = Date.now()
    }
    // If user resumed after dismissal, allow reminder to fire again
    dismissedRef.current = false
  }, [])

  const pause = useCallback(() => {
    if (segmentStartRef.current !== null) {
      accumulatedRef.current += (Date.now() - segmentStartRef.current) / 1000
      segmentStartRef.current = null
    }
    checkReminder()
  }, [checkReminder])

  const reset = useCallback(() => {
    accumulatedRef.current = 0
    snoozeExtraRef.current = 0
    segmentStartRef.current = null
    dismissedRef.current = false
    setReminderDue(false)
    setActiveSeconds(0)
  }, [])

  const snooze = useCallback((minutes = 5) => {
    snoozeExtraRef.current += minutes * 60
    dismissedRef.current = false
    setReminderDue(false)
  }, [])

  const dismiss = useCallback(() => {
    dismissedRef.current = true
    setReminderDue(false)
  }, [])

  return { start, pause, reset, snooze, dismiss, reminderDue, activeSeconds }
}
