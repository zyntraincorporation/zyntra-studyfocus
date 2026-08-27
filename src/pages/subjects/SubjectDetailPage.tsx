import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getSubject,
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
} from '@/services/curriculum.service'
import type { Subject, Chapter } from '@/types/curriculum.types'
import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ProgressBar from '@/components/ui/ProgressBar'
import { useProgressStats } from '@/hooks/useProgressStats'

export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const { user } = useAuth()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Chapter | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null)
  const [form, setForm] = useState({ name: '', description: '', order: 1 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { getChapterProgress } = useProgressStats()

  const reload = async () => {
    if (!user || !subjectId) return
    const [sub, chaps] = await Promise.all([
      getSubject(user.uid, subjectId),
      getChapters(user.uid, subjectId),
    ])
    setSubject(sub)
    setChapters(chaps)
    setIsLoading(false)
  }

  useEffect(() => { reload() }, [user, subjectId])

  const openCreate = () => {
    setEditing(null)
    const nextOrder = chapters.length > 0
      ? Math.max(...chapters.map((c) => c.order ?? 0)) + 1
      : 1
    setForm({ name: '', description: '', order: nextOrder })
    setShowForm(true)
  }

  const openEdit = (c: Chapter) => {
    setEditing(c)
    setForm({ name: c.name, description: c.description, order: c.order ?? 1 })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!user || !subject || !form.name.trim()) return
    const orderNum = Number(form.order) || 1
    setIsSubmitting(true)
    if (editing) {
      await updateChapter(user.uid, editing.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        order: orderNum,
      })
    } else {
      await createChapter(
        user.uid,
        {
          name: form.name.trim(),
          description: form.description.trim(),
          subjectId: subject.id,
          subjectName: subject.name,
          order: orderNum,
        },
        orderNum
      )
    }
    setShowForm(false)
    setIsSubmitting(false)
    reload()
  }

  const handleDelete = async () => {
    if (!user || !deleteTarget || !subject) return
    setIsSubmitting(true)
    await deleteChapter(user.uid, deleteTarget.id, subject.id)
    setDeleteTarget(null)
    setIsSubmitting(false)
    reload()
  }

  if (isLoading) return <SkeletonList count={5} />
  if (!subject) return <div className="text-[#64748B]">Subject not found.</div>

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
        <Link to={ROUTES.SUBJECTS} className="hover:text-[#F8FAFC] flex items-center gap-1">
          <ChevronLeft size={14} /> My Subjects
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${subject.color}20` }}
          >
            {subject.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#F8FAFC]">{subject.name}</h1>
            <p className="text-sm text-[#64748B]">{chapters.length} chapters · {subject.lectureCount} lectures</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
          Add Chapter
        </Button>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">📖</span>}
          title="No chapters yet"
          description="Add your first chapter to start organizing lectures."
          action={<Button leftIcon={<Plus size={16} />} onClick={openCreate}>Add Chapter</Button>}
        />
      ) : (
        <div className="space-y-2">
          {chapters.map((c, idx) => {
            const progress = getChapterProgress(c.id)
            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-4 hover:border-[#6366F1]/40 transition-all"
              >
                {/* Number */}
                <span className="text-xs font-mono text-[#818CF8] bg-[#6366F1]/10 px-2 py-1 rounded-md shrink-0 text-center font-bold">
                  {String(c.order ?? idx + 1).padStart(2, '0')}
                </span>

                {/* Info */}
                <Link
                  to={buildRoute(ROUTES.CHAPTER, { subjectId: subject.id, chapterId: c.id })}
                  className="flex-1 min-w-0"
                >
                  <p className="font-medium text-[#F8FAFC]">{c.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[#64748B]">{c.lectureCount} lectures</span>
                    <div className="flex-1 max-w-32">
                      <ProgressBar value={progress} max={100} size="xs" color={subject.color} />
                    </div>
                    <span className="text-xs text-[#64748B]">{progress}%</span>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link
                    to={buildRoute(ROUTES.CHAPTER, { subjectId: subject.id, chapterId: c.id })}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 transition-colors"
                    title="Open chapter"
                  >
                    <ChevronRight size={15} />
                  </Link>
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
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

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Chapter' : 'New Chapter'}>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-28 shrink-0">
              <Input
                label="Chapter Serial *"
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 1 })}
                placeholder="1, 2..."
              />
            </div>
            <div className="flex-1">
              <Input
                label="Chapter Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Vectors / Organic Chemistry"
              />
            </div>
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button isLoading={isSubmitting} onClick={handleSubmit}>
              {editing ? 'Save' : 'Add Chapter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Chapter"
        message={`"${deleteTarget?.name}" will be hidden. Lectures inside will be preserved.`}
        confirmLabel="Delete"
        isDanger
        isLoading={isSubmitting}
      />
    </div>
  )
}
