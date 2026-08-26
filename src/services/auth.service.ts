import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { USERS_COL } from '@/constants/firebase'
import type { UserDocument } from '@/types/user.types'

// Sign in with email and password
export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  // Update last login time (best-effort)
  try {
    await updateDoc(doc(db, USERS_COL, credential.user.uid), {
      lastLoginAt: serverTimestamp(),
    })
  } catch { /* doc may not exist yet — handled by getOrCreateUserDocument */ }
  return credential.user
}

// Sign out
export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

// Auth state listener
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

// Get or create user document — called on every successful login
// V1: No roles. Every user is just an authenticated workspace owner.
export async function getOrCreateUserDocument(user: User): Promise<UserDocument> {
  const ref = doc(db, USERS_COL, user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    return snap.data() as UserDocument
  }

  // First login — bootstrap the user document
  const newUser: Omit<UserDocument, 'createdAt' | 'lastLoginAt'> = {
    uid: user.uid,
    displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
    email: user.email ?? '',
    photoURL: user.photoURL,
    streak: 0,
    longestStreak: 0,
    lastStreakDate: '',
    dailyGoalMinutes: 60,
    preferredSpeed: 1,
    autoResume: true,
    theme: 'dark',
    breakReminderMinutes: 50,
    streakMinimumMinutes: 10,
  }

  await setDoc(ref, {
    ...newUser,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  })

  const created = await getDoc(ref)
  return created.data() as UserDocument
}
