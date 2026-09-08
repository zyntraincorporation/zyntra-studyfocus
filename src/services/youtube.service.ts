import { extractYouTubeId, getThumbnailUrl, buildYouTubeUrl } from '@/utils/youtube.utils'
import { parseISODuration, formatDuration } from '@/utils/time.utils'

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string
const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface YouTubeVideoMeta {
  videoId: string
  youtubeUrl: string
  title: string
  channelName: string
  description: string
  thumbnailUrl: string
  duration: number
  durationFormatted: string
  embeddable: boolean
  privacyStatus: string
}

export type YouTubeImportResult =
  | { success: true; data: YouTubeVideoMeta }
  | { success: false; error: string }

// Fetch metadata for a YouTube URL (admin only)
export async function fetchYouTubeMetadata(url: string): Promise<YouTubeImportResult> {
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return { success: false, error: 'Invalid YouTube URL. Please paste a valid YouTube video link.' }
  }

  if (!API_KEY) {
    return { success: false, error: 'YouTube API key is not configured.' }
  }

  try {
    const response = await fetch(
      `${BASE_URL}/videos?part=snippet,contentDetails,status&id=${videoId}&key=${API_KEY}`
    )

    if (!response.ok) {
      return { success: false, error: 'Failed to reach YouTube API. Please try again.' }
    }

    const json = await response.json()

    if (!json.items || json.items.length === 0) {
      return { success: false, error: 'Video not found. It may be deleted or private.' }
    }

    const item = json.items[0]
    const snippet = item.snippet
    const contentDetails = item.contentDetails
    const status = item.status

    if (!status.embeddable) {
      return {
        success: false,
        error: 'This video cannot be embedded. The video owner has disabled embedding.',
      }
    }

    if (status.privacyStatus === 'private') {
      return {
        success: false,
        error: 'This video is private and cannot be embedded. Please set it to Unlisted or Public on YouTube.',
      }
    }

    const duration = parseISODuration(contentDetails.duration ?? '')
    const thumbnails = snippet.thumbnails
    const thumbnailUrl =
      thumbnails.maxres?.url ??
      thumbnails.high?.url ??
      thumbnails.medium?.url ??
      getThumbnailUrl(videoId, 'high')

    return {
      success: true,
      data: {
        videoId,
        youtubeUrl: buildYouTubeUrl(videoId),
        title: snippet.title ?? 'Untitled',
        channelName: snippet.channelTitle ?? '',
        description: snippet.description ?? '',
        thumbnailUrl,
        duration,
        durationFormatted: formatDuration(duration),
        embeddable: status.embeddable,
        privacyStatus: status.privacyStatus,
      },
    }
  } catch {
    return { success: false, error: 'Network error. Please check your connection and try again.' }
  }
}

// Check embedding status of an existing video (for health monitoring)
export async function checkVideoStatus(videoId: string): Promise<{
  status: 'available' | 'unavailable' | 'private' | 'not_embeddable' | 'deleted'
}> {
  if (!API_KEY) return { status: 'unavailable' }

  try {
    const response = await fetch(
      `${BASE_URL}/videos?part=status&id=${videoId}&key=${API_KEY}`
    )
    if (!response.ok) return { status: 'unavailable' }

    const json = await response.json()
    if (!json.items || json.items.length === 0) return { status: 'deleted' }

    const s = json.items[0].status
    if (s.privacyStatus === 'private') return { status: 'private' }
    if (!s.embeddable) return { status: 'not_embeddable' }
    return { status: 'available' }
  } catch {
    return { status: 'unavailable' }
  }
}
