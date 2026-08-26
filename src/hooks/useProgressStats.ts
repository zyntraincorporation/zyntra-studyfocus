/**
 * useProgressStats — derives completion % from the AuthContext progressMap
 * No extra Firestore reads needed since progressMap is loaded at login.
 */
import { useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { calcPercentage } from '@/utils/progress.utils'

export function useProgressStats() {
  const { progressMap } = useAuth()

  // Average completion % across all lectures of a subject
  const getSubjectProgress = useCallback(
    (subjectId: string): number => {
      const entries = Object.values(progressMap).filter(
        (p) => p.subjectId === subjectId
      )
      if (!entries.length) return 0
      const total = entries.reduce((sum, p) => sum + (p.percentage ?? 0), 0)
      return Math.round(total / entries.length)
    },
    [progressMap]
  )

  // Average completion % across all lectures of a chapter
  const getChapterProgress = useCallback(
    (chapterId: string): number => {
      const entries = Object.values(progressMap).filter(
        (p) => p.chapterId === chapterId
      )
      if (!entries.length) return 0
      const total = entries.reduce((sum, p) => sum + (p.percentage ?? 0), 0)
      return Math.round(total / entries.length)
    },
    [progressMap]
  )

  // Completion % for a single lecture
  const getLectureProgress = useCallback(
    (lectureId: string): number => {
      return progressMap[lectureId]?.percentage ?? 0
    },
    [progressMap]
  )

  const isLectureCompleted = useCallback(
    (lectureId: string): boolean => {
      return progressMap[lectureId]?.completed ?? false
    },
    [progressMap]
  )

  return { getSubjectProgress, getChapterProgress, getLectureProgress, isLectureCompleted }
}
