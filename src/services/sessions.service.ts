import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants/firebase'
import type { StudySession } from '@/types/progress.types'
import { getLocalDateKey, getDateKeyDaysAgo } from '@/utils/date.utils'

export async function createSession(
  userId: string,
  data: {
    lectureId: string
    subjectId: string
    chapterId: string
    subjectName: string
    startedAt: Date
    endedAt: Date
    timerMode?: 'pomodoro-25' | 'pomodoro-45' | 'free-timer'
    topic?: string
  }
): Promise<void> {
  const duration = Math.round((data.endedAt.getTime() - data.startedAt.getTime()) / 1000)
  if (duration <= 0) return

  const payload: Record<string, unknown> = {
    ...data,
    duration,
    dateKey: getLocalDateKey(data.startedAt),
    startedAt: Timestamp.fromDate(data.startedAt),
    endedAt: Timestamp.fromDate(data.endedAt),
  }
  // Remove undefined fields so Firestore doesn't reject them
  if (!payload.timerMode) delete payload.timerMode
  if (!payload.topic) delete payload.topic

  await addDoc(collection(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.STUDY_SESSIONS), payload)
}

export async function getSessionsByDateRange(
  userId: string,
  daysBack: number = 30
): Promise<StudySession[]> {
  const oldestKey = getDateKeyDaysAgo(daysBack)
  const q = query(
    collection(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.STUDY_SESSIONS),
    where('dateKey', '>=', oldestKey),
    orderBy('dateKey', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudySession)
}

export async function getTodaySessions(userId: string): Promise<StudySession[]> {
  const today = getLocalDateKey()
  const q = query(
    collection(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.STUDY_SESSIONS),
    where('dateKey', '==', today)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudySession)
}

// Sum total study seconds from an array of sessions
export function sumSessionSeconds(sessions: StudySession[]): number {
  return sessions.reduce((acc, s) => acc + (s.duration ?? 0), 0)
}
