/**
 * schedule.types.ts
 *
 * All TypeScript interfaces for the Scheduled Live Learning System.
 * These types cover:
 *   - ScheduledClass (the immutable schedule document)
 *   - Schedule Lifecycle status
 *   - Live Playback State
 *   - Attendance tracking
 *   - Input types for creation
 *
 * Firestore Path:
 *   users/{userId}/scheduledClasses/{scheduleId}
 *   users/{userId}/scheduledClasses/{scheduleId}/attendance/{sessionId}
 */

import { Timestamp } from 'firebase/firestore'

// ── Schedule Lifecycle Status ──────────────────────────────────────────
// Derived from time comparison — never stored as the source of truth.
// Formula:
//   now < startAt  → UPCOMING
//   startAt <= now < endAt → LIVE
//   now >= endAt   → ENDED
// DRAFT is only a UI state, not stored in Firestore as final.
export type ScheduleStatus = 'draft' | 'upcoming' | 'live' | 'ended'

// ── Long Class Mandatory Break Info ───────────────────────────────────
// For classes around 3h+ (>= 2h 30m), mandatory 10-min breaks occur every 1 hour.
export interface BreakInfo {
  hasBreaks: boolean
  isBreakActive: boolean
  currentBreakNumber: number
  totalBreaks: number
  breakRemainingSeconds: number
  expectedVideoPosition: number
  totalScheduledDurationSeconds: number
}

// ── Live Playback Synchronization Mode ────────────────────────────────
// FOLLOWING_LIVE: user is watching at/near the real-time live position
// DELAYED: user has paused and fallen behind the live timeline
export type SyncMode = 'FOLLOWING_LIVE' | 'DELAYED'

// ── YouTube Player State (mirrors YouTube IFrame API states) ──────────
export type LivePlayerState = 'LOADING' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ENDED' | 'ERROR'

// ── Access Mode for a lecture ──────────────────────────────────────────
// RECORDED: normal access (default)
// LOCKED: blocked due to active schedule — cannot be watched in recorded mode
// UNLOCKED_POST_CLASS: was locked, class has ended, recorded access restored
export type LectureAccessMode = 'recorded' | 'locked' | 'unlocked_post_class'

// ── Scheduled Class Document ───────────────────────────────────────────
// This document is IMMUTABLE once isLocked = true.
// Never modify startAt, endAt, lectureId, or youtubeVideoId after locking.
export interface ScheduledClass {
  id: string                      // Firestore document ID (auto-generated)
  lectureId: string               // Reference to users/{userId}/lectures/{lectureId}
  title: string                   // Snapshot: lecture title at time of scheduling
  subjectId: string               // Reference to subject
  subjectName: string             // Snapshot: subject name at time of scheduling
  chapterId: string               // Reference to chapter
  chapterName: string             // Snapshot: chapter name at time of scheduling
  youtubeVideoId: string          // Scheduled video reference (snapshot, immutable)
  thumbnailUrl: string            // YouTube thumbnail URL
  durationSeconds: number         // Scheduled duration in seconds (immutable)
  durationFormatted: string       // Human-readable e.g. "1:30:00"

  // ── Custom Timestamp Range (Optional) ──────────────────────────────
  // If isCustomRange = true, live playback is restricted to [rangeStartSeconds, rangeEndSeconds].
  // Full lecture is unlocked after class ends.
  isCustomRange?: boolean
  rangeStartSeconds?: number      // Starting second in original video (default: 0)
  rangeEndSeconds?: number        // Ending second in original video (default: durationSeconds)
  originalVideoDuration?: number  // Original full lecture duration in seconds

  // ── Schedule Timing (all UTC, immutable after lock) ─────────────────
  startAt: Timestamp              // Scheduled start (Asia/Dhaka → UTC stored)
  endAt: Timestamp                // Calculated: startAt + durationSeconds (immutable)
  timezone: 'Asia/Dhaka'         // Fixed timezone for display

  // ── Lock State ───────────────────────────────────────────────────────
  isLocked: boolean               // false = draft, true = locked (immutable after true)
  lockedAt: Timestamp | null      // When LOCK ROUTINE was executed
  lockVersion: number             // Schema version for future migrations (start at 1)

  // ── Document Timestamps ──────────────────────────────────────────────
  createdAt: Timestamp
  updatedAt: Timestamp            // Only changes in draft state
}

// ── Draft Input: fields needed to create a new draft schedule ─────────
export interface ScheduledClassDraftInput {
  lectureId: string
  title: string
  subjectId: string
  subjectName: string
  chapterId: string
  chapterName: string
  youtubeVideoId: string
  thumbnailUrl: string
  durationSeconds: number
  durationFormatted: string
  scheduledDate: string           // 'YYYY-MM-DD' in Asia/Dhaka timezone
  scheduledStartTime: string      // 'HH:MM' in 24-hour format, Asia/Dhaka timezone
  // Custom range support
  isCustomRange?: boolean
  rangeStartSeconds?: number
  rangeEndSeconds?: number
  originalVideoDuration?: number
}

// ── Derived Schedule Info (computed client-side) ───────────────────────
// Used by UI components; never persisted separately.
export interface ScheduleDisplayInfo {
  schedule: ScheduledClass
  status: ScheduleStatus          // Computed from reliable time
  countdownMs: number             // ms until startAt (negative if started)
  livePositionSeconds: number     // Expected video position right now (0 if not live)
  isRecordedAccessBlocked: boolean// True when live class hasn't ended yet
  breakInfo?: BreakInfo           // Mandatory break info for classes ~3h+
}

// ── Live Playback Session State ────────────────────────────────────────
// This is LOCAL / SESSION state only — not persisted in Firestore.
// Stored in React component state / refs during a live session.
export interface LivePlaybackState {
  syncMode: SyncMode
  playerState: LivePlayerState
  // Current video position at last observed moment (seconds)
  lastObservedPositionSeconds: number
  lastObservedAt: number          // Date.now() ms when above was recorded
  // Behind-live tracking
  behindLiveSeconds: number       // How far behind live (0 if FOLLOWING_LIVE)
  // Session tracking
  joinedAt: number | null         // Date.now() ms when user joined live
  sessionInstanceId: string       // Unique ID per browser session to prevent duplicate attendance
}

// ── Attendance Record ──────────────────────────────────────────────────
// Persisted in: users/{userId}/scheduledClasses/{scheduleId}/attendance/{sessionId}
// Idempotent: sessionInstanceId prevents duplicate records on refresh/rejoin
export interface AttendanceRecord {
  id: string                      // Firestore doc ID = sessionInstanceId
  scheduleId: string
  lectureId: string
  sessionInstanceId: string       // crypto.randomUUID() per browser session
  // Timing
  joinedAt: Timestamp | null      // First time user opened the live player
  lastSeenAt: Timestamp | null    // Last heartbeat / leave event
  scheduledDurationSeconds: number// From schedule.durationSeconds
  // Measured activity (seconds)
  totalActivePlaybackSeconds: number   // Only PLAYING state counts
  totalPauseDurationSeconds: number
  totalBufferingSeconds: number
  lateJoinSeconds: number         // (joinedAt - startAt) in seconds, 0 if joined on time
  liveFollowingTimeSeconds: number // Time spent in FOLLOWING_LIVE mode
  delayedViewingTimeSeconds: number// Time spent in DELAYED mode
  // Computed
  attendancePercentage: number    // totalActivePlayback / scheduledDuration * 100
  // Status
  isComplete: boolean             // Did the session survive until class end?
  dateKey: string                 // 'YYYY-MM-DD' for analytics
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── Attendance Upsert Input ────────────────────────────────────────────
export type AttendanceUpdateInput = Partial<Omit<AttendanceRecord, 'id' | 'scheduleId' | 'lectureId' | 'sessionInstanceId' | 'createdAt'>>

// ── Schedule Conflict Check ────────────────────────────────────────────
// Used during validation before locking to ensure no overlapping schedules
export interface ScheduleConflict {
  conflictingScheduleId: string
  conflictingTitle: string
  conflictingStartAt: Timestamp
  conflictingEndAt: Timestamp
  type: 'duplicate_lecture' | 'time_overlap'
}

// ── Server Time Response ───────────────────────────────────────────────
// Returned by /.netlify/functions/server-time
export interface ServerTimeResponse {
  serverTime: number              // Unix ms (Date.now() on server)
  timezone: string                // 'Asia/Dhaka'
}

// ── Clock Sync State ──────────────────────────────────────────────────
// Maintained by serverTime.service.ts
export interface ClockSyncState {
  offsetMs: number                // serverTime - localTime (add to Date.now() for reliable time)
  lastSyncedAt: number            // Date.now() when last sync happened
  roundTripTimeMs: number         // Network RTT for confidence metric
  isSynced: boolean               // Has at least one successful sync happened?
}

