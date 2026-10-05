import type { Timestamp } from 'firebase/firestore'

/** users/{uid}/studyMaterials/{id} — standalone; unrelated to chapter.resources */
export interface StudyMaterial {
  id: string
  subjectId: string
  chapterId: string
  title: string          // "Vector Class Lecture 03"
  baseTitle: string      // "Vector Class Lecture"
  serial: number         // number within baseTitle (3)
  seq?: number           // legacy alias of `serial` (older documents)
  googleDriveUrl: string // original URL as pasted
  order: number          // serial-driven order within chapter
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** users/{uid}/studyMaterialProgress/{resourceId} */
export interface StudyMaterialProgress {
  resourceId: string
  subjectId: string
  chapterId: string
  lastPage?: number      // user-marked page (Drive preview does not expose page state)
  lastOpenedAt?: Timestamp
  updatedAt?: Timestamp
}

/**
 * users/{uid}/studyMaterialDaily/{YYYY-MM-DD}_{subjectId}
 * One document per user + local date + subject. Query by `date` for
 * today's total / per-subject totals / history.
 */
export interface StudyMaterialDailyTime {
  userId: string
  date: string           // local day, YYYY-MM-DD
  subjectId: string
  totalSeconds: number
  lastChapterId?: string // metadata for future analytics
  lastResourceId?: string
  updatedAt?: Timestamp
}
