import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB, SETTINGS_DOC } from '@/constants/firebase'
import type { UserDocument, UserPreferences } from '@/types/user.types'

export async function updateUserDocument(
  userId: string,
  data: Partial<Omit<UserDocument, 'uid' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), {
    ...data,
    lastLoginAt: serverTimestamp(),
  })
}

export async function updateUserStreak(
  userId: string,
  streak: number,
  longestStreak: number,
  lastStreakDate: string
): Promise<void> {
  await updateDoc(doc(db, USERS_COL, userId), {
    streak,
    longestStreak,
    lastStreakDate,
  })
}

export async function getPreferences(
  userId: string
): Promise<UserPreferences | null> {
  const snap = await getDoc(
    doc(db, USERS_COL, userId, SUB.SETTINGS, SETTINGS_DOC)
  )
  return snap.exists() ? (snap.data() as UserPreferences) : null
}

export async function savePreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<void> {
  const ref = doc(db, USERS_COL, userId, SUB.SETTINGS, SETTINGS_DOC)
  await setDoc(ref, { ...prefs, updatedAt: serverTimestamp() }, { merge: true })
}
