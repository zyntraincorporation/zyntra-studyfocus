import { Timestamp } from 'firebase/firestore'

export type NoteCategory = 'general' | 'formula' | 'exam' | 'important' | 'revision' | 'confusing' | null

export interface Note {
  id: string
  lectureId: string
  subjectId: string
  chapterId: string
  lectureTitle: string
  subjectName: string
  chapterName: string
  timestamp: number
  content: string
  category: NoteCategory
  createdAt: Timestamp
  updatedAt: Timestamp
}
