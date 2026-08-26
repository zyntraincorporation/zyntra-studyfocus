import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants/firebase'
import type { LectureProgress } from '@/types/progress.types'

// Save progress (upsert)
export async function saveProgress(
  userId: string,
  lectureId: string,
  data: Partial<LectureProgress>
): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.PROGRESS, lectureId)
  await setDoc(
    ref,
    {
      ...data,
      lectureId,
      lastWatchedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

// Get single lecture progress
export async function getProgress(
  userId: string,
  lectureId: string
): Promise<LectureProgress | null> {
  const snap = await getDoc(
    doc(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.PROGRESS, lectureId)
  )
  return snap.exists() ? (snap.data() as LectureProgress) : null
}

// Get all progress for a user (loaded once on app start)
export async function getAllProgress(userId: string): Promise<Record<string, LectureProgress>> {
  const snap = await getDocs(
    collection(db, COLLECTIONS.USERS, userId, SUBCOLLECTIONS.PROGRESS)
  )
  const map: Record<string, LectureProgress> = {}
  snap.docs.forEach((d) => {
    map[d.id] = d.data() as LectureProgress
  })
  return map
}

// Mark lecture as completed
export async function markCompleted(userId: string, lectureId: string): Promise<void> {
  await saveProgress(userId, lectureId, {
    completed: true,
    completedAt: Timestamp.now(),
    percentage: 100,
  })
}
