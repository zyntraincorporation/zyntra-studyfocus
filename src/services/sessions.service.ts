import {
  collection,
  doc,
  setDoc,
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

/**
 * Progressively updates or creates an active study session.
 * Used for live incremental heartbeats so that even if the computer loses power
 * or the browser crashes after 30+ minutes, all studied time is safely persisted!
 */
export async function upsertActiveSession(
  userId: string,
  sessionId: string,
  data: {
    lectureId: string
    subjectId: string
    chapterId: string
    subjectName: string
    startedAt: Date
    endedAt: Date
    duration?: number
    timerMode?: 'pomodoro-25' | 'pomodoro-45' | 'free-timer'
    topic?: string
    isLive?: boolean
  }
): Promise<void> {
  const duration =
    data.duration !== undefined
      ? Math.round(data.duration)
      : Math.max(0, Math.round((data.endedAt.getTime() - data.startedAt.getTime()) / 1000))

  if (duration <= 0) return

  const payload: Record<string, unknown> = {
    lectureId: data.lectureId,
    subjectId: data.subjectId,
    chapterId: data.chapterId,
    subjectName: data.subjectName,
    duration,
    dateKey: getLocalDateKey(data.startedAt),
    startedAt: Timestamp.fromDate(data.startedAt),
    endedAt: Timestamp.fromDate(data.endedAt),
    updatedAt: serverTimestamp(),
  }

  if (data.timerMode) payload.timerMode = data.timerMode
  if (data.topic) payload.topic = data.topic
  if (data.isLive) payload.isLive = data.isLive

  const docRef = doc(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.STUDY_SESSIONS, sessionId)
  await setDoc(docRef, payload, { merge: true })
}

/**
 * Creates or finalizes a study session.
 */
export async function createSession(
  userId: string,
  data: {
    lectureId: string
    subjectId: string
    chapterId: string
    subjectName: string
    startedAt: Date
    endedAt: Date
    duration?: number
    timerMode?: 'pomodoro-25' | 'pomodoro-45' | 'free-timer'
    topic?: string
    sessionId?: string
  }
): Promise<string> {
  const sessionId =
    data.sessionId ||
    doc(collection(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.STUDY_SESSIONS)).id

  await upsertActiveSession(userId, sessionId, data)
  return sessionId
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
