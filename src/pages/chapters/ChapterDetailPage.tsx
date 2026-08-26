import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ChevronLeft, Play,
  CheckCircle2, Star, Loader2, AlertCircle, CheckCircle,
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
import type { Subject, Chapter, Lecture } from '@/types/curriculum.types'
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

export default function ChapterDetailPage() {
  const { subjectId, chapterId } = useParams<{ subjectId: string; chapterId: string }>()
  const { user } = useAuth()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Lecture form state
  const [showForm, setShowForm] = useState(false)
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lecture | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // YouTube import state
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    videoId: string; channelName: string; thumbnailUrl: string;
    duration: number; durationFormatted: string; youtubeUrl: string
  } | null>(null)
  const [lectureTitle, setLectureTitle] = useState('')

  const { isLectureCompleted, getLectureProgress } = useProgressStats()

  const reload = async () => {
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
  }

  useEffect(() => { reload() }, [user, subjectId, chapterId])

  const openAdd = () => {
    setEditingLecture(null)
    setPreview(null)
    setLectureTitle('')
    setYoutubeUrl('')
    setFetchError(null)
    setShowForm(true)
  }

  const openEdit = (l: Lecture) => {
    setEditingLecture(l)
    setLectureTitle(l.title)
    setPreview(null)
    setShowForm(true)
  }

  const handleFetch = async () => {
    if (!youtubeUrl.trim()) return
    setIsFetching(true)
    setFetchError(null)
    setPreview(null)
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

  const handleSubmit = async () => {
    if (!user || !subject || !chapter) return
    if (!lectureTitle.trim()) return
    setIsSubmitting(true)
    if (editingLecture) {
      await updateLecture(user.uid, editingLecture.id, { title: lectureTitle })
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
            return (
              <div
                key={l.id}
                className="group flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-3 hover:border-[#6366F1]/40 transition-all"
              >
                {/* Number + completion */}
                <div className="w-8 shrink-0 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-[#475569]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#F8FAFC] truncate">{l.title}</p>
                    {l.isImportant && <Star size={12} className="text-[#F59E0B] fill-[#F59E0B] shrink-0" />}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">{l.channelName} · {l.durationFormatted}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Always show watch button */}
                  <Link
                    to={buildRoute(ROUTES.WATCH, { lectureId: l.id })}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 transition-colors"
                    title="Watch"
                  >
                    <Play size={14} />
                  </Link>

                  {/* Hover-only actions */}
                  <button
                    onClick={() => handleToggleImportant(l)}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                      l.isImportant
                        ? 'text-[#F59E0B]'
                        : 'text-[#64748B] hover:text-[#F59E0B]'
                    }`}
                    title="Toggle important"
                  >
                    <Star size={13} />
                  </button>
                  <button
                    onClick={() => openEdit(l)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(l)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Lecture Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingLecture ? 'Edit Lecture Title' : 'Add YouTube Lecture'}
        size="lg"
      >
        <div className="space-y-4">
          {/* YouTube import section — only for new lectures */}
          {!editingLecture && (
            <>
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
                  <Button onClick={handleFetch} isLoading={isFetching}>
                    Import
                  </Button>
                </div>
              </div>

              {fetchError && (
                <div className="flex items-center gap-2 text-sm text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl px-3 py-2.5">
                  <AlertCircle size={15} className="shrink-0" />
                  {fetchError}
                </div>
              )}

              {isFetching && (
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                  <Loader2 size={14} className="animate-spin" />
                  Fetching video info from YouTube...
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
                      <p className="text-xs text-[#64748B] mt-1">
                        {preview.channelName} · {preview.durationFormatted}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <Input
            label="Lecture Title"
            value={lectureTitle}
            onChange={(e) => setLectureTitle(e.target.value)}
            placeholder="You can edit the auto-fetched title"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              isLoading={isSubmitting}
              onClick={handleSubmit}
              disabled={!editingLecture && !preview}
            >
              {editingLecture ? 'Save Title' : 'Add Lecture'}
            </Button>
          </div>
        </div>
      </Modal>

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
