import { Timestamp } from 'firebase/firestore'

export type BookmarkCategory =
  | 'important'
  | 'formula'
  | 'exam_question'
  | 'confusing'
  | 'revision'
  | 'example'

export interface Bookmark {
  id: string
  lectureId: string
  subjectId: string
  chapterId: string
  lectureTitle: string
  subjectName: string
  timestamp: number
  label: string
  category: BookmarkCategory
  createdAt: Timestamp
}
