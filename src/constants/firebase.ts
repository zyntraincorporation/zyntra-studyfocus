// All subcollection names under users/{userId}
export const SUB = {
  SUBJECTS: 'subjects',
  CHAPTERS: 'chapters',
  LECTURES: 'lectures',
  PROGRESS: 'progress',
  NOTES: 'notes',
  BOOKMARKS: 'bookmarks',
  STUDY_SESSIONS: 'studySessions',
  SETTINGS: 'settings',
  STUDY_PLANS: 'studyPlans',
  TRASH: 'trash',
  STUDY_MATERIALS: 'studyMaterials',
  STUDY_MATERIAL_PROGRESS: 'studyMaterialProgress',
  STUDY_MATERIAL_DAILY: 'studyMaterialDaily',
  // ── Live Learning System ───────────────────────────────────────────────
  SCHEDULED_CLASSES: 'scheduledClasses',   // users/{uid}/scheduledClasses/{scheduleId}
  ATTENDANCE: 'attendance',                 // .../{scheduleId}/attendance/{sessionId}
  DAILY_TASKS: 'dailyTasks',               // users/{uid}/dailyTasks/{dateKey}
} as const

// Top-level collection
export const USERS_COL = 'users'

// Settings document ID
export const SETTINGS_DOC = 'preferences'

// Completion threshold — lecture is "done" at 90%
export const COMPLETION_THRESHOLD = 0.9

// Progress save interval (ms) — 15 seconds
export const PROGRESS_SAVE_INTERVAL = 15_000

// Session idle timeout — stop session after 5 min of no activity
export const SESSION_IDLE_TIMEOUT = 5 * 60 * 1000

// Show resume dialog if saved position > this many seconds
export const RESUME_THRESHOLD = 30

// Playback speed options (YouTube IFrame API supported values, max 2x)
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const

// Default seek/skip interval in seconds
export const DEFAULT_SEEK_INTERVAL = 10

// Maximum attachments per lecture
export const MAX_ATTACHMENTS = 5

// ── Live Learning System Constants ────────────────────────────────────────
// How far behind live (seconds) before DELAYED mode is shown to user
export const LIVE_DELAYED_THRESHOLD_SECONDS = 5

// Maximum allowable drift (seconds) before a controlled re-seek happens in FOLLOWING_LIVE mode
export const LIVE_DRIFT_TOLERANCE_SECONDS = 3

// How often (ms) the live sync loop checks position (NOT a Firestore call)
export const LIVE_SYNC_INTERVAL_MS = 2_000

// How often (ms) the server clock is re-synced (on visibility change or periodically)
export const CLOCK_RESYNC_INTERVAL_MS = 5 * 60 * 1000   // 5 minutes

// Attendance heartbeat interval (ms) — how often attendance state is saved to Firestore
export const ATTENDANCE_SAVE_INTERVAL_MS = 30_000         // 30 seconds

// ── Waiting Room: how many ms before startAt to show the Waiting Room ──
export const WAITING_ROOM_THRESHOLD_MS = 30 * 60 * 1000  // 30 minutes before class

// Default user preferences
export const DEFAULT_PREFS = {
  dailyGoalMinutes: 60,
  preferredSpeed: 1,
  autoResume: true,
  breakReminderMinutes: 50,
  pomodoroStudyMinutes: 50,
  pomodoroBreakMinutes: 10,
  reducedMotion: false,
  focusModeDefault: false,
  streakMinimumMinutes: 10,
  theme: 'dark' as const,
  seekInterval: DEFAULT_SEEK_INTERVAL as 5 | 10,
  showClock: true,
}

// Legacy export aliases (keep for backward compat with notes/bookmarks/sessions services)
export const COLLECTIONS = { USERS: 'users' } as const
export const SUBCOLLECTIONS = SUB
