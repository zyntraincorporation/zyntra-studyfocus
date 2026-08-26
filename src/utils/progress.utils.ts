// Clamps a number between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Calculates percentage
export function calcPercentage(current: number, total: number): number {
  if (!total || total === 0) return 0
  return clamp(Math.round((current / total) * 100), 0, 100)
}

// Determines lecture status
export function getLectureStatus(
  percentage: number,
  completed: boolean
): 'not_started' | 'in_progress' | 'completed' {
  if (completed) return 'completed'
  if (percentage > 1) return 'in_progress'
  return 'not_started'
}

// Calculates chapter progress from lecture progress map
export function calcChapterProgress(
  lectureIds: string[],
  progressMap: Record<string, { completed: boolean }>
): { completed: number; total: number; percentage: number } {
  const total = lectureIds.length
  if (total === 0) return { completed: 0, total: 0, percentage: 0 }
  const completed = lectureIds.filter((id) => progressMap[id]?.completed).length
  return { completed, total, percentage: calcPercentage(completed, total) }
}
