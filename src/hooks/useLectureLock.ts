/**
 * useLectureLock.ts
 *
 * Thin hook that checks if a lecture is currently locked for recorded access.
 * Uses reliable server-synced time from useSchedule.
 *
 * Returns:
 *   isLocked    — true if recorded access is currently blocked
 *   scheduleId  — the live schedule that locked it (to redirect user to /live/:scheduleId)
 */

import { useMemo } from 'react'
import type { Lecture } from '@/types/curriculum.types'
import { getLectureLockStatus } from '@/services/schedule.service'

interface UseLectureLockResult {
  isLocked: boolean
  scheduleId: string | null
}

/**
 * Checks whether a lecture is currently locked for recorded access.
 *
 * @param lecture        - The lecture object (may be null while loading)
 * @param reliableNowMs  - Reliable server-synced time in milliseconds
 */
export function useLectureLock(
  lecture: Lecture | null | undefined,
  reliableNowMs: number
): UseLectureLockResult {
  return useMemo(() => {
    if (!lecture) return { isLocked: false, scheduleId: null }
    return getLectureLockStatus(
      {
        lockedScheduleId: lecture.lockedScheduleId ?? null,
        lockedUntil: lecture.lockedUntil ?? null,
      },
      reliableNowMs
    )
  }, [lecture, reliableNowMs])
}

