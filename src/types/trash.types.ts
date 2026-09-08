import type { ChapterResourceType } from './curriculum.types'

export interface TrashedItem {
  id: string
  originalId: string
  type: 'resource' | 'lecture_note'
  title: string
  resourceType: ChapterResourceType
  subjectId?: string
  subjectName?: string
  chapterId?: string
  chapterName?: string
  rawContent?: string
  htmlContent?: string
  url?: string
  createdAt: number
  deletedAt: number
}
