import type { StudySession } from '@/types/progress.types'
import type { UserDocument } from '@/types/user.types'
import { getLocalDateKey, getYesterdayDateKey, getDateKeyDaysAgo } from './date.utils'
import { updateUserStreak } from '@/services/users.service'

export interface StreakStats {
  currentStreak: number
  longestStreak: number
  isGoalMetToday: boolean
}

/**
 * Calculates current and longest streak based on whether the user reached
 * their daily target (dailyGoalMinutes) on consecutive days.
 */
export function calculateStreak(
  userDoc: UserDocument | null,
  sessions: StudySession[]
): StreakStats {
  const goalMinutes = userDoc?.dailyGoalMinutes ?? 60
  const targetSeconds = goalMinutes * 60

  // Sum study seconds per dateKey
  const secondsPerDay: Record<string, number> = {}
  sessions.forEach((s) => {
    if (s.dateKey && s.duration) {
      secondsPerDay[s.dateKey] = (secondsPerDay[s.dateKey] || 0) + s.duration
    }
  })

  const isGoalMet = (dateKey: string) => (secondsPerDay[dateKey] ?? 0) >= targetSeconds

  const todayKey = getLocalDateKey()
  const yesterdayKey = getYesterdayDateKey()
  const isGoalMetToday = isGoalMet(todayKey)

  // ── Calculate Current Streak ─────────────────────────────────────────
  let currentStreak = 0

  if (isGoalMetToday) {
    // Today is met: count today + consecutive days backwards
    currentStreak = 1
    let daysAgo = 1
    while (true) {
      const key = getDateKeyDaysAgo(daysAgo)
      if (isGoalMet(key)) {
        currentStreak++
        daysAgo++
      } else {
        break
      }
    }
  } else if (isGoalMet(yesterdayKey)) {
    // Today is in progress, but yesterday was met: active streak is alive
    currentStreak = 1
    let daysAgo = 2
    while (true) {
      const key = getDateKeyDaysAgo(daysAgo)
      if (isGoalMet(key)) {
        currentStreak++
        daysAgo++
      } else {
        break
      }
    }
  } else {
    // Yesterday was not met, streak is 0
    currentStreak = 0
  }

  // ── Calculate Longest Streak in recorded history ─────────────────────
  // Sort all unique days where goal was met in chronological order
  const metDays = Object.keys(secondsPerDay)
    .filter((k) => isGoalMet(k))
    .sort()

  let maxStreakInHistory = 0
  let tempStreak = 0
  let prevDate: Date | null = null

  for (const dayKey of metDays) {
    const [y, m, d] = dayKey.split('-').map(Number)
    const curDate = new Date(y, m - 1, d)

    if (prevDate) {
      const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        tempStreak++
      } else if (diffDays > 1) {
        tempStreak = 1
      }
    } else {
      tempStreak = 1
    }

    prevDate = curDate
    maxStreakInHistory = Math.max(maxStreakInHistory, tempStreak)
  }

  const longestStreak = Math.max(
    userDoc?.longestStreak ?? 0,
    maxStreakInHistory,
    currentStreak
  )

  return { currentStreak, longestStreak, isGoalMetToday }
}

/**
 * Calculates streak and persists to Firestore if changed.
 */
export async function syncStreakWithFirestore(
  userId: string,
  userDoc: UserDocument | null,
  sessions: StudySession[]
): Promise<StreakStats> {
  const stats = calculateStreak(userDoc, sessions)

  if (
    userDoc &&
    (stats.currentStreak !== userDoc.streak || stats.longestStreak !== userDoc.longestStreak)
  ) {
    const todayKey = getLocalDateKey()
    try {
      await updateUserStreak(userId, stats.currentStreak, stats.longestStreak, todayKey)
    } catch (err) {
      console.error('Failed to sync user streak to Firestore:', err)
    }
  }

  return stats
}
