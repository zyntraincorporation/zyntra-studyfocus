/**
 * drive.utils.ts
 *
 * Helpers to parse and embed Google Drive folders and files
 * seamlessly across the platform (slides, attachments, resources).
 */

/** Check if a string is or contains a Google Drive folder link */
export function isDriveFolderUrl(rawUrl: string): boolean {
  if (!rawUrl) return false
  const url = rawUrl.trim()
  return (
    /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/i.test(url) ||
    /drive\.google\.com\/folderview\?[^#]*id=([a-zA-Z0-9_-]+)/i.test(url) ||
    /drive\.google\.com\/embeddedfolderview\?[^#]*id=([a-zA-Z0-9_-]+)/i.test(url)
  )
}

/** Extract Google Drive folder ID from various folder link formats */
export function extractDriveFolderId(rawUrl: string): string | null {
  if (!rawUrl) return null
  const url = rawUrl.trim()

  const matchFolders = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/i)
  if (matchFolders) return matchFolders[1]

  const matchFolderView = url.match(/drive\.google\.com\/folderview\?[^#]*id=([a-zA-Z0-9_-]+)/i)
  if (matchFolderView) return matchFolderView[1]

  const matchEmbedded = url.match(/drive\.google\.com\/embeddedfolderview\?[^#]*id=([a-zA-Z0-9_-]+)/i)
  if (matchEmbedded) return matchEmbedded[1]

  // If user passed a bare folder ID (alphanumeric, dashes, underscores, typically 25+ chars)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return url
  }

  return null
}

/** Check if a string is or contains a Google Drive or Google Docs file link */
export function isDriveFileUrl(rawUrl: string): boolean {
  if (!rawUrl) return false
  const url = rawUrl.trim()
  return (
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i.test(url) ||
    /drive\.google\.com\/open\?[^#]*id=([a-zA-Z0-9_-]+)/i.test(url) ||
    /drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/i.test(url) ||
    /docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i.test(url)
  )
}

/** Extract Google Drive file ID from standard links */
export function extractDriveFileId(rawUrl: string): string | null {
  if (!rawUrl) return null
  const url = rawUrl.trim()

  const matchFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i)
  if (matchFile) return matchFile[1]

  const matchOpenId = url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*id=([a-zA-Z0-9_-]+)/i)
  if (matchOpenId) return matchOpenId[1]

  const matchDocs = url.match(/docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/i)
  if (matchDocs) return matchDocs[1]

  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return url
  }

  return null
}

/** Build embedded folder view URL */
export function toDriveFolderEmbedUrl(
  folderIdOrUrl: string,
  layout: 'list' | 'grid' = 'list'
): string {
  const folderId = extractDriveFolderId(folderIdOrUrl) || folderIdOrUrl.trim()
  if (!folderId) return ''
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#${layout}`
}

/** Build embedded file view URL */
export function toDriveFileEmbedUrl(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return ''
  let url = fileIdOrUrl.trim()
  if (!/^https?:\/\//i.test(url) && !url.includes('/')) {
    // raw ID
    return `https://drive.google.com/file/d/${url}/preview`
  }

  const fileId = extractDriveFileId(url)
  if (fileId) {
    if (url.includes('docs.google.com/presentation')) {
      return `https://docs.google.com/presentation/d/${fileId}/embed`
    }
    if (url.includes('docs.google.com/document')) {
      return `https://docs.google.com/document/d/${fileId}/preview`
    }
    if (url.includes('docs.google.com/spreadsheets')) {
      return `https://docs.google.com/spreadsheets/d/${fileId}/preview`
    }
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  // Already preview or embed
  if (url.includes('/preview') || url.includes('/embed')) {
    return url
  }

  // Fallback direct PDF or generic
  if (/\.pdf($|[?#])/i.test(url)) {
    return url
  }

  return url
}
