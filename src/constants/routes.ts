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

  // Personal features
  NOTES: '/notes',
  BOOKMARKS: '/bookmarks',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
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
