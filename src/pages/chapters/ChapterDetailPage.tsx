import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ChevronLeft, Play,
  CheckCircle2, Star, Loader2, AlertCircle, CheckCircle,
  Sparkles, Clock, Paperclip, ExternalLink, GripVertical, FileText,
  Code2, Eye, ClipboardCopy, Check, BookOpen, GraduationCap, ChevronDown,
  Lock,
} from 'lucide-react'
import {
  getSubject,
  getChapter,
  getLectures,
  createLecture,
  updateLecture,
  deleteLecture,
  toggleImportant,
  toggleEngineeringAdmission,
  updateChapterResources,
} from '@/services/curriculum.service'
import { fetchYouTubeMetadata } from '@/services/youtube.service'
import { getLectureLockStatus } from '@/services/schedule.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import type { Subject, Chapter, Lecture, LectureTimestamp, LectureAttachment, AttachmentType, ChapterResource } from '@/types/curriculum.types'
import ResourcesSection from '@/pages/chapters/ResourcesSection'

import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { getThumbnailUrl } from '@/utils/youtube.utils'
import DocumentPreviewModal from '@/components/ui/DocumentPreviewModal'
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

// ── Lecture Note HTML helpers ──────────────────────────────────────────

import DOMPurify from 'dompurify'
import { renderMathInHtml } from '@/utils/mathRenderer'

function sanitizeNoteHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's',
      'code', 'pre', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'sup', 'sub', 'caption', 'colgroup', 'col',
      'details', 'summary', 'mark', 'small', 'figure', 'figcaption',
      'section', 'article', 'aside', 'header', 'footer', 'main',
    ],
    ALLOWED_ATTR: ['style', 'class', 'colspan', 'rowspan', 'id', 'open'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src'],
  })
  return renderMathInHtml(clean)
}

function stripNoteHtmlFences(raw: string): string {
  const trimmed = raw.trim()
  const m = trimmed.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (m) return m[1].trim()
  return trimmed
}

function buildLectureNotePrompt(lectureTitle?: string, subjectName?: string, chapterName?: string): string {
  const ctx = [
    lectureTitle && `লেকচার: ${lectureTitle}`,
    subjectName && `বিষয়: ${subjectName}`,
    chapterName && `অধ্যায়: ${chapterName}`,
  ].filter(Boolean).join(' | ')

  return `You are an elite academic note architect creating interactive study guides for ZyntraFocus — a dark-themed educational platform for Bangladeshi HSC & admission students.

Transform my raw notes into a beautiful, fully interactive Bengali (বাংলা) study guide using the platform's CSS system.
${ctx ? `\nCONTEXT: ${ctx}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Write ALL explanations in Bengali (বাংলা). English terms in parentheses are fine.
2. Use numbered sections, subheadings (h3/h4), concise bullet points — no long paragraphs.
3. Cover EVERY topic completely. Never truncate.
4. Use <details>/<summary> for lengthy sub-topics (collapsible).

FORMULA CARDS:
<div class="formula-card">
  <div class="formula-name">সূত্রের নাম (English Name)</div>
  <div class="formula-math">$$ \\LaTeX $$</div>
  <div class="formula-vars">যেখানে: $x$ = অর্থ, $y$ = অর্থ</div>
</div>

CALLOUT BOXES:
<div class="concept-box">মূল ধারণা</div>
<div class="tip-box"><span class="tip-term">টিপস:</span> পরীক্ষার কৌশল</div>
<div class="caution-box"><span class="warn-term">সতর্কতা:</span> সচরাচর ভুল</div>

INLINE HIGHLIGHTS:
<span class="term-badge">পরিভাষা</span>  <span class="def-term">সংজ্ঞা</span>  <span class="warn-term">সতর্কতা</span>  <span class="tip-term">টিপস</span>

COLLAPSIBLE:
<details style="margin:10px 0;background:#111820;border:1px solid #1E2A36;border-radius:10px;padding:2px 12px;">
  <summary style="cursor:pointer;padding:8px 0;color:#818CF8;font-weight:600;list-style:none;">▶ বিষয়ের নাম</summary>
  <div style="padding:8px 0 12px;color:#CBD5E1;">বিস্তারিত...</div>
</details>

OUTPUT: Return ONLY clean HTML — no markdown fences, no prose outside HTML.
Wrap everything in: <div class="academic-note">...</div>

[আপনার নোট এখানে paste করুন]`
}

function LectureNoteCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* ignore */ }
  }
  return (
    <button type="button" onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-medium whitespace-nowrap ${
        copied ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30' : 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 hover:bg-[#38BDF8]/20'
      }`}
    >
      {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
      {copied ? 'কপি হয়েছে ✓' : '📋 Claude Prompt'}
    </button>
  )
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

  // ── Lecture Note HTML state ────────────────────────────────────────
  const [lectureNoteHtml, setLectureNoteHtml] = useState('')
  const [noteHtmlView, setNoteHtmlView] = useState<'code' | 'preview'>('code')
  const [noteHtmlExpanded, setNoteHtmlExpanded] = useState(false)

  // ── In-app slide preview ──────────────────────────────────────
  const [previewSlide, setPreviewSlide] = useState<{ url: string; title: string } | null>(null)

  // ── Engineering admission state ────────────────────────────────────
  const [isEngineeringAdmission, setIsEngineeringAdmission] = useState(false)

  // ── Reliable Server Time for Live Lock Status ──────────────────────
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())

  useEffect(() => {
    initClockSync().then(() => {
      setReliableNowMs(getReliableTime())
    }).catch(() => {})
  }, [])

  // Keyboard shortcut ref for modal
  const modalKeyRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  const { isLectureCompleted, getLectureProgress } = useProgressStats()

  // \u2500\u2500 Keyboard shortcuts for the modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  useEffect(() => {
    if (!showForm) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA') return  // don't intercept in textareas
      // Ctrl+S / Cmd+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSubmit()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

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
    setLectureNoteHtml('')
    setNoteHtmlView('code')
    setNoteHtmlExpanded(false)
    setIsEngineeringAdmission(false)
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (l: Lecture) => {
    const lockStatus = getLectureLockStatus(
      { lockedScheduleId: l.lockedScheduleId, lockedUntil: l.lockedUntil },
      reliableNowMs
    )
    if (lockStatus.isLocked) {
      alert('এই লেকচারটি বর্তমানে একটি লাইভ শিডিউলে লক করা আছে। শিডিউল শেষ না হওয়া পর্যন্ত এটি এডিট করা যাবে না।')
      return
    }
    resetForm()
    setEditingLecture(l)
    setLectureTitle(l.title)
    setSlideUrl(l.slideUrl || '')
    setLectureNoteHtml(l.noteHtml || '')
    setTimestamps(l.timestamps ?? [])
    setAttachments(l.attachments ?? [])
    setIsEngineeringAdmission(l.isEngineeringAdmission ?? false)
    setNoteHtmlExpanded(!!l.noteHtml)  // expand if already has content
    setShowTimestampRaw(false)  // show editable list when editing existing lecture
    setNoteHtmlView('code')
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
    const sanitizedNote = lectureNoteHtml.trim() ? sanitizeNoteHtml(lectureNoteHtml.trim()) : ''

    setIsSubmitting(true)
    if (editingLecture) {
      await updateLecture(user.uid, editingLecture.id, {
        title: lectureTitle,
        slideUrl: slideUrl.trim() || '',
        noteHtml: sanitizedNote || undefined,
        timestamps: timestamps.length > 0 ? timestamps : [],
        attachments: validAttachments.length > 0 ? validAttachments : [],
        isEngineeringAdmission: isEngineeringAdmission || undefined,
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
          ...(sanitizedNote ? { noteHtml: sanitizedNote } : {}),
          ...(timestamps.length > 0 ? { timestamps } : {}),
          ...(validAttachments.length > 0 ? { attachments: validAttachments } : {}),
          ...(isEngineeringAdmission ? { isEngineeringAdmission: true } : {}),
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
    const lockStatus = getLectureLockStatus(
      { lockedScheduleId: deleteTarget.lockedScheduleId, lockedUntil: deleteTarget.lockedUntil },
      reliableNowMs
    )
    if (lockStatus.isLocked) {
      alert('এই লেকচারটি বর্তমানে একটি লাইভ শিডিউলে লক করা আছে। শিডিউল শেষ না হওয়া পর্যন্ত এটি মুছে ফেলা যাবে না।')
      setDeleteTarget(null)
      return
    }
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

  const handleToggleEngineering = async (l: Lecture) => {
    if (!user) return
    await toggleEngineeringAdmission(user.uid, l.id, l.isEngineeringAdmission ?? false)
    reload()
  }

  const handleResourcesChange = async (updated: ChapterResource[]) => {
    if (!user || !chapter) return
    // Optimistic update
    setChapter((prev) => prev ? { ...prev, resources: updated } : prev)
    await updateChapterResources(user.uid, chapter.id, updated)
  }

  if (isLoading) return <SkeletonList count={5} />
  if (!chapter || !subject) return <div className="text-[#64748B]">Chapter not found.</div>

  // Split lectures into engineering-first
  const engineeringLectures = lectures.filter(l => l.isEngineeringAdmission)
  const regularLectures = lectures.filter(l => !l.isEngineeringAdmission)

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
          <p className="text-sm text-[#64748B] mt-0.5">{lectures.length} lectures{engineeringLectures.length > 0 ? ` · ${engineeringLectures.length} engineering` : ''}</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Lecture</Button>
      </div>

      {/* Resources section */}
      <ResourcesSection
        chapterId={chapter.id}
        resources={chapter.resources ?? []}
        isAdmin={!!user}
        onResourcesChange={handleResourcesChange}
        subjectId={subject.id}
        subjectName={subject.name}
        chapterName={chapter.name}
      />

      {/* Lecture list */}
      {lectures.length === 0 ? (
        <EmptyState
          icon={<Play size={36} />}
          title="No lectures yet"
          description="Add a YouTube lecture to get started."
          action={<Button leftIcon={<Plus size={16} />} onClick={openAdd}>Add Lecture</Button>}
        />

      ) : (
        <div className="space-y-4">

          {/* ── Engineering Admission priority section ── */}
          {engineeringLectures.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#F59E0B]/20 to-[#FBBF24]/10 border border-[#F59E0B]/30 px-3 py-1.5 rounded-lg">
                  <GraduationCap size={14} className="text-[#F59E0B]" />
                  <span className="text-xs font-semibold text-[#F59E0B] tracking-wide">ENGINEERING ADMISSION</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-[#F59E0B]/30 to-transparent" />
              </div>
              <div className="space-y-2 pl-0">
                {engineeringLectures.map((l, idx) => {
                  const completed = isLectureCompleted(l.id)
                  const progress = getLectureProgress(l.id)
                  const hasAtt = (l.attachments?.length ?? 0) > 0
                  const hasTs = (l.timestamps?.length ?? 0) > 0
                  const lockStatus = getLectureLockStatus(
                    { lockedScheduleId: l.lockedScheduleId, lockedUntil: l.lockedUntil },
                    reliableNowMs
                  )
                  const isLocked = lockStatus.isLocked
                  return (
                    <div
                      key={l.id}
                      className="group flex items-center gap-3 bg-gradient-to-r from-[#F59E0B]/8 to-[#111820] border border-[#F59E0B]/25 rounded-xl hover:border-[#F59E0B]/50 transition-all overflow-hidden"
                    >
                      <Link
                        to={isLocked && lockStatus.scheduleId ? buildRoute(ROUTES.LIVE_WATCH, { scheduleId: lockStatus.scheduleId }) : buildRoute(ROUTES.WATCH, { lectureId: l.id })}
                        className="flex items-center gap-3 flex-1 min-w-0 p-3 pr-1"
                      >
                        <div className="w-8 shrink-0 flex flex-col items-center gap-1">
                          <span className="text-xs font-mono text-[#F59E0B]/60">{String(idx + 1).padStart(2, '0')}</span>
                          {isLocked ? (
                            <div className="w-4 h-4 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444]" title="Scheduled for Live">
                              <Lock size={10} />
                            </div>
                          ) : completed ? (
                            <CheckCircle2 size={14} className="text-[#22C55E]" />
                          ) : progress > 0 ? (
                            <div className="w-3 h-3 rounded-full border-2 border-[#F59E0B]" />
                          ) : (
                            <GraduationCap size={13} className="text-[#F59E0B]/60" />
                          )}
                        </div>
                        <div className="relative shrink-0">
                          <img
                            src={getThumbnailUrl(l.youtubeVideoId, 'medium')}
                            alt=""
                            className={`w-20 h-12 rounded-lg object-cover bg-[#17202A] ring-1 ring-[#F59E0B]/20 ${isLocked ? 'opacity-70' : ''}`}
                            loading="lazy"
                          />
                          {isLocked && (
                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                              <Lock size={14} className="text-[#EF4444]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-[#F8FAFC] truncate">{l.title}</p>
                            {isLocked && (
                              <span className="inline-flex items-center gap-1 bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#EF4444]" />
                                </span>
                                LIVE
                              </span>
                            )}
                            {l.isImportant && <Star size={12} className="text-[#F59E0B] fill-[#F59E0B] shrink-0" />}
                            {hasAtt && <Paperclip size={12} className="text-[#64748B] shrink-0" />}
                            {hasTs && <Clock size={12} className="text-[#64748B] shrink-0" />}
                            {l.noteHtml && <BookOpen size={12} className="text-[#38BDF8] shrink-0" />}
                          </div>
                          <p className="text-xs text-[#64748B] mt-0.5">{l.channelName} · {l.durationFormatted}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 pr-3 shrink-0">
                        {l.slideUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); e.preventDefault();
                              if (isLocked) {
                                alert('এই লেকচারটি বর্তমানে Live Schedule-এ লক করা আছে। Slide দেখতে Live Room-এ যোগ দিন বা ক্লাস শেষ হওয়ার অপেক্ষা করুন।')
                                return
                              }
                              setPreviewSlide({ url: l.slideUrl!, title: l.title })
                            }}
                            className="p-1.5 rounded-lg text-[#818CF8] hover:text-[#A5B4FC] hover:bg-[#6366F1]/15 transition-colors cursor-pointer"
                            title="Open Lecture Slide (in-app)"
                          >
                            <FileText size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleEngineering(l)}
                          className="p-1.5 rounded-lg cursor-pointer transition-colors text-[#F59E0B] hover:bg-[#F59E0B]/10 opacity-0 group-hover:opacity-100"
                          title="Remove Engineering mark"
                        >
                          <GraduationCap size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleImportant(l)}
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                            l.isImportant ? 'text-[#F59E0B]' : 'text-[#64748B] hover:text-[#F59E0B]'
                          }`}
                          title="Toggle important"
                        >
                          <Star size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(l)}
                          disabled={isLocked}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isLocked
                              ? 'text-[#475569] cursor-not-allowed opacity-40'
                              : 'text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer opacity-0 group-hover:opacity-100'
                          }`}
                          title={isLocked ? 'Locked in Live Schedule' : 'Edit'}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Divider before regular lectures */}
              {regularLectures.length > 0 && (
                <div className="flex items-center gap-2 px-1 pt-1">
                  <div className="flex-1 h-px bg-[#1E2A36]" />
                  <span className="text-[10px] text-[#475569] font-medium tracking-wide">ALL LECTURES</span>
                  <div className="flex-1 h-px bg-[#1E2A36]" />
                </div>
              )}
            </div>
          )}

          {/* ── Regular lectures ── */}
          <div className="space-y-2">
            {regularLectures.map((l, idx) => {
              const completed = isLectureCompleted(l.id)
              const progress = getLectureProgress(l.id)
              const hasAtt = (l.attachments?.length ?? 0) > 0
              const hasTs = (l.timestamps?.length ?? 0) > 0
              const lockStatus = getLectureLockStatus(
                { lockedScheduleId: l.lockedScheduleId, lockedUntil: l.lockedUntil },
                reliableNowMs
              )
              const isLocked = lockStatus.isLocked
              return (
                <div
                  key={l.id}
                  className="group flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl hover:border-[#6366F1]/40 transition-all overflow-hidden"
                >
                  {/* Clickable area: number + thumbnail + info → navigate to watch (or live room if locked) */}
                  <Link
                    to={isLocked && lockStatus.scheduleId ? buildRoute(ROUTES.LIVE_WATCH, { scheduleId: lockStatus.scheduleId }) : buildRoute(ROUTES.WATCH, { lectureId: l.id })}
                    className="flex items-center gap-3 flex-1 min-w-0 p-3 pr-1"
                  >
                    {/* Number + completion */}
                    <div className="w-8 shrink-0 flex flex-col items-center gap-1">
                      <span className="text-xs font-mono text-[#475569]">{String(idx + 1).padStart(2, '0')}</span>
                      {isLocked ? (
                        <div className="w-4 h-4 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444]" title="Scheduled for Live">
                          <Lock size={10} />
                        </div>
                      ) : completed ? (
                        <CheckCircle2 size={14} className="text-[#22C55E]" />
                      ) : progress > 0 ? (
                        <div className="w-3 h-3 rounded-full border-2 border-[#6366F1]" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border-2 border-[#475569]" />
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="relative shrink-0">
                      <img
                        src={getThumbnailUrl(l.youtubeVideoId, 'medium')}
                        alt=""
                        className={`w-20 h-12 rounded-lg object-cover bg-[#17202A] ${isLocked ? 'opacity-70' : ''}`}
                        loading="lazy"
                      />
                      {isLocked && (
                        <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                          <Lock size={14} className="text-[#EF4444]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-[#F8FAFC] truncate">{l.title}</p>
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#EF4444]" />
                            </span>
                            LIVE
                          </span>
                        )}
                        {l.isImportant && <Star size={12} className="text-[#F59E0B] fill-[#F59E0B] shrink-0" />}
                        {hasAtt && <Paperclip size={12} className="text-[#64748B] shrink-0" aria-label="Has attachments" />}
                        {hasTs && <Clock size={12} className="text-[#64748B] shrink-0" aria-label="Has timestamps" />}
                        {l.noteHtml && <BookOpen size={12} className="text-[#38BDF8] shrink-0" aria-label="Has interactive note" />}
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">{l.channelName} · {l.durationFormatted}</p>
                    </div>
                  </Link>

                  {/* Actions — separate from click area */}
                  <div className="flex items-center gap-1 pr-3 shrink-0">
                    {/* Document / Slide Button */}
                    {l.slideUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          if (isLocked) {
                            alert('এই লেকচারটি বর্তমানে Live Schedule-এ লক করা আছে। Slide দেখতে Live Room-এ যোগ দিন বা ক্লাস শেষ হওয়ার অপেক্ষা করুন।')
                            return
                          }
                          setPreviewSlide({ url: l.slideUrl!, title: l.title })
                        }}
                        className="p-1.5 rounded-lg text-[#818CF8] hover:text-[#A5B4FC] hover:bg-[#6366F1]/15 transition-colors cursor-pointer"
                        title="Open Lecture Slide (in-app)"
                        aria-label="Open Lecture Slide"
                      >
                        <FileText size={14} />
                      </button>
                    )}

                    {/* Engineering Admission toggle */}
                    <button
                      onClick={() => handleToggleEngineering(l)}
                      className="p-1.5 rounded-lg cursor-pointer transition-colors text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 opacity-0 group-hover:opacity-100"
                      title="Mark as Engineering Admission class"
                    >
                      <GraduationCap size={13} />
                    </button>

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
                      disabled={isLocked}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isLocked
                          ? 'text-[#475569] cursor-not-allowed opacity-40'
                          : 'text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer opacity-0 group-hover:opacity-100'
                      }`}
                      title={isLocked ? 'Locked in Live Schedule' : 'Edit'}
                      aria-label="Edit lecture"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Add / Edit Lecture Modal ── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingLecture ? 'Edit Lecture' : 'Add Lecture'}
        size="lg"
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* ── Save button at TOP + shortcuts hint ── */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1E2A36]">
            <div className="flex items-center gap-2">
              {editingLecture && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(editingLecture)
                    setShowForm(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <span className="text-[10px] text-[#475569] hidden sm:block">Ctrl+S to save{!editingLecture ? ' · Ctrl+Enter to import' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                isLoading={isSubmitting}
                onClick={handleSubmit}
                disabled={!editingLecture && !preview}
              >
                {editingLecture ? 'Save Changes' : 'Add Lecture'}
              </Button>
            </div>
          </div>

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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetch() } }}
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

          {/* ── Engineering Admission toggle ── */}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[#1E2A36] bg-[#0B0F14]">
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className={isEngineeringAdmission ? 'text-[#F59E0B]' : 'text-[#475569]'} />
              <div>
                <p className="text-xs font-medium text-[#F8FAFC]">Engineering Admission Class</p>
                <p className="text-[10px] text-[#475569]">Priority section এ উপরে দেখাবে</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEngineeringAdmission(prev => !prev)}
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                isEngineeringAdmission ? 'bg-[#F59E0B]' : 'bg-[#1E2A36]'
              }`}
              style={{ height: '22px' }}
              aria-label="Toggle Engineering Admission"
              role="switch"
              aria-checked={isEngineeringAdmission}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  isEngineeringAdmission ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* ── Lecture Slide (Google Drive link) ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#F8FAFC] flex items-center gap-1.5">
              <FileText size={14} className="text-[#818CF8]" /> Lecture Slide Link
              <span className="text-xs text-[#64748B] font-normal">(Google Drive / PDF)</span>
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
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
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
                  placeholder={`Paste timestamps in any format:\n00:00 Introduction\n2:35 Vectors\n05:40 Vector Addition\n10.20 Important Formula`}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2.5 text-xs text-[#F8FAFC] placeholder-[#475569] resize-none focus:outline-none focus:ring-1 focus:ring-[#6366F1] h-32 font-mono"
                />
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
                Add supporting files (formula sheets, homework PDFs, etc.).
              </p>
            )}
          </div>

          {/* ── Lecture Interactive Note (HTML) — collapsible, stays at bottom ── */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setNoteHtmlExpanded(prev => !prev)}
              className="w-full flex items-center justify-between gap-2 text-sm font-medium text-[#F8FAFC] hover:text-[#818CF8] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#38BDF8]" />
                <span>Interactive Note</span>
                <span className="text-xs text-[#64748B] font-normal">(HTML)</span>
                {lectureNoteHtml.trim() && (
                  <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.5 rounded">
                    {(new Blob([lectureNoteHtml]).size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <LectureNoteCopyButton text={buildLectureNotePrompt(lectureTitle, subject?.name, chapter?.name)} />
                <ChevronDown size={14} className={`text-[#475569] transition-transform ${noteHtmlExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {noteHtmlExpanded && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center bg-[#0B0F14] border border-[#1E2A36] rounded-lg p-0.5 gap-0.5 w-fit">
                  <button
                    type="button"
                    onClick={() => setNoteHtmlView('code')}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      noteHtmlView === 'code' ? 'bg-[#1E2A36] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'
                    }`}
                  >
                    <Code2 size={11} /> Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteHtmlView('preview')}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      noteHtmlView === 'preview' ? 'bg-[#1E2A36] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'
                    }`}
                  >
                    <Eye size={11} /> Preview
                  </button>
                </div>

                {noteHtmlView === 'code' && (
                  <textarea
                    value={lectureNoteHtml}
                    onChange={(e) => setLectureNoteHtml(stripNoteHtmlFences(e.target.value))}
                    placeholder={`Claude থেকে HTML paste করুন...\n\n<div class="academic-note">\n  <h2>লেকচারের শিরোনাম</h2>\n</div>`}
                    className="w-full bg-[#080C12] border border-[#1E2A36] focus:border-[#38BDF8]/40 rounded-xl px-3 py-2.5 text-xs text-[#A5B4FC] placeholder-[#2D3A4A] resize-none focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/30 h-48 font-mono leading-relaxed"
                    spellCheck={false}
                  />
                )}

                {noteHtmlView === 'preview' && (
                  lectureNoteHtml.trim() ? (
                    <div
                      className="bg-[#080C12] border border-[#1E2A36] rounded-xl p-4 max-h-64 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeNoteHtml(
                          lectureNoteHtml.trim().startsWith('<div class="academic-note"')
                            ? lectureNoteHtml
                            : `<div class="academic-note">${lectureNoteHtml}</div>`
                        )
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 h-28 border border-dashed border-[#1E2A36] rounded-xl text-[#334155]">
                      <Eye size={20} />
                      <p className="text-xs">Code ট্যাবে HTML paste করুন</p>
                    </div>
                  )
                )}
              </div>
            )}
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

      {/* ── In-app Slide Preview Modal ── */}
      {previewSlide && (
        <DocumentPreviewModal
          url={previewSlide.url}
          title="Lecture Slide"
          subtitle={previewSlide.title}
          onClose={() => setPreviewSlide(null)}
        />
      )}
    </div>
  )
}
