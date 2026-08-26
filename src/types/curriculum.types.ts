import { Timestamp } from 'firebase/firestore'

export type VideoStatus =
  | 'available'
  | 'unavailable'
  | 'private'
  | 'not_embeddable'
  | 'deleted'
  | 'unknown'

export interface Subject {
  id: string
  name: string
  description: string
  icon: string
  color: string
  order: number
  isActive: boolean
  lectureCount: number
  chapterCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Chapter {
  id: string
  subjectId: string
  subjectName: string
  name: string
  description: string
  order: number
  isActive: boolean
  lectureCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Lecture {
  id: string
  chapterId: string
  chapterName: string
  subjectId: string
  subjectName: string
  title: string
  youtubeVideoId: string
  youtubeUrl: string
  thumbnailUrl: string
  duration: number
  durationFormatted: string
  channelName: string
  description: string
  order: number
  isImportant: boolean
  isActive: boolean
  videoStatus: VideoStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Form types for creating/editing
export type SubjectInput = {
  name: string
  description: string
  icon: string
  color: string
}

export type ChapterInput = {
  name: string
  description: string
  subjectId: string
  subjectName: string
}

export type LectureInput = {
  title: string
  youtubeVideoId: string
  youtubeUrl: string
  thumbnailUrl: string
  duration: number
  durationFormatted: string
  channelName: string
  description: string
  chapterId: string
  chapterName: string
  subjectId: string
  subjectName: string
}
