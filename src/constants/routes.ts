// Route path constants — V1 personal workspace model
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',

  // Curriculum (user's own workspace)
  SUBJECTS: '/subjects',
  SUBJECT: '/subjects/:subjectId',
  CHAPTER: '/subjects/:subjectId/chapters/:chapterId',

  // Lecture player (clean /watch/:lectureId URL)
  WATCH: '/watch/:lectureId',

  // Study Materials (standalone Drive PDF reader)
  STUDY_MATERIALS: '/study-materials',
  STUDY_SUBJECT: '/study-materials/subject/:subjectId',
  STUDY_READER: '/study-materials/read/:resourceId',

  // Personal features
  NOTES: '/notes',
  BOOKMARKS: '/bookmarks',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  TIMER: '/timer',

  // ── Live Learning System Routes ──────────────────────────────────────
  // Full timetable & schedule management
  SCHEDULE: '/schedule',
  // Draft builder — create a new schedule
  SCHEDULE_CREATE: '/schedule/create',
  // Completed class history & review
  SCHEDULE_HISTORY: '/schedule/history',
  // Dedicated live player (fullscreen, no AppLayout chrome — like WatchPage)
  LIVE_WATCH: '/live/:scheduleId',
} as const

// Helper: build a dynamic route by replacing :param tokens
export function buildRoute(
  pattern: string,
  params: Record<string, string>
): string {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    pattern
  )
}
