import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/services/curriculum.service'
import type { Subject, SubjectInput } from '@/types/curriculum.types'
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

const ICONS = ['📚', '🔢', '⚛️', '🧪', '🌍', '📝', '🎓', '💡', '🔬', '📐', '🎵', '💻']
const COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']
const DEFAULT_FORM: SubjectInput = { name: '', description: '', icon: '📚', color: '#6366F1' }

export default function SubjectsPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<SubjectInput>(DEFAULT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { getSubjectProgress } = useProgressStats()

  const reload = async () => {
    if (!user) return
    const data = await getSubjects(user.uid)
    setSubjects(data)
    setIsLoading(false)
  }

  useEffect(() => { reload() }, [user])

  const openCreate = () => { setEditing(null); setForm(DEFAULT_FORM); setShowForm(true) }
  const openEdit = (s: Subject) => {
    setEditing(s)
    setForm({ name: s.name, description: s.description, icon: s.icon, color: s.color })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!user || !form.name.trim()) return
    setIsSubmitting(true)
    if (editing) {
      await updateSubject(user.uid, editing.id, form)
    } else {
      await createSubject(user.uid, form, subjects.length)
    }
    setShowForm(false)
    setIsSubmitting(false)
    reload()
  }

  const handleDelete = async () => {
    if (!user || !deleteId) return
    setIsSubmitting(true)
    await deleteSubject(user.uid, deleteId)
    setDeleteId(null)
    setIsSubmitting(false)
    reload()
  }

  if (isLoading) return <SkeletonList count={4} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8FAFC]">My Subjects</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={openCreate}>Add Subject</Button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={<span className="text-4xl">📚</span>}
          title="No subjects yet"
          description="Create your first subject to start organizing your study materials."
          action={<Button leftIcon={<Plus size={16} />} onClick={openCreate}>Add Your First Subject</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const progress = getSubjectProgress(s.id)
            return (
              <div
                key={s.id}
                className="group relative bg-[#111820] border border-[#1E2A36] rounded-xl p-4 hover:border-[#6366F1]/40 transition-all"
              >
                {/* Action buttons — appear on hover */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.preventDefault(); openEdit(s) }}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#818CF8] hover:bg-[#6366F1]/10 cursor-pointer transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); setDeleteId(s.id) }}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 cursor-pointer transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <Link to={buildRoute(ROUTES.SUBJECT, { subjectId: s.id })} className="block">
                  {/* Icon + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: `${s.color}20` }}
                    >
                      {s.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#F8FAFC] truncate pr-12">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-[#64748B] truncate">{s.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                    <span>{s.chapterCount ?? 0} chapters · {s.lectureCount} lectures</span>
                    <span className="font-medium" style={{ color: s.color }}>{progress}%</span>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar value={progress} max={100} color={s.color} />

                  {/* Open arrow */}
                  <div className="flex items-center justify-end mt-3">
                    <span className="text-xs text-[#64748B] group-hover:text-[#818CF8] flex items-center gap-1 transition-colors">
                      Open <ChevronRight size={12} />
                    </span>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Subject' : 'New Subject'}
      >
        <div className="space-y-4">
          <Input
            label="Subject Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Physics"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional brief description"
          />

          {/* Icon picker */}
          <div>
            <p className="text-sm font-medium text-[#F8FAFC] mb-2">Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setForm({ ...form, icon: ic })}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center cursor-pointer transition-colors border ${
                    form.icon === ic
                      ? 'border-[#6366F1] bg-[#6366F1]/10'
                      : 'border-[#1E2A36] hover:border-[#6366F1]/40'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-sm font-medium text-[#F8FAFC] mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-lg cursor-pointer transition-all border-2 ${
                    form.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button isLoading={isSubmitting} onClick={handleSubmit}>
              {editing ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Subject"
        message="This subject will be hidden. Your chapters and lectures inside will be preserved."
        confirmLabel="Delete"
        isDanger
        isLoading={isSubmitting}
      />
    </div>
  )
}
