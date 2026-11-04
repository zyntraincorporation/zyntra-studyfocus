import { useEffect, useState } from 'react'
import { FileText, FolderOpen, X, ExternalLink, Maximize, Minimize, Loader2, RefreshCw, List, Grid } from 'lucide-react'
import { toSlideEmbedUrl } from '@/utils/embed.utils'
import { isDriveFolderUrl, toDriveFolderEmbedUrl } from '@/utils/drive.utils'

interface DocumentPreviewModalProps {
  url: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClose: () => void
}

export default function DocumentPreviewModal({
  url,
  title,
  subtitle,
  icon,
  onClose,
}: DocumentPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [useGoogleViewer, setUseGoogleViewer] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [folderLayout, setFolderLayout] = useState<'list' | 'grid'>('list')
  const [iframeKey, setIframeKey] = useState(0)

  const isDriveFolder = isDriveFolderUrl(url)
  const isPdf = /\.pdf($|[?#])/i.test(url)
  const isDrive = url.includes('drive.google.com') || url.includes('docs.google.com')
  const embedUrl = isDriveFolder
    ? toDriveFolderEmbedUrl(url, folderLayout)
    : toSlideEmbedUrl(url, useGoogleViewer)

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = async () => {
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

  const handleSwitchEngine = () => {
    setUseGoogleViewer((prev) => !prev)
    setIsLoading(true)
    setHasError(false)
  }

  const handleRetry = () => {
    setIframeKey((k) => k + 1)
    setIsLoading(true)
    setHasError(false)
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Document Preview"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-[#0B0F14] border-b border-[#1E2A36] shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">
            {icon || (isDriveFolder ? <FolderOpen size={16} className="text-[#F59E0B]" /> : <FileText size={16} className="text-[#818CF8]" />)}
          </span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-[#F8FAFC] truncate max-w-[200px] sm:max-w-md">
              {title}
            </p>
            {(subtitle || isDriveFolder) && (
              <p className="text-[10px] text-[#64748B] truncate max-w-[200px] sm:max-w-md">
                {subtitle || (isDriveFolder ? 'Google Drive Folder' : '')}
              </p>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* List vs Grid switch for Drive Folders */}
          {isDriveFolder && (
            <div className="flex items-center bg-[#111820] border border-[#1E2A36] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setFolderLayout('list')
                  setIsLoading(true)
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                  folderLayout === 'list' ? 'bg-[#1E2A36] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
                title="List view"
              >
                <List size={13} />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFolderLayout('grid')
                  setIsLoading(true)
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                  folderLayout === 'grid' ? 'bg-[#1E2A36] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
                title="Grid view"
              >
                <Grid size={13} />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          )}

          {/* Engine switcher for direct PDFs */}
          {isPdf && !isDrive && (
            <button
              onClick={handleSwitchEngine}
              className="text-[11px] sm:text-xs text-[#818CF8] hover:text-[#A5B4FC] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 px-2 sm:px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Switch PDF viewer engine"
            >
              {useGoogleViewer ? 'Direct View' : 'Google Viewer'}
            </button>
          )}

          {/* Reload button */}
          <button
            type="button"
            onClick={handleRetry}
            className="p-1 sm:px-2 sm:py-1 flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] rounded-lg transition-colors cursor-pointer"
            title="Reload content"
          >
            <RefreshCw size={13} />
          </button>

          {/* Open in new tab button - ALWAYS available */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] sm:text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] px-2 sm:px-2.5 py-1 rounded-lg transition-colors"
            title="Open in new browser tab"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Open in Tab</span>
          </a>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="p-1 sm:px-2 sm:py-1 flex items-center gap-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] transition-colors cursor-pointer shrink-0 ml-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Modal Content Body */}
      <div className="flex-1 relative bg-[#080C12] overflow-hidden" style={{ minHeight: 0 }}>
        {/* Loading Spinner */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080C12] z-10">
            <Loader2 size={32} className="animate-spin text-[#818CF8]" />
            <p className="text-xs text-[#94A3B8]">{isDriveFolder ? 'Loading folder...' : 'Loading document...'}</p>
          </div>
        )}

        {/* Error Fallback */}
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#080C12] z-20">
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center mb-3">
              {isDriveFolder ? <FolderOpen size={22} /> : <FileText size={22} />}
            </div>
            <p className="text-sm font-semibold text-[#F8FAFC] mb-1">
              {isDriveFolder ? 'Drive Folder could not be embedded directly' : 'Document could not be embedded directly'}
            </p>
            <p className="text-xs text-[#64748B] max-w-sm mb-4">
              Google Drive or the host server may restrict in-app preview due to folder permissions or browser privacy settings.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5] px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#6366F1]/20"
              >
                <ExternalLink size={13} /> Open in New Tab
              </a>
              {isPdf && !isDrive && (
                <button
                  onClick={handleSwitchEngine}
                  className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white bg-[#17202A] hover:bg-[#1E2A36] border border-[#1E2A36] px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} /> Try Alternate Viewer
                </button>
              )}
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white bg-[#17202A] hover:bg-[#1E2A36] border border-[#1E2A36] px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          </div>
        ) : (
          <iframe
            key={`${embedUrl}-${iframeKey}`}
            src={embedUrl}
            title={title}
            allow="autoplay; fullscreen"
            loading="eager"
            className="w-full h-full border-none block bg-[#080C12]"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        )}
      </div>
    </div>
  )
}
