import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ChevronLeft, Play,
  CheckCircle2, Star, Loader2, AlertCircle, CheckCircle,
  Sparkles, Clock, Paperclip, ExternalLink, GripVertical, FileText,
} from 'lucide-react'
import {
  getSubject,
  getChapter,
  getLectures,
  createLecture,
  updateLecture,
  deleteLecture,
  toggleImportant,
} from '@/services/curriculum.service'
import { fetchYouTubeMetadata } from '@/services/youtube.service'
import type { Subject, Chapter, Lecture, LectureTimestamp, LectureAttachment, AttachmentType } from '@/types/curriculum.types'
import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { getThumbnailUrl } from '@/utils/youtube.utils'
import { SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { useProgressStats } from '@/hooks/useProgressStats'
import { formatDuration } from '@/utils/time.utils'
import { MAX_ATTACHMENTS } from '@/constants/firebase'

// ── Helpers ───────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
}

function newAttachment(): LectureAttachment {
  return { id: crypto.randomUUID(), title: '', url: '', type: 'other' }
}

async function callCleanTimestamps(
  rawText: string,
  videoDurationSeconds?: number
): Promise<{ timestamps: LectureTimestamp[] } | { error: string }> {
  try {
    const res = await fetch('/.netlify/functions/clean-timestamps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, videoDurationSeconds }),
    })
    return await res.json()
  } catch {
    return { error: 'Network error — could not reach the AI service.' }
  }
}

// Simple client-side raw timestamp parser (regex-based fallback)
function parseRawTimestamps(raw: string): LectureTimestamp[] {
  const results: LectureTimestamp[] = []
  const lines = raw.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    // Match: HH:MM:SS, MM:SS, M:SS, H.MM.SS, "X min Y sec", plain seconds
    const m =
      line.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(.+)$/) ||
      line.match(/^(\d{1,2}):(\d{2})\s+(.+)$/) ||
      line.match(/^(\d{1,2})\.(\d{2})\s+(.+)$/)

    if (m && m.length >= 4) {
      let secs = 0
      if (m.length === 5) {
        // HH:MM:SS
        secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
        const label = m[4].trim()
        if (label) results.push({ time: secs, label })
      } else {
        // MM:SS or MM.SS
        secs = parseInt(m[1]) * 60 + parseInt(m[2])
        const label = m[3].trim()
        if (label) results.push({ time: secs, label })
      }
      continue
    }
    // "X min Y sec" or "X min" style
    const minSec = line.match(/^(\d+)\s*min(?:ute)?s?\s*(?:(\d+)\s*sec(?:ond)?s?)?\s+(.+)$/i)
    if (minSec) {
      const secs = parseInt(minSec[1]) * 60 + (parseInt(minSec[2] ?? '0') || 0)
      const label = minSec[3].trim()
      if (label) results.push({ time: secs, label })
    }
  }
  return results.sort((a, b) => a.time - b.time)
}

// ── Editable timestamp row ────────────────────────────────────────────
function TimestampRow({
  ts, onChange, onDelete,
}: {
  ts: LectureTimestamp
  onChange: (updated: LectureTimestamp) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <GripVertical size={14} className="text-[#475569] shrink-0 cursor-grab" />
      <input
        type="text"
        value={formatDuration(ts.time)}
        readOnly
        className="w-20 bg-[#17202A] border border-[#1E2A36] rounded-lg px-2 py-1 text-xs font-mono text-[#818CF8] focus:outline-none text-center shrink-0"
        title="Timestamp (seconds)"
      />
      <input
        type="text"
        value={ts.label}
        onChange={(e) => onChange({ ...ts, label: e.target.value })}
        placeholder="Label"
        className="flex-1 bg-[#111820] border border-[#1E2A36] rounded-lg px-2 py-1 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
      />
      <button
        onClick={onDelete}
        className="p-1 rounded text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer transition-colors shrink-0"
        title="Remove timestamp"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Attachment row ────────────────────────────────────────────────────
function AttachmentRow({
  att, onChange, onDelete,
}: {
  att: LectureAttachment
  onChange: (updated: LectureAttachment) => void
  onDelete: () => void
}) {
  const types: AttachmentType[] = ['slides', 'pdf', 'notes', 'other']
  return (
    <div className="bg-[#17202A] border border-[#1E2A36] rounded-xl p-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={att.title}
          onChange={(e) => onChange({ ...att, title: e.target.value })}
          placeholder="Title (e.g. Lecture Slides)"
          className="flex-1 bg-[#111820] border border-[#1E2A36] rounded-lg px-2 py-1.5 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
        />
        <select
          value={att.type ?? 'other'}
          onChange={(e) => onChange({ ...att, type: e.target.value as AttachmentType })}
          className="bg-[#111820] border border-[#1E2A36] rounded-lg px-2 py-1.5 text-xs text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
        >
          {types.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer transition-colors shrink-0"
          title="Remove attachment"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={att.url}
          onChange={(e) => onChange({ ...att, url: e.target.value })}
          placeholder="https://drive.google.com/..."
          className={`flex-1 bg-[#111820] border rounded-lg px-2 py-1.5 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#6366F1] ${
            att.url && !isValidUrl(att.url) ? 'border-[#EF4444]/50' : 'border-[#1E2A36]'
          }`}
        />
        {att.url && isValidUrl(att.url) && (
          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#64748B] hover:text-[#818CF8] transition-colors shrink-0">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      {att.url && !isValidUrl(att.url) && (
        <p className="text-[10px] text-[#EF4444]">Please enter a valid URL (e.g. https://...)</p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

export default function ChapterDetailPage() {
  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>()
  const { user } = useAuth()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lecture | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // YouTube import
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    videoId: string; channelName: string; thumbnailUrl: string;
    duration: number; durationFormatted: string; youtubeUrl: string
  } | null>(null)
  const [lectureTitle, setLectureTitle] = useState('')
  const [slideUrl, setSlideUrl] = useState('')

  // ── Timestamps state ──────────────────────────────────────────────
  const [rawTimestamps, setRawTimestamps] = useState('')
  const [timestamps, setTimestamps] = useState<LectureTimestamp[]>([])
  const [isCleaningAI, setIsCleaningAI] = useState(false)
  const [aiTimestampError, setAiTimestampError] = useState<string | null>(null)
  const [showTimestampRaw, setShowTimestampRaw] = useState(true)

  // ── Attachments state ─────────────────────────────────────────────
  const [attachments, setAttachments] = useState<LectureAttachment[]>([])

  const { isLectureCompleted, getLectureProgress } = useProgressStats()

  const reload = useCallback(async () => {
    if (!user || !subjectId || !chapterId) return
    const [sub, chap, lecs] = await Promise.all([
      getSubject(user.uid, subjectId),
      getChapter(user.uid, chapterId),
      getLectures(user.uid, chapterId),
    ])
    setSubject(sub)
    setChapter(chap)
    setLectures(lecs)
    setIsLoading(false)
  }, [user, subjectId, chapterId])

  useEffect(() => { reload() }, [reload])

  const resetForm = () => {
    setEditingLecture(null)
    setPreview(null)
    setLectureTitle('')
    setSlideUrl('')
    setYoutubeUrl('')
    setFetchError(null)
    setRawTimestamps('')
    setTimestamps([])
    setAiTimestampError(null)
    setShowTimestampRaw(true)
    setAttachments([])
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (l: Lecture) => {
    resetForm()
    setEditingLecture(l)
    setLectureTitle(l.title)
    setSlideUrl(l.slideUrl || '')
    setTimestamps(l.timestamps ?? [])
    setAttachments(l.attachments ?? [])
    setShowTimestampRaw(false)  // show editable list when editing existing lecture
    setShowForm(true)
  }

  // ── YouTube fetch ─────────────────────────────────────────────────
  const handleFetch = async () => {
    if (!youtubeUrl.trim()) return
    setIsFetching(true); setFetchError(null); setPreview(null)
    const result = await fetchYouTubeMetadata(youtubeUrl)
    if (result.success) {
      setPreview({
        videoId: result.data.videoId,
        channelName: result.data.channelName,
        thumbnailUrl: result.data.thumbnailUrl,
        duration: result.data.duration,
        durationFormatted: result.data.durationFormatted,
        youtubeUrl: result.data.youtubeUrl,
      })
      setLectureTitle(result.data.title)
    } else {
      setFetchError(result.error)
    }
    setIsFetching(false)
  }

  // ── AI timestamp clean ────────────────────────────────────────────
  const handleCleanWithAI = async () => {
    if (!rawTimestamps.trim()) return
    setIsCleaningAI(true)
    setAiTimestampError(null)
    const videoDuration = preview?.duration ?? editingLecture?.duration
    const result = await callCleanTimestamps(rawTimestamps, videoDuration)
    if ('error' in result) {
      setAiTimestampError(result.error)
    } else {
      setTimestamps(result.timestamps)
      setShowTimestampRaw(false)
    }
    setIsCleaningAI(false)
  }

  const handleParseManually = () => {
    const parsed = parseRawTimestamps(rawTimestamps)
    setTimestamps(parsed)
    setAiTimestampError(null)
    setShowTimestampRaw(false)
  }

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !subject || !chapter) return
    if (!lectureTitle.trim()) return

    // Validate attachments
    const validAttachments = attachments.filter((a) => a.title.trim() && a.url.trim() && isValidUrl(a.url))

    setIsSubmitting(true)
    if (editingLecture) {
      await updateLecture(user.uid, editingLecture.id, {
        title: lectureTitle,
        slideUrl: slideUrl.trim() || '',
        timestamps: timestamps.length > 0 ? timestamps : [],
        attachments: validAttachments.length > 0 ? validAttachments : [],
      })
    } else {
      if (!preview) return
      await createLecture(
        user.uid,
        {
          title: lectureTitle,
          youtubeVideoId: preview.videoId,
          youtubeUrl: preview.youtubeUrl,
          thumbnailUrl: preview.thumbnailUrl,
          duration: preview.duration,
          durationFormatted: preview.durationFormatted,
          channelName: preview.channelName,
          description: '',
          chapterId: chapter.id,
          chapterName: chapter.name,
          subjectId: subject.id,
          subjectName: subject.name,
          ...(slideUrl.trim() ? { slideUrl: slideUrl.trim() } : {}),
          ...(timestamps.length > 0 ? { timestamps } : {}),
          ...(validAttachments.length > 0 ? { attachments: validAttachments } : {}),
        },
        lectures.length
      )
    }
    setShowForm(false)
    setIsSubmitting(false)
    reload()
  }

  const handleDelete = async () => {
    if (!user || !deleteTarget || !subject || !chapter) return
    setIsSubmitting(true)
    await deleteLecture(user.uid, deleteTarget.id, chapter.id, subject.id)
    setDeleteTarget(null)
    setIsSubmitting(false)
    reload()
  }

  const handleToggleImportant = async (l: Lecture) => {
    if (!user) return
    await toggleImportant(user.uid, l.id, l.isImportant)
    reload()
  }

  if (isLoading) return <SkeletonList count={5} />
  if (!chapter || !subject) return <div className="text-[#64748B]">Chapter not found.</div>

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#64748B] flex-wrap">
        <Link to={ROUTES.SUBJECTS} className="hover:text-[#F8FAFC]">My Subjects</Link>
        <span>/</span>
        <Link to={buildRoute(ROUTES.SUBJECT, { subjectId: subject.id })} className="hover:text-[#F8FAFC]">
          {subject.name}
        </Link>
        <span>/</span>
        <span className="text-[#94A3B8]">{chapter.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#F8FAFC]">{chapter.name}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{lectures.length} lectures</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Lecture</Button>
      </div>

      {/* Lecture list */}
      {lectures.length === 0 ? (
        <EmptyState
          icon={<Play size={36} />}
          title="No lectures yet"
          description="Add a YouTube lecture to get started."
          action={<Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Lecture</Button>}
        />
      ) : (
        <div className="space-y-2">
          {lectures.map((l, idx) => {
            const completed = isLectureCompleted(l.id)
            const progress = getLectureProgress(l.id)
            const hasAtt = (l.attachments?.length ?? 0) > 0
            const hasTs = (l.timestamps?.length ?? 0) > 0
            return (
              <div
                key={l.id}
                className="group flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl hover:border-[#6366F1]/40 transition-all overflow-hidden"
              >
                {/* Clickable area: number + thumbnail + info → navigate to watch */}
                <Link
                  to={buildRoute(ROUTES.WATCH, { lectureId: l.id })}
                  className="flex items-center gap-3 flex-1 min-w-0 p-3 pr-1"
                >
                  {/* Number + completion */}
                  <div className="w-8 shrink-0 flex flex-col items-center gap-1">
                    <span className="text-xs font-mono text-[#475569]">{String(idx + 1).padStart(2, '0')}</span>
                    {completed ? (
                      <CheckCircle2 size={14} className="text-[#22C55E]" />
                    ) : progress > 0 ? (
                      <div className="w-3 h-3 rounded-full border-2 border-[#6366F1]" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border-2 border-[#475569]" />
                    )}
                  </div>

                  {/* Thumbnail */}
                  <img
                    src={getThumbnailUrl(l.youtubeVideoId, 'medium')}
                    alt=""
                    className="w-20 h-12 rounded-lg object-cover shrink-0 bg-[#17202A]"
                    loading="lazy"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#F8FAFC] truncate">{l.title}</p>
                      {l.isImportant && <Star size={12} className="text-[#F59E0B] fill-[#F59E0B] shrink-0" />}
                      {hasAtt && <Paperclip size={12} className="text-[#64748B] shrink-0" aria-label="Has attachments" />}
                      {hasTs && <Clock size={12} className="text-[#64748B] shrink-0" aria-label="Has timestamps" />}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">{l.channelName} · {l.durationFormatted}</p>
                  </div>
                </Link>

                {/* Actions — separate from click area */}
                <div className="flex items-center gap-1 pr-3 shrink-0">
                  {/* Document / Slide Button */}
                  {l.slideUrl && (
                    <a
                      href={l.slideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[#818CF8] hover:text-[#A5B4FC] hover:bg-[#6366F1]/15 transition-colors"
                      title="Open Lecture Slide / PDF"
                      aria-label="Open Lecture Slide"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText size={14} />
                    </a>
                  )}

                  <button
                    onClick={() => handleToggleImportant(l)}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                      l.isImportant ? 'text-[#F59E0B]' : 'text-[#64748B] hover:text-[#F59E0B]'
                    }`}
                    title="Toggle important"
                    aria-label="Toggle important"
                  >
                    <Star size={13} />
                  </button>
                  <button
                    onClick={() => openEdit(l)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit"
                    aria-label="Edit lecture"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Lecture Modal ── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingLecture ? 'Edit Lecture' : 'Add YouTube Lecture'}
        size="lg"
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* ── YouTube import (new only) ── */}
          {!editingLecture && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="YouTube URL"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>
                <div className="flex items-end shrink-0">
                  <Button onClick={handleFetch} isLoading={isFetching}>Import</Button>
                </div>
              </div>

              {fetchError && (
                <div className="flex items-center gap-2 text-sm text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2.5">
                  <AlertCircle size={15} className="shrink-0" />{fetchError}
                </div>
              )}
              {isFetching && (
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                  <Loader2 size={14} className="animate-spin" />Fetching video info...
                </div>
              )}
              {preview && (
                <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#22C55E]">
                    <CheckCircle size={13} /> Video verified — available and embeddable
                  </div>
                  <div className="flex gap-3 items-start">
                    <img src={preview.thumbnailUrl} alt="" className="w-28 h-16 rounded-lg object-cover bg-[#17202A] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F8FAFC] line-clamp-2">{lectureTitle}</p>
                      <p className="text-xs text-[#64748B] mt-1">{preview.channelName} · {preview.durationFormatted}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Title ── */}
          <Input
            label="Lecture Title"
            value={lectureTitle}
            onChange={(e) => setLectureTitle(e.target.value)}
            placeholder="You can edit the auto-fetched title"
          />

          {/* ── Lecture Slide (Google Drive link) ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#F8FAFC] flex items-center gap-1.5">
              <FileText size={14} className="text-[#818CF8]" /> Lecture Slide / Notes Link
              <span className="text-xs text-[#64748B] font-normal">(Google Drive / PDF link)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={slideUrl}
                onChange={(e) => setSlideUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="flex-1 h-10 rounded-lg border border-[#1E2A36] bg-[#17202A] text-[#F8FAFC] placeholder-[#64748B] text-xs px-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-colors"
              />
              {slideUrl && isValidUrl(slideUrl) && (
                <a
                  href={slideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg text-[#818CF8] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 transition-colors shrink-0"
                  title="Test link"
                  aria-label="Test link"
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
            <p className="text-[10px] text-[#475569]">
              Google Drive বা লেকচার স্লাইডের লিংক দিন। কার্ডের Play বাটনের পাশে ডকুমেন্ট আইকনে ক্লিক করলে সরাসরি এই লিংক ওপেন হবে।
            </p>
          </div>

          {/* ── Timestamps section ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#F8FAFC] flex items-center gap-1.5">
                <Clock size={14} className="text-[#818CF8]" /> Timestamps
                <span className="text-xs text-[#64748B] font-normal">(optional)</span>
              </label>
              {!showTimestampRaw && timestamps.length > 0 && (
                <button
                  onClick={() => setShowTimestampRaw(true)}
                  className="text-xs text-[#64748B] hover:text-[#818CF8] cursor-pointer"
                >
                  Edit raw
                </button>
              )}
            </div>

            {showTimestampRaw ? (
              <div className="space-y-2">
                <textarea
                  value={rawTimestamps}
                  onChange={(e) => setRawTimestamps(e.target.value)}
                  placeholder={`Paste timestamps in any format:\n00:00 Introduction\n2:35 Vectors\n05:40 Vector Addition\n10.20 Important Formula\n15 min 30 sec Newton's Laws`}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2.5 text-xs text-[#F8FAFC] placeholder-[#475569] resize-none focus:outline-none focus:ring-1 focus:ring-[#6366F1] h-32 font-mono"
                />
                <p className="text-[10px] text-[#475569]">
                  Paste timestamps copied from YouTube descriptions, comments, or your own notes. Any format is accepted.
                </p>
                {aiTimestampError && (
                  <div className="flex items-start gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                    <div>
                      <p>{aiTimestampError}</p>
                      <p className="text-[#F59E0B] mt-1">Your raw text is preserved above. You can edit manually or try again.</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={handleCleanWithAI}
                    isLoading={isCleaningAI}
                    disabled={!rawTimestamps.trim()}
                    leftIcon={<Sparkles size={13} />}
                  >
                    Clean with AI
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleParseManually}
                    disabled={!rawTimestamps.trim()}
                  >
                    Parse manually
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {timestamps.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No timestamps yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {timestamps.map((ts, i) => (
                      <TimestampRow
                        key={i}
                        ts={ts}
                        onChange={(updated) =>
                          setTimestamps((prev) => prev.map((t, j) => (j === i ? updated : t)))
                        }
                        onDelete={() => setTimestamps((prev) => prev.filter((_, j) => j !== i))}
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTimestampRaw(true)}
                  >
                    Edit / Re-paste raw
                  </Button>
                  <button
                    onClick={() => setTimestamps([])}
                    className="text-xs text-[#64748B] hover:text-[#EF4444] cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Attachments section ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#F8FAFC] flex items-center gap-1.5">
                <Paperclip size={14} className="text-[#818CF8]" /> Other Attachments
                <span className="text-xs text-[#64748B] font-normal">(optional)</span>
              </label>
              {attachments.length > 0 && (
                <span className="text-xs text-[#64748B]">{attachments.length} / {MAX_ATTACHMENTS}</span>
              )}
            </div>

            {attachments.map((att) => (
              <AttachmentRow
                key={att.id}
                att={att}
                onChange={(updated) =>
                  setAttachments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                }
                onDelete={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
              />
            ))}

            {attachments.length < MAX_ATTACHMENTS && (
              <button
                onClick={() => setAttachments((prev) => [...prev, newAttachment()])}
                className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#818CF8] cursor-pointer transition-colors"
              >
                <Plus size={13} /> Add attachment
              </button>
            )}

            {attachments.length === 0 && (
              <p className="text-[10px] text-[#475569]">
                Add additional supporting files (e.g. formula sheets, homework PDFs).
              </p>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1E2A36]">
            {editingLecture ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(editingLecture)
                  setShowForm(false)
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={14} /> Delete Lecture
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                isLoading={isSubmitting}
                onClick={handleSubmit}
                disabled={!editingLecture && !preview}
              >
                {editingLecture ? 'Save Changes' : 'Add Lecture'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Lecture"
        message={`"${deleteTarget?.title}" will be removed. Your notes and progress for this lecture will be preserved.`}
        confirmLabel="Delete"
        isDanger
        isLoading={isSubmitting}
      />
    </div>
  )
}
