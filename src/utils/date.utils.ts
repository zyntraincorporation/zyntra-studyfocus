// Returns 'YYYY-MM-DD' in user's LOCAL timezone
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Returns yesterday's date key in local timezone
export function getYesterdayDateKey(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return getLocalDateKey(yesterday)
}

// Checks if a dateKey represents today
export function isToday(dateKey: string): boolean {
  return dateKey === getLocalDateKey()
}

// Checks if a dateKey represents yesterday
export function isYesterday(dateKey: string): boolean {
  return dateKey === getYesterdayDateKey()
}

// Returns dateKey for N days ago
export function getDateKeyDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return getLocalDateKey(date)
}

// Returns array of last N dateKeys (for weekly charts)
export function getLastNDateKeys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => getDateKeyDaysAgo(n - 1 - i))
}

// Formats dateKey to display string: '2026-08-26' → 'Aug 26'
export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Formats dateKey to weekday: 'Mon', 'Tue', etc.
export function getWeekdayShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}
