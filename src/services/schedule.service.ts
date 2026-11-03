/**
 * schedule.service.ts
 *
 * All Firestore operations for the Scheduled Live Learning System.
 * Every function takes userId as the first parameter.
 *
 * Path structure:
 *   users/{userId}/scheduledClasses/{scheduleId}
 *   users/{userId}/scheduledClasses/{scheduleId}/attendance/{sessionId}
 *
 * CRITICAL DESIGN RULES:
 * 1. Schedule Lock is PERMANENT — once isLocked = true, startAt/endAt/lectureId never change.
 * 2. Lecture access lock (lockedScheduleId, lockedUntil) is set on the lecture doc during
 *    LOCK ROUTINE and cleared automatically after endAt (no background job needed —
 *    the check is time-based at read time).
 * 3. No direct Date.now() calls for schedule logic — use getReliableTime() from serverTime.service.
 * 4. All writes that affect both schedule + lecture must be atomic (writeBatch).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp,
  runTransaction,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'
import type {
  ScheduledClass,
  ScheduledClassDraftInput,
  ScheduleStatus,
} from '@/types/schedule.types'
import {
  scheduledDateTimeToTimestamp,
  detectScheduleConflicts,
  getScheduleDateKey,
  getTotalScheduledDuration,
} from '@/utils/schedule.utils'

// ── Path Helpers ──────────────────────────────────────────────────────

const schedulesCol = (uid: string) =>
  collection(db, USERS_COL, uid, SUB.SCHEDULED_CLASSES)

const scheduleDoc = (uid: string, scheduleId: string) =>
  doc(db, USERS_COL, uid, SUB.SCHEDULED_CLASSES, scheduleId)

const lectureDoc = (uid: string, lectureId: string) =>
  doc(db, USERS_COL, uid, SUB.LECTURES, lectureId)

// ── Read Operations ───────────────────────────────────────────────────

/**
 * Fetches a single scheduled class by ID.
 */
export async function getScheduledClass(
  userId: string,
  scheduleId: string
): Promise<ScheduledClass | null> {
  const snap = await getDoc(scheduleDoc(userId, scheduleId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ScheduledClass) : null
}

/**
 * Fetches ALL locked schedules for the user, ordered by startAt.
 * Used for timetable page and conflict checking.
 */
export async function getLockedSchedules(userId: string): Promise<ScheduledClass[]> {
  const q = query(
    schedulesCol(userId),
    where('isLocked', '==', true),
    orderBy('startAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduledClass))
}

/**
 * Fetches upcoming and live schedules (locked, endAt > now).
 * Used for dashboard "Upcoming Classes" section.
 * Note: Firestore does not support `endAt > now` directly with orderBy startAt
 * without a composite index. We fetch upcoming locked ones and filter client-side.
 */
export async function getUpcomingSchedules(
  userId: string,
  reliableNowMs: number,
  maxCount: number = 10
): Promise<ScheduledClass[]> {
  try {
    const locked = await getLockedSchedules(userId)
    return locked
      .filter((s) => s.endAt && s.endAt.toMillis() > reliableNowMs)
      .slice(0, maxCount)
  } catch (err) {
    console.warn('[schedule.service] getUpcomingSchedules fallback error:', err)
    return []
  }
}

/**
 * Fetches ended schedules for history page.
 */
export async function getEndedSchedules(
  userId: string,
  reliableNowMs: number,
  maxCount: number = 50
): Promise<ScheduledClass[]> {
  try {
    const locked = await getLockedSchedules(userId)
    return locked
      .filter((s) => s.endAt && s.endAt.toMillis() <= reliableNowMs)
      .sort((a, b) => b.endAt.toMillis() - a.endAt.toMillis())
      .slice(0, maxCount)
  } catch (err) {
    console.warn('[schedule.service] getEndedSchedules fallback error:', err)
    return []
  }
}

/**
 * Fetches all DRAFT (not yet locked) schedules for the current user.
 * Used in ScheduleBuilderPage to list pending drafts.
 */
export async function getDraftSchedules(userId: string): Promise<ScheduledClass[]> {
  const q = query(
    schedulesCol(userId),
    where('isLocked', '==', false),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduledClass))
}

// ── Create Draft ──────────────────────────────────────────────────────

/**
 * Creates a new DRAFT schedule document.
 * No lecture is locked at this stage.
 * Returns the new scheduleId.
 */
export async function createDraftSchedule(
  userId: string,
  input: ScheduledClassDraftInput
): Promise<string> {
  const startAt = scheduledDateTimeToTimestamp(input.scheduledDate, input.scheduledStartTime)
  const totalDurationSecs = getTotalScheduledDuration(input.durationSeconds)
  const endAt = Timestamp.fromMillis(startAt.toMillis() + totalDurationSecs * 1000)

  const ref = await addDoc(schedulesCol(userId), {
    lectureId: input.lectureId,
    title: input.title,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    chapterId: input.chapterId,
    chapterName: input.chapterName,
    youtubeVideoId: input.youtubeVideoId,
    thumbnailUrl: input.thumbnailUrl,
    durationSeconds: input.durationSeconds,
    durationFormatted: input.durationFormatted,
    isCustomRange: input.isCustomRange ?? false,
    rangeStartSeconds: input.rangeStartSeconds ?? 0,
    rangeEndSeconds: input.rangeEndSeconds ?? input.durationSeconds,
    originalVideoDuration: input.originalVideoDuration ?? input.durationSeconds,
    startAt,
    endAt,
    timezone: 'Asia/Dhaka',
    isLocked: false,
    lockedAt: null,
    lockVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

/**
 * Updates a DRAFT schedule (only allowed before locking).
 * Throws if schedule is already locked.
 */
export async function updateDraftSchedule(
  userId: string,
  scheduleId: string,
  input: Partial<ScheduledClassDraftInput>
): Promise<void> {
  // Safety check: never update a locked schedule
  const existing = await getScheduledClass(userId, scheduleId)
  if (!existing) throw new Error('Schedule not found.')
  if (existing.isLocked) throw new Error('Cannot modify a locked schedule.')

  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() }

  if (input.scheduledDate && input.scheduledStartTime) {
    const durationSecs = input.durationSeconds ?? existing.durationSeconds
    const totalDurationSecs = getTotalScheduledDuration(durationSecs)
    const startAt = scheduledDateTimeToTimestamp(input.scheduledDate, input.scheduledStartTime)
    const endAt = Timestamp.fromMillis(startAt.toMillis() + totalDurationSecs * 1000)
    updates.startAt = startAt
    updates.endAt = endAt
  }

  if (input.lectureId !== undefined) updates.lectureId = input.lectureId
  if (input.title !== undefined) updates.title = input.title
  if (input.subjectId !== undefined) updates.subjectId = input.subjectId
  if (input.subjectName !== undefined) updates.subjectName = input.subjectName
  if (input.chapterId !== undefined) updates.chapterId = input.chapterId
  if (input.chapterName !== undefined) updates.chapterName = input.chapterName
  if (input.youtubeVideoId !== undefined) updates.youtubeVideoId = input.youtubeVideoId
  if (input.thumbnailUrl !== undefined) updates.thumbnailUrl = input.thumbnailUrl
  if (input.durationSeconds !== undefined) updates.durationSeconds = input.durationSeconds
  if (input.durationFormatted !== undefined) updates.durationFormatted = input.durationFormatted
  if (input.isCustomRange !== undefined) updates.isCustomRange = input.isCustomRange
  if (input.rangeStartSeconds !== undefined) updates.rangeStartSeconds = input.rangeStartSeconds
  if (input.rangeEndSeconds !== undefined) updates.rangeEndSeconds = input.rangeEndSeconds
  if (input.originalVideoDuration !== undefined) updates.originalVideoDuration = input.originalVideoDuration

  await updateDoc(scheduleDoc(userId, scheduleId), updates)
}

/**
 * Deletes a DRAFT schedule (only allowed before locking).
 * Throws if schedule is already locked.
 */
export async function deleteDraftSchedule(
  userId: string,
  scheduleId: string
): Promise<void> {
  const existing = await getScheduledClass(userId, scheduleId)
  if (!existing) throw new Error('Schedule not found.')
  if (existing.isLocked) throw new Error('Cannot delete a locked schedule.')

  await deleteDoc(scheduleDoc(userId, scheduleId))
}

// ── Lock Routine ──────────────────────────────────────────────────────

/**
 * LOCK ROUTINE — the most critical operation in the entire LMS.
 *
 * Atomically:
 *   1. Validates the schedule (not in past, no conflicts, lecture exists)
 *   2. Sets schedule.isLocked = true, schedule.lockedAt = now (PERMANENT)
 *   3. Sets lecture.lockedScheduleId = scheduleId, lecture.lockedUntil = schedule.endAt
 *
 * Once this succeeds, the schedule is IMMUTABLE.
 * The Firestore Security Rules also enforce this server-side.
 *
 * @throws Error with a user-readable message if validation fails.
 */
export async function executeLockRoutine(
  userId: string,
  scheduleId: string,
  reliableNowMs: number
): Promise<void> {
  // Use a Firestore Transaction to read + write atomically
  await runTransaction(db, async (transaction) => {
    // ── 1. Read the schedule document ──────────────────────────────────
    const schedRef = scheduleDoc(userId, scheduleId)
    const schedSnap = await transaction.get(schedRef)

    if (!schedSnap.exists()) {
      throw new Error('Schedule not found. Please refresh and try again.')
    }

    const schedule = { id: schedSnap.id, ...schedSnap.data() } as ScheduledClass

    // ── 2. Validate: Already locked? ───────────────────────────────────
    if (schedule.isLocked) {
      throw new Error('This schedule is already locked.')
    }

    // ── 3. Validate: Not in the past ───────────────────────────────────
    const startMs = schedule.startAt.toMillis()
    if (startMs <= reliableNowMs) {
      throw new Error(
        'Cannot lock a schedule in the past. Please create a new schedule with a future time.'
      )
    }

    // ── 4. Validate: Lecture still exists ─────────────────────────────
    const lectureRef = lectureDoc(userId, schedule.lectureId)
    const lectureSnap = await transaction.get(lectureRef)

    if (!lectureSnap.exists()) {
      throw new Error('The linked lecture no longer exists. Please select another lecture.')
    }

    const lectureData = lectureSnap.data()

    // ── 5. Validate: Lecture not already locked by another schedule ────
    if (lectureData.lockedScheduleId && lectureData.lockedScheduleId !== scheduleId) {
      throw new Error(
        'This lecture already has an active scheduled class. One lecture can only be locked once at a time.'
      )
    }

    // ── 6. Conflict check: Fetch active locked schedules ───────────────
    // We do a client-side conflict check here before writing.
    // The Security Rules further enforce this server-side.
    // NOTE: In a transaction, we can't do collection queries.
    // So conflict checking is done outside the transaction (see lockRoutineWithConflictCheck).
    // This transaction only handles the atomic write.

    // ── 7. Atomic Write: Lock the schedule ────────────────────────────
    const lockedAt = Timestamp.fromMillis(reliableNowMs)

    transaction.update(schedRef, {
      isLocked: true,
      lockedAt,
      updatedAt: serverTimestamp(),
    })

    // ── 8. Atomic Write: Lock the lecture ─────────────────────────────
    // Set the access lock on the lecture document.
    // This does NOT modify any of the lecture's learning content.
    transaction.update(lectureRef, {
      lockedScheduleId: scheduleId,
      lockedUntil: schedule.endAt,
      updatedAt: serverTimestamp(),
    })
  })
}

/**
 * Full LOCK ROUTINE with pre-transaction conflict checking.
 * This is the function that UI should call (not executeLockRoutine directly).
 *
 * Pre-checks (before transaction):
 *   - Schedule is not in the past
 *   - No time overlap with other locked schedules
 *   - No duplicate lecture active schedule
 *
 * Then executes the atomic transaction.
 */
export async function lockSchedule(
  userId: string,
  scheduleId: string,
  reliableNowMs: number
): Promise<void> {
  // Get the draft schedule to check
  const schedule = await getScheduledClass(userId, scheduleId)
  if (!schedule) throw new Error('Schedule not found.')
  if (schedule.isLocked) throw new Error('Schedule is already locked.')

  // Pre-validate: not in the past
  if (schedule.startAt.toMillis() <= reliableNowMs) {
    throw new Error(
      'Cannot lock a schedule that starts in the past. Please update the start time.'
    )
  }

  // Fetch all currently active locked schedules for conflict detection
  const activeSchedules = await getUpcomingSchedules(userId, reliableNowMs, 100)

  const conflicts = detectScheduleConflicts(
    schedule.startAt.toMillis(),
    schedule.endAt.toMillis(),
    schedule.lectureId,
    activeSchedules.filter((s) => s.id !== scheduleId) // Exclude self
  )

  if (conflicts.length > 0) {
    const first = conflicts[0]
    if (first.type === 'duplicate_lecture') {
      throw new Error(
        `This lecture is already scheduled as "${first.title}". A lecture can only be scheduled once at a time.`
      )
    } else {
      throw new Error(
        `Schedule overlaps with "${first.title}". Please choose a different time.`
      )
    }
  }

  // Execute the atomic lock transaction
  await executeLockRoutine(userId, scheduleId, reliableNowMs)
}

// ── Post-Class Cleanup ────────────────────────────────────────────────

/**
 * Clears the lecture lock after a class has ended.
 * Called when the live player detects class has ended (now >= endAt).
 *
 * This is a best-effort call — the app also checks lockedUntil at read time,
 * so even without calling this, the lock becomes ineffective after endAt.
 * However, calling this keeps the lecture data clean.
 *
 * Note: This does NOT modify any learning content (notes, timestamps, slides, progress).
 */
export async function clearLectureLockAfterClass(
  userId: string,
  scheduleId: string,
  lectureId: string
): Promise<void> {
  try {
    const batch = writeBatch(db)

    // Clear lock from lecture document (only if this schedule was the one that locked it)
    const lectureRef = lectureDoc(userId, lectureId)
    const lectureSnap = await getDoc(lectureRef)

    if (lectureSnap.exists() && lectureSnap.data().lockedScheduleId === scheduleId) {
      batch.update(lectureRef, {
        lockedScheduleId: null,
        lockedUntil: null,
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
  } catch (err) {
    // Non-fatal: the time-based check in curriculum.service will still work correctly
    console.warn('[schedule.service] Failed to clear lecture lock after class:', err)
  }
}

// ── Helper: Check if a lecture is currently locked ──────────────────

/**
 * Checks if a lecture is currently in recorded-access-blocked state.
 * Used by WatchPage and chapter lecture lists to gate access.
 *
 * @param lectureData - Raw lecture Firestore data (must have lockedUntil field if locked)
 * @param reliableNowMs - Reliable server-synced time
 * @returns The locking scheduleId if blocked, null if accessible
 */
export function getLectureLockStatus(
  lectureData: { lockedScheduleId?: string | null; lockedUntil?: Timestamp | null },
  reliableNowMs: number
): { isLocked: boolean; scheduleId: string | null } {
  if (!lectureData.lockedScheduleId || !lectureData.lockedUntil) {
    return { isLocked: false, scheduleId: null }
  }

  const unlockAt = lectureData.lockedUntil.toMillis()
  if (reliableNowMs >= unlockAt) {
    // Class has ended — lock is expired (even if DB field is still set)
    return { isLocked: false, scheduleId: null }
  }

  return { isLocked: true, scheduleId: lectureData.lockedScheduleId }
}

