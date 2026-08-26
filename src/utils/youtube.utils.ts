// Supported YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/watch\?.*[&?]v=([A-Za-z0-9_-]{11})/,
]

const VALID_ID_REGEX = /^[A-Za-z0-9_-]{11}$/

// Extracts YouTube video ID from any supported URL format
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim()
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match?.[1] && VALID_ID_REGEX.test(match[1])) {
      return match[1]
    }
  }
  // If the input itself looks like a raw video ID
  if (VALID_ID_REGEX.test(trimmed)) return trimmed
  return null
}

// Validates a YouTube video ID format
export function isValidYouTubeId(id: string): boolean {
  return VALID_ID_REGEX.test(id)
}

// Builds the best thumbnail URL with fallback
export function getThumbnailUrl(videoId: string, quality: 'max' | 'high' | 'medium' = 'high'): string {
  const qualityMap = {
    max: 'maxresdefault',
    high: 'hqdefault',
    medium: 'mqdefault',
  }
  return `https://i.ytimg.com/vi/${videoId}/${qualityMap[quality]}.jpg`
}

// Builds canonical YouTube watch URL
export function buildYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

// Extracts timestamp from YouTube URL (e.g. ?t=120 or &t=1h30m)
export function extractUrlTimestamp(url: string): number | null {
  const match = url.match(/[?&]t=(\d+)/)
  if (match?.[1]) return parseInt(match[1], 10)
  return null
}
