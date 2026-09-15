import { Timestamp } from 'firebase/firestore'

export interface LectureProgress {
  lectureId: string
  subjectId: string
  chapterId: string
  lectureTitle?: string
  subjectName?: string
  chapterName?: string
  currentPosition: number
  duration: number
  percentage: number
  completed: boolean
  completedAt: Timestamp | null
  lastWatchedAt: Timestamp
  totalWatchTime?: number
}

export interface StudySession {
  id: string
  lectureId: string
  subjectId: string
  chapterId: string
  subjectName: string
  startedAt: Timestamp
  endedAt: Timestamp
  duration: number
  dateKey: string // 'YYYY-MM-DD' in user's local timezone
  timerMode?: 'pomodoro-25' | 'pomodoro-45' | 'free-timer' // source of session
  topic?: string  // what the user was studying (free text)
}
