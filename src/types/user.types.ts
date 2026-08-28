import { Timestamp } from 'firebase/firestore'

// V1: No roles. Every authenticated user owns their workspace.
// Theme is locked to dark — no user-facing toggle.
export type Theme = 'dark'

export interface UserDocument {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  createdAt: Timestamp
  lastLoginAt: Timestamp
  // Streak
  streak: number
  longestStreak: number
  lastStreakDate: string   // 'YYYY-MM-DD' in local timezone
  // Preferences (kept on root doc for fast reads)
  dailyGoalMinutes: number
  preferredSpeed: number
  autoResume: boolean
  theme: Theme
  breakReminderMinutes: number
  streakMinimumMinutes: number
  seekInterval: 5 | 10
  showClock?: boolean
}

export interface UserPreferences {
  theme: Theme
  preferredSpeed: number
  dailyGoalMinutes: number
  autoResume: boolean
  breakReminderEnabled: boolean
  breakReminderMinutes: number
  pomodoroStudyMinutes: number
  pomodoroBreakMinutes: number
  reducedMotion: boolean
  focusModeDefault: boolean
  streakMinimumMinutes: number
  seekInterval: 5 | 10
  showClock?: boolean
  updatedAt: Timestamp
}
