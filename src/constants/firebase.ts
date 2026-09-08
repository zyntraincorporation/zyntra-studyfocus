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
