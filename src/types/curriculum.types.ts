import { Timestamp } from 'firebase/firestore'

export type VideoStatus =
  | 'available'
  | 'unavailable'
  | 'private'
  | 'not_embeddable'
  | 'deleted'
  | 'unknown'

// ── Timestamps ────────────────────────────────────────────────────────
export interface LectureTimestamp {
  time: number    // seconds from video start (integer)
  label: string   // display-ready label
}

// ── Attachments ───────────────────────────────────────────────────────
export type AttachmentType = 'slides' | 'pdf' | 'notes' | 'other'

export interface LectureAttachment {
  id: string              // crypto.randomUUID()
  title: string
  url: string             // Google Drive or any valid URL
  type?: AttachmentType
  description?: string
}

// ── Chapter Resources ─────────────────────────────────────────────────
export type ChapterResourceType = 'pdf' | 'link' | 'note'

export interface ChapterResource {
  id: string                // crypto.randomUUID()
  title: string
  type: ChapterResourceType
  url?: string              // for pdf / link types
  rawContent?: string       // original plain text / markdown (note type)
  htmlContent?: string      // AI-polished or custom HTML output (note type)
  isCustomHtml?: boolean    // true = manually pasted HTML (no AI), false/undefined = AI-polished
  createdAt: number         // Date.now()
}


// ── Subject ───────────────────────────────────────────────────────────
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

// ── Chapter ───────────────────────────────────────────────────────────
export interface Chapter {
  id: string
  subjectId: string
  subjectName: string
  name: string
  description: string
  order: number
  isActive: boolean
  lectureCount: number
  resources?: ChapterResource[]
  createdAt: Timestamp
  updatedAt: Timestamp
}


// ── Lecture ───────────────────────────────────────────────────────────
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
  slideUrl?: string
  noteHtml?: string           // per-lecture interactive HTML note (sanitized)
  timestamps?: LectureTimestamp[]
  attachments?: LectureAttachment[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── Form types for creating / editing ─────────────────────────────────
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
  order?: number
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
  slideUrl?: string
  noteHtml?: string
  timestamps?: LectureTimestamp[]
  attachments?: LectureAttachment[]
}
