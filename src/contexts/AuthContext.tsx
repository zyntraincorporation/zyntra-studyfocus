import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, getOrCreateUserDocument, signOutUser } from '@/services/auth.service'
import { getAllProgress } from '@/services/progress.service'
import type { UserDocument } from '@/types/user.types'
import type { LectureProgress } from '@/types/progress.types'

interface AuthContextValue {
  user: User | null
  userDoc: UserDocument | null
  progressMap: Record<string, LectureProgress>
  isLoading: boolean
  signOut: () => Promise<void>
  refreshUserDoc: () => Promise<void>
  updateProgressMap: (lectureId: string, progress: Partial<LectureProgress>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null)
  const [progressMap, setProgressMap] = useState<Record<string, LectureProgress>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setIsLoading(true)
      if (firebaseUser) {
        try {
          const uDoc = await getOrCreateUserDocument(firebaseUser)
          setUserDoc(uDoc)
          setUser(firebaseUser)
          const progress = await getAllProgress(firebaseUser.uid)
          setProgressMap(progress)
        } catch (err) {
          console.error('Error loading user data:', err)
        }
      } else {
        setUser(null)
        setUserDoc(null)
        setProgressMap({})
      }
      setIsLoading(false)
    })
    return unsubscribe
  }, [])

  // Lazy import to avoid circular dep
  const signOut = useCallback(async () => {
    await signOutUser()
  }, [])

  const refreshUserDoc = useCallback(async () => {
    if (!user) return
    const uDoc = await getOrCreateUserDocument(user)
    setUserDoc(uDoc)
  }, [user])

  const updateProgressMap = useCallback(
    (lectureId: string, progress: Partial<LectureProgress>) => {
      setProgressMap((prev) => ({
        ...prev,
        [lectureId]: { ...(prev[lectureId] ?? {}), ...progress } as LectureProgress,
      }))
    },
    []
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        progressMap,
        isLoading,
        signOut,
        refreshUserDoc,
        updateProgressMap,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
