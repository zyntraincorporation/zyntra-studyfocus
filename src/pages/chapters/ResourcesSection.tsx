import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import {
  Plus, Trash2, ExternalLink, FileText, Link2, BookOpen,
  Sparkles, Loader2, ChevronDown, ChevronUp, Pencil, AlertCircle, X,
  Maximize, Minimize,
  ZoomIn, ZoomOut, Maximize2, Minimize2, Search, AlertTriangle,
} from 'lucide-react'
import type { ChapterResource, ChapterResourceType } from '@/types/curriculum.types'
import { callPolishNote } from '@/services/note-polish.service'
import { moveToTrash } from '@/services/trash.service'
import { useAuth } from '@/contexts/AuthContext'
import { renderMathInHtml } from '@/utils/mathRenderer'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

// ── Helpers ───────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's',
      'code', 'pre', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'sup', 'sub',
    ],
    ALLOWED_ATTR: ['style', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src'],
  })
  return renderMathInHtml(clean)
}

const TYPE_CONFIG: Record<ChapterResourceType, { icon: React.ReactNode; label: string; color: string }> = {
  pdf:  { icon: <FileText size={14} />,  label: 'PDF',  color: '#EF4444' },
  link: { icon: <Link2 size={14} />,     label: 'Link', color: '#38BDF8' },
  note: { icon: <BookOpen size={14} />,  label: 'Note', color: '#34D399' },
}

// Convert any URL to an embeddable URL that displays inline (no download)
function toEmbedUrl(url: string, type?: ChapterResourceType): string {
  if (!url) return ''
  const trimmed = url.trim()

  // 1. If already an embed or preview URL
  if (trimmed.includes('/preview')) return trimmed
  if (trimmed.includes('docs.google.com/viewer')) return trimmed

  // 2. Google Drive /file/d/{ID}
  const driveFile = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)
  if (driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`

  // 3. Google Drive with id param: ?id={ID}, &id={ID}, /open?id={ID}, /uc?id={ID}
  const driveId = trimmed.match(/drive\.google\.com\/[^\s]*[?&]id=([^&#]+)/)
  if (driveId) return `https://drive.google.com/file/d/${driveId[1]}/preview`

  // 4. Google Docs / Sheets / Slides
  const docsMatch = trimmed.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/)
  if (docsMatch) return `https://docs.google.com/${docsMatch[1]}/d/${docsMatch[2]}/preview`

  // 5. Any other Google Drive link with a 25+ char ID
  if (trimmed.includes('drive.google.com')) {
    const rawIdMatch = trimmed.match(/[-\w]{25,}/)
    if (rawIdMatch) return `https://drive.google.com/file/d/${rawIdMatch[0]}/preview`
  }

  // 6. PDF files: Use Google Docs Viewer to render inside iframe without browser download
  const isPdf = type === 'pdf' || /\.pdf($|[?#])/i.test(trimmed)
  if (isPdf) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`
  }

  // 7. Fallback for generic links
  return trimmed
}


// ── Fullscreen Overlay Viewer (covers entire viewport, within website) ─

function FullscreenViewer({
  title,
  type,
  onClose,
  children,
  externalUrl,
  extraAction,
}: {
  title: string
  type: ChapterResourceType
  onClose: () => void
  children: React.ReactNode
  externalUrl?: string
  extraAction?: React.ReactNode
}) {
  // Browser fullscreen state
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)

  // Close on Escape & sync fullscreen state
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const fsHandler = () => setIsBrowserFullscreen(!!document.fullscreenElement)
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('fullscreenchange', fsHandler)
    return () => {
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('fullscreenchange', fsHandler)
    }
  }, [onClose])

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // ignore
    }
  }

  const cfg = TYPE_CONFIG[type]

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      style={{ animation: 'fadeIn .15s ease' }}
    >
      {/* Top bar (100% mobile-responsive) */}
      <div className="flex items-center justify-between px-2.5 sm:px-5 py-2 sm:py-3 bg-[#0B0F14] border-b border-[#1E2A36] shrink-0 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <span style={{ color: cfg.color }} className="shrink-0">{cfg.icon}</span>
          <span className="text-xs sm:text-sm font-semibold text-[#F8FAFC] truncate max-w-[28vw] sm:max-w-[42vw]">{title}</span>
          <span
            className="text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 hidden xs:inline-block"
            style={{ background: `${cfg.color}18`, color: cfg.color }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {extraAction}
          <button
            onClick={toggleBrowserFullscreen}
            className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] px-1.5 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            title={isBrowserFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isBrowserFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
            <span className="hidden lg:inline">{isBrowserFullscreen ? 'Exit Screen' : 'Full Screen'}</span>
          </button>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#818CF8] hover:bg-[#1E2A36] px-1.5 sm:px-2.5 py-1 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink size={13} />
              <span className="hidden lg:inline">Open</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#F8FAFC] transition-colors cursor-pointer px-1.5 sm:px-2 py-1 rounded-lg hover:bg-[#1E2A36]"
            title="Close (Esc)"
          >
            <X size={15} />
            <span className="hidden sm:inline">Close</span>
            <span className="text-[#475569] hidden md:inline ml-0.5">Esc</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full relative overflow-hidden" style={{ minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── PDF / Link Fullscreen Viewer ──────────────────────────────────────

function EmbedViewerModal({
  resource,
  onClose,
}: {
  resource: ChapterResource
  onClose: () => void
}) {
  const [iframeError, setIframeError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [useAltViewer, setUseAltViewer] = useState(false)

  const rawUrl = resource.url ?? ''
  const isDrive = rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com')

  // Calculate embed URL passing resource.type
  let embedUrl = toEmbedUrl(rawUrl, resource.type)
  if (useAltViewer) {
    if (embedUrl.includes('docs.google.com/viewer')) {
      embedUrl = rawUrl
    } else {
      embedUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`
    }
  }

  return (
    <FullscreenViewer
      title={resource.title}
      type={resource.type}
      onClose={onClose}
      externalUrl={resource.url}
      extraAction={
        !isDrive && resource.type === 'pdf' ? (
          <button
            onClick={() => {
              setUseAltViewer((v) => !v)
              setIsLoading(true)
              setIframeError(false)
            }}
            className="text-xs text-[#818CF8] hover:text-[#A5B4FC] px-2.5 py-1 rounded-lg bg-[#6366F1]/10 hover:bg-[#6366F1]/20 transition-colors cursor-pointer"
            title="Switch PDF viewer engine"
          >
            {useAltViewer ? 'Original View' : 'Google Viewer'}
          </button>
        ) : null
      }
    >
      <div className="w-full h-full relative overflow-hidden bg-[#0B0F14]">
        {isLoading && !iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080C12] z-10">
            <Loader2 size={30} className="animate-spin text-[#818CF8]" />
            <p className="text-xs text-[#64748B]">Loading document...</p>
          </div>
        )}
        {!iframeError ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            className="w-full h-full border-none bg-[#0B0F14] block"
            title={resource.title}
            allow="autoplay"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setIframeError(true)
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-4">
            <FileText size={48} className="text-[#1E2A36]" />
            <p className="text-sm text-[#64748B]">This content cannot be previewed directly.</p>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#818CF8] rounded-xl text-sm transition-colors font-medium"
            >
              <ExternalLink size={15} /> Open in new tab
            </a>
          </div>
        )}
      </div>
    </FullscreenViewer>
  )
}

// ── Note Fullscreen Viewer ────────────────────────────────────────────

function NoteViewerModal({
  resource,
  onClose,
  onEdit,
}: {
  resource: ChapterResource
  onClose: () => void
  onEdit?: () => void
}) {
  const [zoom, setZoom] = useState<number>(100)
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false)

  const html = resource.htmlContent
    ? sanitizeHtml(resource.htmlContent)
    : `<pre style="color:#CBD5E1;white-space:pre-wrap;font-size:14px;line-height:1.8;font-family:monospace">${resource.rawContent ?? ''}</pre>`

  const handleZoomIn = () => {
    setZoom((z) => Math.min(200, z >= 130 ? z + 20 : z + 15))
  }

  const handleZoomOut = () => {
    setZoom((z) => Math.max(75, z > 130 ? z - 20 : z - 15))
  }

  return (
    <FullscreenViewer
      title={resource.title}
      type={resource.type}
      onClose={onClose}
      extraAction={
        <div className="flex items-center gap-1 sm:gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 text-xs text-[#818CF8] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/30 px-2 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              title="Edit or Polish note"
            >
              <Sparkles size={12} className="text-[#818CF8]" />
              <span className="hidden sm:inline">Edit / Polish</span>
            </button>
          )}

          {/* Zoom controls with Magnifying Glass */}
          <div className="flex items-center bg-[#17202A] border border-[#1E2A36] rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 75}
              className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="flex items-center gap-0.5 px-1 sm:px-1.5 text-[11px] font-mono text-[#818CF8] hover:text-[#A5B4FC] transition-colors cursor-pointer"
              title="Reset Zoom to 100%"
            >
              <Search size={10} className="text-[#818CF8]/70 hidden sm:inline" />
              <span>{zoom}%</span>
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Full Page Width / Fit Column toggle */}
          <button
            onClick={() => setIsFullWidth((w) => !w)}
            className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] px-2 py-1 rounded-lg transition-colors cursor-pointer"
            title={isFullWidth ? 'Switch to Standard Reading Width' : 'Expand to Full Page Width'}
          >
            {isFullWidth ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden md:inline">{isFullWidth ? 'Fit Column' : 'Full Page'}</span>
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col relative bg-[#080C12]">
        {/* Note Content - 100000% Mobile responsive with pure native scroll (0 lag) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full overscroll-contain">
          <div
            className={`mx-auto w-full transition-all duration-150 ${
              isFullWidth
                ? 'max-w-none px-3 sm:px-8 md:px-12'
                : 'max-w-4xl px-3 sm:px-6 md:px-10'
            } py-4 sm:py-8 selection:bg-[#6366F1]/30`}
            style={{
              zoom: `${zoom}%`,
              fontSize: `${Math.round(15 * (zoom / 100))}px`,
            }}
          >
            {!resource.htmlContent && (
              <div className="mb-6 p-4 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-[#FDE68A]">
                  <Sparkles size={16} className="shrink-0 text-[#F59E0B] mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-[#F59E0B]">সাধারণ টেক্সট নোট (Plain Text)</p>
                    <p className="text-[#CBD5E1] mt-0.5">এই নোটটি সাধারণ টেক্সট হিসেবে সংরক্ষিত। বাংলায় সুন্দর রিভিশন গাইড ও ফর্মুলা কার্ড তৈরি করতে AI দিয়ে পলিশ করে নিন।</p>
                  </div>
                </div>
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F59E0B] text-[#0B0F14] text-xs font-bold hover:bg-[#FBBF24] transition-all shadow-lg shadow-[#F59E0B]/20 cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>✨ AI দিয়ে পলিশ করুন</span>
                  </button>
                )}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>
    </FullscreenViewer>
  )
}

// ── Resource Form Modal ───────────────────────────────────────────────

function ResourceFormModal({
  initial,
  onSave,
  onClose,
  subjectName,
  chapterName,
}: {
  initial?: ChapterResource
  onSave: (r: ChapterResource) => void
  onClose: () => void
  subjectName?: string
  chapterName?: string
}) {
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [type, setType]             = useState<ChapterResourceType>(initial?.type ?? 'note')
  const [url, setUrl]               = useState(initial?.url ?? '')
  const [rawContent, setRawContent] = useState(initial?.rawContent ?? '')
  const [previewHtml, setPreviewHtml] = useState<string | null>(initial?.htmlContent ?? null)
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishProgress, setPolishProgress] = useState(0)
  const [polishError, setPolishError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(!!initial?.htmlContent)

  const handlePolish = async () => {
    if (!rawContent.trim()) return
    setIsPolishing(true)
    setPolishProgress(0)
    setPolishError(null)
    const result = await callPolishNote(
      rawContent,
      subjectName,
      chapterName,
      (streamed) => {
        setPolishProgress(streamed.length)
      }
    )
    if ('error' in result) {
      setPolishError(result.error)
    } else {
      setPreviewHtml(result.html)
      setShowPreview(true)
    }
    setIsPolishing(false)
    setPolishProgress(0)
  }

  const canSave = title.trim() && (
    (type !== 'note' && url.trim() && isValidUrl(url)) ||
    (type === 'note' && rawContent.trim())
  )

  const handleSave = (useRaw = false) => {
    if (!canSave) return
    const resource: ChapterResource = {
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      type,
      createdAt: initial?.createdAt ?? Date.now(),
      ...(type === 'note'
        ? {
            rawContent: rawContent.trim(),
            htmlContent: (!useRaw && previewHtml) ? sanitizeHtml(previewHtml) : undefined,
          }
        : { url: url.trim() }),
    }
    onSave(resource)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={initial ? 'Edit Resource' : 'Add Resource'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Academic context badge */}
        {subjectName && (
          <div className="flex items-center gap-1.5 text-xs text-[#818CF8] bg-[#6366F1]/10 border border-[#6366F1]/20 px-3 py-1.5 rounded-xl w-fit">
            <BookOpen size={13} className="text-[#818CF8]" />
            <span className="font-semibold">{subjectName}</span>
            {chapterName && <span className="text-[#94A3B8]">/ {chapterName}</span>}
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#94A3B8]">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Quick Revision Notes, Chapter PDF..."
            className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
          />
        </div>

        {/* Type selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#94A3B8]">Resource Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['note', 'pdf', 'link'] as ChapterResourceType[]).map((t) => {
              const cfg = TYPE_CONFIG[t]
              const active = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'border-[#6366F1] bg-[#6366F1]/15 text-[#F8FAFC]'
                      : 'border-[#1E2A36] bg-[#111820] text-[#64748B] hover:text-[#94A3B8] hover:border-[#2D3A4A]'
                  }`}
                >
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* URL input for PDF / Link */}
        {type !== 'note' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8]">
              {type === 'pdf' ? 'PDF URL (Google Drive preview or direct link)' : 'URL'}
            </label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === 'pdf'
                    ? 'https://drive.google.com/file/d/.../view or https://...file.pdf'
                    : 'https://...'
                }
                className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2.5 pr-8 text-sm text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
              {url && isValidUrl(url) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#818CF8]"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            {url && !isValidUrl(url) && (
              <p className="text-[10px] text-[#EF4444]">Please enter a valid URL (https://...)</p>
            )}
          </div>
        )}

        {/* Note content */}
        {type === 'note' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">
                Content <span className="text-[#475569] font-normal">(plain text or markdown)</span>
              </label>
              <textarea
                value={rawContent}
                onChange={(e) => { setRawContent(e.target.value); setShowPreview(false) }}
                placeholder={`Paste your notes here...\n\n## Mole Concept\n1 mole = 6.022 × 10²³ particles (Avogadro's Number)\nFormula: n = m / M\n\nImportant: This is always tested in exams!`}
                className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#475569] resize-none focus:outline-none focus:ring-1 focus:ring-[#6366F1] h-40 font-mono"
              />
              <p className="text-[10px] text-[#475569]">
                {rawContent.length.toLocaleString()} / 25,000 characters
              </p>
            </div>

            {polishError && (
              <div className="flex items-start gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{polishError}</span>
              </div>
            )}

            {/* AI polish actions */}
            {!showPreview && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handlePolish}
                  isLoading={isPolishing}
                  disabled={!rawContent.trim() || rawContent.length > 25000}
                  leftIcon={<Sparkles size={13} />}
                >
                  {isPolishing
                    ? (polishProgress > 0
                        ? `AI লিখছে... (${polishProgress.toLocaleString()} অক্ষর)`
                        : 'AI প্রস্তুত হচ্ছে...')
                    : '✨ Polish with AI (বাংলায় সাজান)'}
                </Button>
              </div>
            )}

            {/* Preview */}
            {showPreview && previewHtml && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#34D399] flex items-center gap-1.5">
                    <Sparkles size={12} /> AI Preview
                  </span>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-xs text-[#64748B] hover:text-[#94A3B8] flex items-center gap-1 cursor-pointer"
                  >
                    <X size={11} /> Edit & Re-polish
                  </button>
                </div>
                <div
                  className="bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-4 max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#1E2A36]">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex items-center gap-2">
            {type === 'note' && !showPreview && rawContent.trim() && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={!title.trim() || isPolishing}
              >
                Save as-is
              </Button>
            )}
            {(type !== 'note' || showPreview) && (
              <Button
                onClick={() => handleSave(false)}
                disabled={!canSave}
              >
                {initial ? 'Save Changes' : 'Add Resource'}
              </Button>
            )}
            {type === 'note' && showPreview && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setShowPreview(false); setPreviewHtml(null) }}
              >
                Re-polish
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Delete Warning Modal (Move to Trash) ──────────────────────────────

function DeleteWarningModal({
  resource,
  onConfirm,
  onClose,
  isDeleting,
}: {
  resource: ChapterResource
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}) {
  const [confirmed, setConfirmed] = useState(false)
  const cfg = TYPE_CONFIG[resource.type]

  return (
    <Modal isOpen onClose={onClose} title="Move to Trash?" maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Warning box */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444]">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-[#F8FAFC]">Are you sure you want to delete this {cfg.label}?</p>
            <p className="text-[#94A3B8] leading-relaxed">
              This item will be removed from this chapter and safely moved to <strong className="text-[#F8FAFC]">Settings &gt; Trash</strong>. You can restore it anytime or delete it permanently from there.
            </p>
          </div>
        </div>

        {/* Resource preview card */}
        <div className="p-3 rounded-xl bg-[#111820] border border-[#1E2A36] flex items-center gap-2.5">
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs"
            style={{ background: `${cfg.color}18`, color: cfg.color }}
          >
            {cfg.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#F8FAFC] truncate">{resource.title}</p>
            <span className="text-[10px] text-[#64748B]">{cfg.label}</span>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#17202A] border border-[#1E2A36] cursor-pointer hover:border-[#2D3A4A] transition-colors">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-[#EF4444] cursor-pointer shrink-0"
          />
          <span className="text-xs text-[#CBD5E1] leading-relaxed select-none">
            I understand and confirm that I want to move this note to Trash.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1E2A36]">
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!confirmed || isDeleting}
            isLoading={isDeleting}
            leftIcon={<Trash2 size={13} />}
          >
            Move to Trash
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main ResourcesSection ─────────────────────────────────────────────

interface ResourcesSectionProps {
  chapterId: string
  resources: ChapterResource[]
  isAdmin: boolean
  onResourcesChange: (updated: ChapterResource[]) => void
  subjectId?: string
  subjectName?: string
  chapterName?: string
}

export default function ResourcesSection({
  chapterId,
  resources,
  isAdmin,
  onResourcesChange,
  subjectId,
  subjectName,
  chapterName,
}: ResourcesSectionProps) {
  const { user } = useAuth()
  const [isExpanded, setIsExpanded]           = useState(true)
  const [showForm, setShowForm]               = useState(false)
  const [editingResource, setEditingResource] = useState<ChapterResource | null>(null)
  const [deletingResource, setDeletingResource] = useState<ChapterResource | null>(null)
  const [isDeleting, setIsDeleting]           = useState(false)
  const [viewingNote, setViewingNote]         = useState<ChapterResource | null>(null)
  const [viewingEmbed, setViewingEmbed]       = useState<ChapterResource | null>(null)

  if (!isAdmin && resources.length === 0) return null

  const handleSave = (r: ChapterResource) => {
    if (editingResource) {
      onResourcesChange(resources.map((x) => (x.id === r.id ? r : x)))
    } else {
      onResourcesChange([...resources, r])
    }
    setShowForm(false)
    setEditingResource(null)
  }

  const handleConfirmDelete = async () => {
    if (!deletingResource) return
    setIsDeleting(true)
    try {
      if (user) {
        await moveToTrash(user.uid, {
          originalId: deletingResource.id,
          type: 'resource',
          title: deletingResource.title,
          resourceType: deletingResource.type,
          subjectId,
          subjectName,
          chapterId,
          chapterName,
          ...(deletingResource.url ? { url: deletingResource.url } : {}),
          ...(deletingResource.rawContent ? { rawContent: deletingResource.rawContent } : {}),
          ...(deletingResource.htmlContent ? { htmlContent: deletingResource.htmlContent } : {}),
          createdAt: deletingResource.createdAt,
        })
      }
      onResourcesChange(resources.filter((r) => r.id !== deletingResource.id))
      setDeletingResource(null)
    } catch (err) {
      console.error('Error moving resource to trash:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCardClick = (r: ChapterResource) => {
    if (r.type === 'note') {
      setViewingNote(r)
    } else if (r.url) {
      setViewingEmbed(r)
    }
  }

  return (
    <>
      {/* Section header */}
      <div className="bg-[#0D1520] border border-[#1E2A36] rounded-2xl overflow-hidden">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#111820]/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="text-[#818CF8]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">Resources</span>
            {resources.length > 0 && (
              <span className="text-xs bg-[#6366F1]/15 text-[#818CF8] px-2 py-0.5 rounded-full font-medium">
                {resources.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditingResource(null); setShowForm(true) }}
                className="flex items-center gap-1.5 text-xs text-[#6366F1] hover:text-[#818CF8] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                <Plus size={12} /> Add Resource
              </button>
            )}
            {isExpanded ? <ChevronUp size={15} className="text-[#475569]" /> : <ChevronDown size={15} className="text-[#475569]" />}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-[#1E2A36] px-5 py-4">
            {resources.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen size={24} className="mx-auto text-[#1E2A36] mb-2" />
                <p className="text-xs text-[#475569]">
                  {isAdmin ? 'No resources yet. Add PDFs, links, or AI-polished notes.' : 'No resources available for this chapter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resources.map((r) => {
                  const cfg = TYPE_CONFIG[r.type]
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleCardClick(r)}
                      className="group relative flex items-start gap-3 bg-[#111820] hover:bg-[#17202A] border border-[#1E2A36] hover:border-[#2D3A4A] rounded-xl p-3.5 cursor-pointer transition-all"
                    >
                      {/* Icon */}
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                        style={{ background: `${cfg.color}18`, color: cfg.color }}
                      >
                        {cfg.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F1F5F9] truncate leading-tight">{r.title}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cfg.color}18`, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          {r.htmlContent && (
                            <span className="text-[10px] text-[#34D399] flex items-center gap-0.5">
                              <Sparkles size={9} /> AI
                            </span>
                          )}
                          {r.type === 'note' && !r.htmlContent && (
                            <span className="text-[10px] text-[#94A3B8] bg-[#1E2A36] px-1.5 py-0.5 rounded-full font-medium">
                              Raw Note
                            </span>
                          )}
                          {r.type !== 'note' && (
                            <ExternalLink size={10} className="text-[#475569]" />
                          )}
                        </div>
                      </div>

                      {/* Admin actions */}
                      {isAdmin && (
                        <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingResource(r); setShowForm(true) }}
                            className="p-1 rounded-lg bg-[#1E2A36] text-[#64748B] hover:text-[#818CF8] transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingResource(r) }}
                            className="p-1 rounded-lg bg-[#1E2A36] text-[#64748B] hover:text-[#EF4444] transition-colors cursor-pointer"
                            title="Delete (Move to Trash)"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ResourceFormModal
          initial={editingResource ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingResource(null) }}
          subjectName={subjectName}
          chapterName={chapterName}
        />
      )}

      {deletingResource && (
        <DeleteWarningModal
          resource={deletingResource}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingResource(null)}
          isDeleting={isDeleting}
        />
      )}

      {viewingNote && (
        <NoteViewerModal
          resource={viewingNote}
          onClose={() => setViewingNote(null)}
          onEdit={isAdmin ? () => {
            const r = viewingNote
            setViewingNote(null)
            setEditingResource(r)
            setShowForm(true)
          } : undefined}
        />
      )}

      {viewingEmbed && (
        <EmbedViewerModal
          resource={viewingEmbed}
          onClose={() => setViewingEmbed(null)}
        />
      )}
    </>
  )
}
