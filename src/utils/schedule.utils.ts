/**
 * schedule.utils.ts
 *
 * Pure utility functions for the Scheduled Live Learning System.
 * These functions are stateless and have NO side effects.
 *
 * Key operations:
 *   - Schedule status determination from time comparison
 *   - Expected live video position calculation
 *   - Duration formatting for schedule display
 *   - Conflict detection logic
 *   - Asia/Dhaka date/time conversion helpers
 */

import type { ScheduledClass, ScheduleStatus, ScheduleDisplayInfo, BreakInfo } from '@/types/schedule.types'
import { Timestamp } from 'firebase/firestore'

// ── Long Class Break Constants & Calculator ────────────────────────────
export const BREAK_INTERVAL_SECONDS = 3600 // 1 hour of active lecture
export const BREAK_DURATION_SECONDS = 600  // 10 minutes mandatory break
export const LONG_CLASS_THRESHOLD_SECONDS = 150 * 60 // 2h 30m (classes around 3h+)

/**
 * Calculates mandatory break timeline for long marathon classes (around 3h+ / >= 2h30m).
 * Every 1 hour of lecture, a mandatory 10-minute break pauses the lecture.
 * Supports custom playbackSpeed (e.g. 1.25x, 1.5x, 2x).
 */
export function calculateScheduleBreakInfo(
  durationSeconds: number,
  realElapsedSeconds: number,
  playbackSpeed: number = 1
): BreakInfo {
  const speed = playbackSpeed > 0 ? playbackSpeed : 1
  const activeWallSeconds = Math.round(durationSeconds / speed)

  if (activeWallSeconds < LONG_CLASS_THRESHOLD_SECONDS) {
    return {
      hasBreaks: false,
      isBreakActive: false,
      currentBreakNumber: 0,
      totalBreaks: 0,
      breakRemainingSeconds: 0,
      expectedVideoPosition: Math.max(0, Math.min(realElapsedSeconds, activeWallSeconds)),
      totalScheduledDurationSeconds: activeWallSeconds,
    }
  }

  // Number of breaks: 1 after each 1 hour block, provided at least 15m (900s) remain after it
  const totalBreaks = Math.max(0, Math.floor((activeWallSeconds - 900) / BREAK_INTERVAL_SECONDS))
  const totalScheduledDurationSeconds = activeWallSeconds + totalBreaks * BREAK_DURATION_SECONDS

  if (realElapsedSeconds <= 0) {
    return {
      hasBreaks: true,
      isBreakActive: false,
      currentBreakNumber: 0,
      totalBreaks,
      breakRemainingSeconds: 0,
      expectedVideoPosition: 0,
      totalScheduledDurationSeconds,
    }
  }

  // Iterate through each [Lecture 1h + Break 10m] segment
  for (let k = 0; k < totalBreaks; k++) {
    const lectureStart = k * (BREAK_INTERVAL_SECONDS + BREAK_DURATION_SECONDS)
    const breakStart = lectureStart + BREAK_INTERVAL_SECONDS
    const breakEnd = breakStart + BREAK_DURATION_SECONDS

    if (realElapsedSeconds >= lectureStart && realElapsedSeconds < breakStart) {
      // Actively in lecture block k
      const elapsedActive = k * BREAK_INTERVAL_SECONDS + (realElapsedSeconds - lectureStart)
      return {
        hasBreaks: true,
        isBreakActive: false,
        currentBreakNumber: k,
        totalBreaks,
        breakRemainingSeconds: 0,
        expectedVideoPosition: Math.min(elapsedActive, activeWallSeconds),
        totalScheduledDurationSeconds,
      }
    }

    if (realElapsedSeconds >= breakStart && realElapsedSeconds < breakEnd) {
      // Actively in mandatory break k + 1
      const elapsedActive = (k + 1) * BREAK_INTERVAL_SECONDS
      const breakRemainingSeconds = Math.max(0, Math.ceil(breakEnd - realElapsedSeconds))
      return {
        hasBreaks: true,
        isBreakActive: true,
        currentBreakNumber: k + 1,
        totalBreaks,
        breakRemainingSeconds,
        expectedVideoPosition: elapsedActive,
        totalScheduledDurationSeconds,
      }
    }
  }

  // Past all breaks — in final lecture block
  const finalBlockRealStart = totalBreaks * (BREAK_INTERVAL_SECONDS + BREAK_DURATION_SECONDS)
  const wallOffset = totalBreaks * BREAK_INTERVAL_SECONDS
  const elapsedInFinalBlock = Math.max(0, realElapsedSeconds - finalBlockRealStart)
  const elapsedActive = Math.min(activeWallSeconds, wallOffset + elapsedInFinalBlock)

  return {
    hasBreaks: true,
    isBreakActive: false,
    currentBreakNumber: totalBreaks,
    totalBreaks,
    breakRemainingSeconds: 0,
    expectedVideoPosition: elapsedActive,
    totalScheduledDurationSeconds,
  }
}

/**
 * Returns total scheduled duration in seconds, including any mandatory breaks and factoring in playbackSpeed.
 */
export function getTotalScheduledDuration(durationSeconds: number, playbackSpeed: number = 1): number {
  return calculateScheduleBreakInfo(durationSeconds, 0, playbackSpeed).totalScheduledDurationSeconds
}

// ── Schedule Status Determination ─────────────────────────────────────
// IMPORTANT: This is the SINGLE source of truth for schedule status.
// Uses reliable server-synced time, NOT raw Date.now().
// Formula from PRD Section 6:
//   now < startAt  → upcoming
//   startAt <= now < endAt → live
//   now >= endAt → ended
//   isLocked = false → draft

/**
 * Derives the current status of a schedule based on reliable server time.
 * Accounts for any mandatory breaks in long classes and playback speed.
 * @param schedule - The ScheduledClass document
 * @param reliableNowMs - Reliable server-synced timestamp in ms (from getReliableTime())
 */
export function deriveScheduleStatus(
  schedule: ScheduledClass,
  reliableNowMs: number
): ScheduleStatus {
  if (!schedule.isLocked) return 'draft'

  const startMs = schedule.startAt.toMillis()
  const speed = schedule.playbackSpeed && schedule.playbackSpeed > 0 ? schedule.playbackSpeed : 1
  const totalDurationMs = getTotalScheduledDuration(schedule.durationSeconds, speed) * 1000
  const effectiveEndMs = Math.max(schedule.endAt.toMillis(), startMs + totalDurationMs)

  if (reliableNowMs < startMs) return 'upcoming'
  if (reliableNowMs >= startMs && reliableNowMs < effectiveEndMs) return 'live'
  return 'ended'
}

/**
 * Calculates the expected live video position in seconds within the original video.
 * If schedule.isCustomRange is true:
 *   expectedPosition = rangeStartSeconds + elapsedScheduledSeconds
 * Clamped strictly to [rangeStartSeconds, rangeEndSeconds].
 * During automatic breaks in long classes, holding at the break point is enforced.
 * Factors in schedule.playbackSpeed for accelerated/decelerated playback.
 *
 * @param schedule - The ScheduledClass document
 * @param reliableNowMs - Reliable server-synced timestamp in ms
 * @returns Expected position in seconds within the original video
 */
export function calculateExpectedLivePosition(
  schedule: ScheduledClass,
  reliableNowMs: number
): number {
  const startMs = schedule.startAt.toMillis()
  const elapsed = (reliableNowMs - startMs) / 1000
  const speed = schedule.playbackSpeed && schedule.playbackSpeed > 0 ? schedule.playbackSpeed : 1

  // Calculate elapsed progress through the scheduled lecture block (with breaks handled)
  const breakInfo = calculateScheduleBreakInfo(schedule.durationSeconds, elapsed, speed)
  const videoOffset = breakInfo.expectedVideoPosition * speed

  const rangeStart = schedule.rangeStartSeconds ?? 0
  const rangeEnd = schedule.rangeEndSeconds ?? (rangeStart + schedule.durationSeconds)

  return Math.min(rangeStart + videoOffset, rangeEnd)
}

/**
 * Parses time strings like "01:20:00", "1:20:00", "20:00", or "120" to total seconds.
 */
export function parseTimestampStringToSeconds(input: string): number {
  if (!input) return 0
  const clean = input.trim()
  const parts = clean.split(':').map((p) => parseInt(p, 10))
  if (parts.some((p) => isNaN(p) || p < 0)) return 0

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1]
  }
  if (parts.length === 1) {
    return parts[0]
  }
  return 0
}

/**
 * Formats seconds to "HH:MM:SS" or "MM:SS" timestamp string for inputs.
 */
export function formatSecondsToTimestampString(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Calculates ms until class starts (negative if already started).
 */
export function getCountdownMs(schedule: ScheduledClass, reliableNowMs: number): number {
  return schedule.startAt.toMillis() - reliableNowMs
}

/**
 * Checks whether a locked lecture's recorded access should be blocked right now.
 * Recorded access is blocked when: schedule is locked AND class hasn't ended yet.
 */
export function isRecordedAccessBlocked(
  schedule: ScheduledClass,
  reliableNowMs: number
): boolean {
  if (!schedule.isLocked) return false
  return reliableNowMs < schedule.endAt.toMillis()
}

/**
 * Builds a complete ScheduleDisplayInfo object for a given schedule.
 */
export function buildScheduleDisplayInfo(
  schedule: ScheduledClass,
  reliableNowMs: number
): ScheduleDisplayInfo {
  const status = deriveScheduleStatus(schedule, reliableNowMs)
  const countdownMs = getCountdownMs(schedule, reliableNowMs)
  const livePositionSeconds =
    status === 'live' ? calculateExpectedLivePosition(schedule, reliableNowMs) : 0
  const isBlocked = isRecordedAccessBlocked(schedule, reliableNowMs)
  const breakInfo = calculateScheduleBreakInfo(
    schedule.durationSeconds,
    status === 'live' ? Math.max(0, (reliableNowMs - schedule.startAt.toMillis()) / 1000) : 0,
    schedule.playbackSpeed ?? 1
  )

  return {
    schedule,
    status,
    countdownMs,
    livePositionSeconds,
    isRecordedAccessBlocked: isBlocked,
    breakInfo,
  }
}

// ── Date / Time Helpers (Asia/Dhaka) ─────────────────────────────────

const DHAKA_TZ = 'Asia/Dhaka'
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000 // UTC+6 in ms (fallback)

/**
 * Converts a 'YYYY-MM-DD' date string and 'HH:MM' time string
 * in Asia/Dhaka timezone to a UTC Firestore Timestamp.
 *
 * Example:
 *   scheduledDateToTimestamp('2026-11-05', '18:00')
 *   → Timestamp at 2026-11-05T12:00:00Z  (18:00 BDT = 12:00 UTC)
 */
export function scheduledDateTimeToTimestamp(date: string, time: string): Timestamp {
  // Parse the date and time in Asia/Dhaka
  // JavaScript does not have a direct "parse in timezone" constructor,
  // but we can use the Intl approach with a local-time string + UTC+6 offset.
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  // Try using Intl to compute the UTC equivalent
  // Approach: construct the date as if it's UTC, then subtract the Dhaka offset
  // This works correctly for UTC+6 (no DST in Bangladesh)
  const localMs =
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) - DHAKA_OFFSET_MS

  return Timestamp.fromMillis(localMs)
}

/**
 * Formats a Firestore Timestamp for display in Asia/Dhaka timezone.
 * Returns a human-readable date string like "5 November 2026"
 */
export function formatScheduleDate(ts: Timestamp): string {
  const date = ts.toDate()
  return date.toLocaleDateString('en-BD', {
    timeZone: DHAKA_TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formats a Firestore Timestamp for time display in Asia/Dhaka timezone.
 * Returns "6:00 PM" style string.
 */
export function formatScheduleTime(ts: Timestamp): string {
  const date = ts.toDate()
  return date.toLocaleTimeString('en-BD', {
    timeZone: DHAKA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Formats a date range for a schedule: "6:00 PM – 7:30 PM"
 */
export function formatScheduleTimeRange(startAt: Timestamp, endAt: Timestamp): string {
  return `${formatScheduleTime(startAt)} – ${formatScheduleTime(endAt)}`
}

/**
 * Formats a countdown duration into a human-readable string.
 *
 * Rules:
 *  - 24h+  : Day + Hour (e.g. "11d 16h", "2d 4h", "1d")
 *  - < 24h : Hour + Minute (e.g. "5h 20m", "1h 45m")
 *  - < 1h  : Minute + Second (e.g. "45m 30s", "45s")
 *  - <= 0  : "Now"
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now'
  const totalSec = Math.ceil(ms / 1000)

  // 24h or more -> Day + Hour
  if (totalSec >= 86400) {
    const d = Math.floor(totalSec / 86400)
    const h = Math.floor((totalSec % 86400) / 3600)
    return h > 0 ? `${d}d ${h}h` : `${d}d`
  }

  // Less than 24h, but 1h or more -> Hour + Minute
  if (totalSec >= 3600) {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    return `${h}h ${m}m`
  }

  // Less than 1h -> Minute + Second
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/**
 * Formats "behind live" duration: "10m behind"
 */
export function formatBehindLive(seconds: number): string {
  if (seconds <= 0) return 'LIVE'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m > 0) return `${m}m ${s}s behind`
  return `${s}s behind`
}

/**
 * Formats duration in seconds to HH:MM:SS or MM:SS
 */
export function formatLiveDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Conflict Detection ─────────────────────────────────────────────────

/**
 * Checks if two time ranges overlap.
 * Returns true if they overlap (conflict), false if they don't.
 */
export function doTimesOverlap(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart
}

/**
 * Checks if the proposed schedule conflicts with any existing locked schedules.
 * Used during validation before executing LOCK ROUTINE.
 *
 * Returns a list of conflicts (empty array = no conflicts, safe to lock).
 */
export function detectScheduleConflicts(
  proposedStartMs: number,
  proposedEndMs: number,
  proposedLectureId: string,
  existingSchedules: ScheduledClass[]
): Array<{ scheduleId: string; title: string; type: 'duplicate_lecture' | 'time_overlap' }> {
  const conflicts: Array<{ scheduleId: string; title: string; type: 'duplicate_lecture' | 'time_overlap' }> = []

  for (const existing of existingSchedules) {
    // Only check against LOCKED schedules that are upcoming or live (not ended)
    if (!existing.isLocked) continue
    const existingEndMs = existing.endAt.toMillis()
    // Skip already-ended schedules — they no longer block
    if (existingEndMs <= Date.now()) continue

    const existingStartMs = existing.startAt.toMillis()

    // 1. Duplicate lecture check: same lecture can't have two active schedules
    if (existing.lectureId === proposedLectureId) {
      conflicts.push({
        scheduleId: existing.id,
        title: existing.title,
        type: 'duplicate_lecture',
      })
      continue
    }

    // 2. Time overlap check
    if (doTimesOverlap(proposedStartMs, proposedEndMs, existingStartMs, existingEndMs)) {
      conflicts.push({
        scheduleId: existing.id,
        title: existing.title,
        type: 'time_overlap',
      })
    }
  }

  return conflicts
}

// ── Date Key ──────────────────────────────────────────────────────────

/**
 * Returns the 'YYYY-MM-DD' date key for a timestamp in Asia/Dhaka timezone.
 * Used for attendance dateKey field.
 */
export function getScheduleDateKey(ts: Timestamp): string {
  const date = ts.toDate()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

