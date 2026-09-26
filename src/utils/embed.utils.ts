/**
 * embed.utils.ts
 *
 * Helpers to convert Google Drive, Google Docs, and PDF URLs into
 * reliable embed/preview URLs for in-app modals.
 */

export function toSlideEmbedUrl(rawUrl: string, useGoogleViewerForPdf = false): string {
  if (!rawUrl) return ''
  let url = rawUrl.trim()
  if (!url) return ''

  // Prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  // Already a preview or embed URL
  if (url.includes('/preview') || url.includes('/embed') || url.includes('docs.google.com/viewer')) {
    return url
  }

  // Google Drive standard file link: /file/d/{id}
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)
  if (driveFile) {
    return `https://drive.google.com/file/d/${driveFile[1]}/preview`
  }

  // Google Drive query param ID: ?id={id} or &id={id} (e.g. open?id=..., uc?id=...)
  const driveId = url.match(/drive\.google\.com\/[^\s]*[?&]id=([^&#]+)/i)
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId[1]}/preview`
  }

  // Google Drive folder link
  const driveFolder = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([^/?#]+)/i)
  if (driveFolder) {
    return `https://drive.google.com/embeddedfolderview?id=${driveFolder[1]}#list`
  }

  // Google Docs / Sheets / Slides
  const docsMatch = url.match(/docs\.google\.com\/(presentation|document|spreadsheets)\/d\/([^/?#]+)/i)
  if (docsMatch) {
    const docType = docsMatch[1]
    const docId = docsMatch[2]
    return docType === 'presentation'
      ? `https://docs.google.com/presentation/d/${docId}/embed`
      : `https://docs.google.com/${docType}/d/${docId}/preview`
  }

  // Generic drive.google.com link with 25+ alphanumeric ID
  if (url.includes('drive.google.com')) {
    const rawIdMatch = url.match(/[-\w]{25,}/)
    if (rawIdMatch) {
      return `https://drive.google.com/file/d/${rawIdMatch[0]}/preview`
    }
  }

  // Direct PDF handling
  const isPdf = /\.pdf($|[?#])/i.test(url)
  if (isPdf) {
    if (useGoogleViewerForPdf) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    }
    return url
  }

  return url
}
