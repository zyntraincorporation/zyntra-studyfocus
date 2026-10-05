import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCatalog } from '@/hooks/useStudyCatalog'
import { buildRoute, ROUTES } from '@/constants/routes'
import { deleteStudyMaterial, getAllProgress } from '@/services/studyMaterials.service'
import type { StudyMaterialProgress } from '@/types/studyMaterials.types'
import { SkeletonList } from '@/components/ui/Skeleton'
import AddStudyMaterialsModal from '@/components/study-materials/AddStudyMaterialsModal'

export default function StudyMaterialsSubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const { user } = useAuth()
  const { subjects, chapters, materials, loading, reload } = useStudyCatalog()
  const [progress, setProgress] = useState<Record<string, StudyMaterialProgress>>({})
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!user) return
    getAllProgress(user.uid).then(setProgress).catch(() => {})
  }, [user])

  if (loading) return <SkeletonList count={4} />

  const subject = subjects.find((s) => s.id === subjectId)
  if (!subject) {
    return (
      <div className="text-center py-16 text-sm text-[#94A3B8] space-y-3">
        <p>Subject not found.</p>
        <Link to={ROUTES.STUDY_MATERIALS} className="text-[#818CF8] hover:underline">
          Back to Study Materials
        </Link>
      </div>
    )
  }

  // Only chapters of this subject that actually have PDFs
  const groups = chapters
    .filter((c) => c.subjectId === subject.id)
    .map((c) => ({ c, items: materials.filter((m) => m.chapterId === c.id) }))
    .filter((g) => g.items.length > 0)

  const remove = async (id: string) => {
    if (!user || !confirm('Delete this lecture slide?')) return
    await deleteStudyMaterial(user.uid, id)
    reload()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Link
        to={ROUTES.STUDY_MATERIALS}
        className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#F8FAFC]"
      >
        <ArrowLeft size={14} /> Study Materials
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${subject.color}20` }}
        >
          {subject.icon}
        </div>
        <h1 className="text-xl font-bold text-[#F8FAFC] truncate flex-1">{subject.name}</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6366F1] text-white text-sm font-medium hover:bg-[#5558E6] transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Slides
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-center py-12 text-sm text-[#64748B]">No lecture slides in this subject yet.</p>
      ) : (
        groups.map(({ c, items }) => (
          <section key={c.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-[#94A3B8]">
              {c.name} <span className="text-[#64748B] font-normal">· {items.length}</span>
            </h2>
            <div className="bg-[#111820] border border-[#1E2A36] rounded-xl divide-y divide-[#1E2A36] overflow-hidden">
              {items.map((m) => {
                const p = progress[m.id]
                const started = !!p?.lastOpenedAt || !!p?.lastPage
                return (
                  <div key={m.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-[#17202A] transition-colors">
                    <FileText size={16} className="text-[#818CF8] shrink-0" />
                    <Link
                      to={buildRoute(ROUTES.STUDY_READER, { resourceId: m.id })}
                      className="min-w-0 flex-1"
                    >
                      <p className="text-sm text-[#F8FAFC] truncate">{m.title}</p>
                      <p className="text-xs text-[#64748B]">
                        {p?.lastPage ? `Page ${p.lastPage} marked` : started ? 'Opened' : 'Not started'}
                      </p>
                    </Link>
                    <Link
                      to={buildRoute(ROUTES.STUDY_READER, { resourceId: m.id })}
                      className="text-xs text-[#818CF8] hover:underline shrink-0"
                    >
                      {started ? 'Continue' : 'Open'}
                    </Link>
                    <button
                      onClick={() => remove(m.id)}
                      aria-label="Delete slide"
                      className="p-1 text-[#64748B] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#EF4444] transition-opacity cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}

      <AddStudyMaterialsModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        subjects={subjects}
        chapters={chapters}
        materials={materials}
        defaultSubjectId={subject.id}
        onAdded={reload}
      />
    </div>
  )
}
