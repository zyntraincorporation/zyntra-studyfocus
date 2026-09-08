import { useState } from 'react'
import DOMPurify from 'dompurify'
import {
  Plus, Trash2, ExternalLink, FileText, Link2, BookOpen,
  Sparkles, Loader2, ChevronDown, ChevronUp, Pencil, AlertCircle, X
} from 'lucide-react'
import type { ChapterResource, ChapterResourceType } from '@/types/curriculum.types'
import { callPolishNote } from '@/services/note-polish.service'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

// ── Helpers ───────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
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
}

const TYPE_CONFIG: Record<ChapterResourceType, { icon: React.ReactNode; label: string; color: string }> = {
  pdf:  { icon: <FileText size={14} />,  label: 'PDF',  color: '#EF4444' },
  link: { icon: <Link2 size={14} />,     label: 'Link', color: '#38BDF8' },
  note: { icon: <BookOpen size={14} />,  label: 'Note', color: '#34D399' },
}

// ── Note Viewer Modal ─────────────────────────────────────────────────

function NoteViewerModal({
  resource,
  onClose,
}: {
  resource: ChapterResource
  onClose: () => void
}) {
  const html = resource.htmlContent
    ? sanitizeHtml(resource.htmlContent)
    : `<pre style="color:#CBD5E1;white-space:pre-wrap;font-size:13px;line-height:1.7">${resource.rawContent ?? ''}</pre>`

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={resource.title}
      maxWidth="max-w-3xl"
    >
      <div
        className="overflow-y-auto max-h-[70vh] pr-1"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Modal>
  )
}

// ── Resource Form Modal ───────────────────────────────────────────────

function ResourceFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: ChapterResource
  onSave: (r: ChapterResource) => void
  onClose: () => void
}) {
  const [title, setTitle]           = useState(initial?.title ?? '')
  const [type, setType]             = useState<ChapterResourceType>(initial?.type ?? 'note')
  const [url, setUrl]               = useState(initial?.url ?? '')
  const [rawContent, setRawContent] = useState(initial?.rawContent ?? '')
  const [previewHtml, setPreviewHtml] = useState<string | null>(initial?.htmlContent ?? null)
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishError, setPolishError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(!!initial?.htmlContent)

  const handlePolish = async () => {
    if (!rawContent.trim()) return
    setIsPolishing(true)
    setPolishError(null)
    const result = await callPolishNote(rawContent)
    if ('error' in result) {
      setPolishError(result.error)
    } else {
      setPreviewHtml(result.html)
      setShowPreview(true)
    }
    setIsPolishing(false)
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
          <label className="text-xs font-medium text-[#94A3B8]">Type</label>
          <div className="flex gap-2">
            {(['note', 'pdf', 'link'] as ChapterResourceType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  type === t
                    ? 'bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/40'
                    : 'bg-[#17202A] text-[#64748B] border border-[#1E2A36] hover:text-[#94A3B8]'
                }`}
              >
                {TYPE_CONFIG[t].icon}
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>

        {/* URL field for pdf/link */}
        {type !== 'note' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8]">URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className={`flex-1 bg-[#111820] border rounded-xl px-3 py-2.5 text-sm text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-1 focus:ring-[#6366F1] ${
                  url && !isValidUrl(url) ? 'border-[#EF4444]/50' : 'border-[#1E2A36]'
                }`}
              />
              {url && isValidUrl(url) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3 rounded-xl bg-[#17202A] border border-[#1E2A36] text-[#64748B] hover:text-[#818CF8] transition-colors"
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
                {rawContent.length.toLocaleString()} / 8,000 characters
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
                  disabled={!rawContent.trim() || rawContent.length > 8000}
                  leftIcon={<Sparkles size={13} />}
                >
                  {isPolishing ? 'Polishing...' : '✨ Polish with AI'}
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
                disabled={!title.trim()}
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

// ── Main ResourcesSection ─────────────────────────────────────────────

interface ResourcesSectionProps {
  chapterId: string
  resources: ChapterResource[]
  isAdmin: boolean
  onResourcesChange: (updated: ChapterResource[]) => void
}

export default function ResourcesSection({
  resources,
  isAdmin,
  onResourcesChange,
}: ResourcesSectionProps) {
  const [isExpanded, setIsExpanded]     = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editingResource, setEditingResource] = useState<ChapterResource | null>(null)
  const [viewingNote, setViewingNote]   = useState<ChapterResource | null>(null)

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

  const handleDelete = (id: string) => {
    onResourcesChange(resources.filter((r) => r.id !== id))
  }

  const handleCardClick = (r: ChapterResource) => {
    if (r.type === 'note') {
      setViewingNote(r)
    } else if (r.url) {
      window.open(r.url, '_blank', 'noopener,noreferrer')
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
                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                            className="p-1 rounded-lg bg-[#1E2A36] text-[#64748B] hover:text-[#EF4444] transition-colors cursor-pointer"
                            title="Delete"
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
        />
      )}

      {viewingNote && (
        <NoteViewerModal
          resource={viewingNote}
          onClose={() => setViewingNote(null)}
        />
      )}
    </>
  )
}
