/**
 * attendance.service.ts
 *
 * Handles attendance tracking for Scheduled Live Classes.
 *
 * Path: users/{userId}/scheduledClasses/{scheduleId}/attendance/{sessionInstanceId}
 *
 * Key design principles:
 * 1. IDEMPOTENT: sessionInstanceId prevents duplicate records on page refresh/rejoin.
 *    Each browser session gets a unique ID (crypto.randomUUID()), and that ID
 *    is the Firestore document ID. Upsert (setDoc with merge) is used everywhere.
 * 2. ACCURATE: Only PLAYING state counts as active study time.
 *    Pause, buffering, and idle time are tracked separately.
 * 3. NON-BLOCKING: Attendance writes are best-effort — failures are logged but
 *    never crash the live player.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'
import type { AttendanceRecord, AttendanceUpdateInput, ScheduleAttendanceSummary } from '@/types/schedule.types'
import { getScheduleDateKey } from '@/utils/schedule.utils'
import { upsertActiveSession } from './sessions.service'

// ── Path Helpers ──────────────────────────────────────────────────────

const attendanceDoc = (uid: string, scheduleId: string, sessionInstanceId: string) =>
  doc(db, USERS_COL, uid, SUB.SCHEDULED_CLASSES, scheduleId, SUB.ATTENDANCE, sessionInstanceId)

// ── Initialise Attendance Record ──────────────────────────────────────

/**
 * Creates or retrieves an attendance record for this browser session.
 * If the user rejoins the same session (same sessionInstanceId), the existing
 * record is returned without creating a duplicate.
 *
 * @param userId
 * @param scheduleId
 * @param sessionInstanceId - crypto.randomUUID() generated when live player mounts
 * @param schedule - Basic schedule data needed for the record
 */
export async function initAttendanceRecord(
  userId: string,
  scheduleId: string,
  sessionInstanceId: string,
  schedule: {
    lectureId: string
    durationSeconds: number
    startAt: Timestamp
  },
  reliableNowMs: number
): Promise<void> {
  const ref = attendanceDoc(userId, scheduleId, sessionInstanceId)
  const existing = await getDoc(ref)

  if (existing.exists()) {
    // Already initialised for this session — update lastSeenAt only
    await setDoc(ref, { lastSeenAt: Timestamp.fromMillis(reliableNowMs) }, { merge: true })
    return
  }

  // First join for this session
  const joinedAt = Timestamp.fromMillis(reliableNowMs)
  const startMs = schedule.startAt.toMillis()
  const lateJoinSeconds = Math.max(0, Math.round((reliableNowMs - startMs) / 1000))

  const record: Omit<AttendanceRecord, 'id'> = {
    scheduleId,
    lectureId: schedule.lectureId,
    sessionInstanceId,
    joinedAt,
    lastSeenAt: joinedAt,
    scheduledDurationSeconds: schedule.durationSeconds,
    totalActivePlaybackSeconds: 0,
    totalPauseDurationSeconds: 0,
    totalBufferingSeconds: 0,
    lateJoinSeconds,
    liveFollowingTimeSeconds: 0,
    delayedViewingTimeSeconds: 0,
    attendancePercentage: 0,
    isComplete: false,
    dateKey: getScheduleDateKey(schedule.startAt),
    createdAt: Timestamp.fromMillis(reliableNowMs),
    updatedAt: Timestamp.fromMillis(reliableNowMs),
  }

  await setDoc(ref, record)
}

// ── Update Attendance ──────────────────────────────────────────────────

/**
 * Upserts attendance data for this session.
 * Called periodically (every 30s) and on key events (pause, LIVE button, class end).
 *
 * Uses setDoc with merge: true so missing fields don't wipe existing data.
 */
export async function updateAttendance(
  userId: string,
  scheduleId: string,
  sessionInstanceId: string,
  updates: AttendanceUpdateInput
): Promise<void> {
  try {
    const ref = attendanceDoc(userId, scheduleId, sessionInstanceId)

    // Compute attendance percentage if we have the data
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updatedAt: serverTimestamp(),
    }

    if (
      updates.totalActivePlaybackSeconds !== undefined &&
      updates.scheduledDurationSeconds !== undefined &&
      updates.scheduledDurationSeconds > 0
    ) {
      updatePayload.attendancePercentage = Math.round(
        (updates.totalActivePlaybackSeconds / updates.scheduledDurationSeconds) * 100
      )
    }

    await setDoc(ref, updatePayload, { merge: true })
  } catch (err) {
    // Non-fatal: live player must not crash on attendance write failures
    console.warn('[attendance.service] Failed to update attendance:', err)
  }
}

// ── Finalise Attendance ────────────────────────────────────────────────

/**
 * Called when class ends (now >= endAt).
 * Marks the attendance record as complete and integrates with the Study Session system.
 *
 * Integration with sessions.service:
 * - Creates a studySession entry so the Live class contributes to daily goals & streaks.
 * - Uses totalActivePlaybackSeconds as the session duration.
 */
export async function finaliseAttendance(
  userId: string,
  scheduleId: string,
  sessionInstanceId: string,
  finalData: {
    totalActivePlaybackSeconds: number
    totalPauseDurationSeconds: number
    totalBufferingSeconds: number
    liveFollowingTimeSeconds: number
    delayedViewingTimeSeconds: number
    scheduledDurationSeconds: number
    joinedAt: Timestamp | null
    subjectId: string
    chapterId: string
    subjectName: string
    lectureId: string
    scheduleStartAt: Timestamp
  }
): Promise<void> {
  const attendancePercentage =
    finalData.scheduledDurationSeconds > 0
      ? Math.round(
          (finalData.totalActivePlaybackSeconds / finalData.scheduledDurationSeconds) * 100
        )
      : 0

  await updateAttendance(userId, scheduleId, sessionInstanceId, {
    ...finalData,
    attendancePercentage,
    isComplete: true,
    lastSeenAt: serverTimestamp() as unknown as Timestamp,
  })

  // Integrate with Study Sessions for Daily Goals & Streaks
  // Only create session if there was meaningful playback (> 10 seconds)
  const effectiveJoinedAt = finalData.joinedAt || finalData.scheduleStartAt
  if (finalData.totalActivePlaybackSeconds > 10 && effectiveJoinedAt) {
    const startedAt = effectiveJoinedAt.toDate()
    const endedAt = new Date(
      startedAt.getTime() + finalData.totalActivePlaybackSeconds * 1000
    )

    await upsertActiveSession(userId, sessionInstanceId, {
      lectureId: finalData.lectureId,
      subjectId: finalData.subjectId,
      chapterId: finalData.chapterId,
      subjectName: finalData.subjectName,
      startedAt,
      endedAt,
      duration: finalData.totalActivePlaybackSeconds,
      isLive: true,
    }).catch((err) => {
      console.warn('[attendance.service] Failed to upsert study session:', err)
    })
  }
}

// ── Batch Attendance Query for Ended Schedules ─────────────────────────

/**
 * Fetches attendance records for multiple schedules of a user.
 * Sums playback across sessions if the user joined multiple times.
 * Classifies into 'complete' (>=80%), 'partial' (<80% and >10s), or 'not_attended'.
 * Accurately calculates attendance percentage against true scheduled class duration
 * (accounting for playbackSpeed and startAt/endAt).
 */
export async function getAttendanceForSchedules(
  userId: string,
  schedules: Array<{
    id: string
    durationSeconds: number
    playbackSpeed?: number
    startAt?: Timestamp
    endAt?: Timestamp
  }>
): Promise<Record<string, ScheduleAttendanceSummary>> {
  const result: Record<string, ScheduleAttendanceSummary> = {}
  if (!userId || schedules.length === 0) return result

  try {
    const fetchPromises = schedules.map(async (s) => {
      // True scheduled duration of the class in wall-clock seconds
      const classDurationSec = s.endAt && s.startAt
        ? Math.max(1, Math.round((s.endAt.toMillis() - s.startAt.toMillis()) / 1000))
        : s.playbackSpeed && s.playbackSpeed > 0
        ? Math.max(1, Math.round(s.durationSeconds / s.playbackSpeed))
        : Math.max(1, s.durationSeconds)

      try {
        const attendanceColRef = collection(
          db,
          USERS_COL,
          userId,
          SUB.SCHEDULED_CLASSES,
          s.id,
          SUB.ATTENDANCE
        )
        const snap = await getDocs(attendanceColRef)
        if (snap.empty) {
          result[s.id] = {
            scheduleId: s.id,
            totalPlaybackSeconds: 0,
            scheduledDurationSeconds: classDurationSec,
            attendancePercentage: 0,
            status: 'not_attended',
          }
          return
        }

        let totalActive = 0
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Partial<AttendanceRecord>
          const active = data.totalActivePlaybackSeconds ?? 0
          totalActive += active
        })

        // Compute percentage directly from genuine active playback vs real class duration
        const computedPercentage = Math.min(
          100,
          Math.max(0, Math.round((totalActive / classDurationSec) * 100))
        )

        // Threshold: >= 80% is Complete
        let status: 'complete' | 'partial' | 'not_attended' = 'not_attended'
        if (computedPercentage >= 80) {
          status = 'complete'
        } else if (computedPercentage > 0 && totalActive >= 15) {
          status = 'partial'
        } else {
          status = 'not_attended'
        }

        result[s.id] = {
          scheduleId: s.id,
          totalPlaybackSeconds: totalActive,
          scheduledDurationSeconds: classDurationSec,
          attendancePercentage: computedPercentage,
          status,
        }
      } catch (err) {
        console.warn(`[attendance.service] Failed to fetch attendance for schedule ${s.id}:`, err)
        result[s.id] = {
          scheduleId: s.id,
          totalPlaybackSeconds: 0,
          scheduledDurationSeconds: classDurationSec,
          attendancePercentage: 0,
          status: 'not_attended',
        }
      }
    })

    await Promise.all(fetchPromises)
  } catch (err) {
    console.warn('[attendance.service] getAttendanceForSchedules error:', err)
  }

  return result
}

