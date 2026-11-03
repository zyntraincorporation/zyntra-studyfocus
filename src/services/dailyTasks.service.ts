/**
 * dailyTasks.service.ts
 *
 * Cloud-synchronized single-day study tasks for ZyntraFocus.
 *
 * Requirements:
 * - Automatically resets daily (keyed by local YYYY-MM-DD dateKey)
 * - Synchronized in real-time across all user devices (Mobile, Laptop, Desktop)
 * - Lightweight without long-term tracking or bloat
 */

import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'

export interface DailyTask {
  id: string
  text: string
  completed: boolean
}

const taskDoc = (userId: string, dateKey: string) =>
  doc(db, USERS_COL, userId, SUB.DAILY_TASKS || 'dailyTasks', dateKey)

/**
 * Subscribes to real-time daily task updates for a specific dateKey.
 * Enables instant multi-device synchronization.
 */
export function subscribeToDailyTasks(
  userId: string,
  dateKey: string,
  onUpdate: (tasks: DailyTask[], existsInCloud: boolean) => void
): () => void {
  return onSnapshot(
    taskDoc(userId, dateKey),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        onUpdate(data.tasks || [], true)
      } else {
        onUpdate([], false)
      }
    },
    (err) => {
      console.warn('[dailyTasks.service] sync error:', err)
    }
  )
}

/**
 * Saves the day's tasks to Firestore.
 */
export async function saveDailyTasks(
  userId: string,
  dateKey: string,
  tasks: DailyTask[]
): Promise<void> {
  try {
    await setDoc(
      taskDoc(userId, dateKey),
      {
        dateKey,
        tasks,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (err) {
    console.error('[dailyTasks.service] saveDailyTasks error:', err)
  }
}

