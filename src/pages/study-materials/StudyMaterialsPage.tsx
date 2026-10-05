import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { useStudyCatalog } from '@/hooks/useStudyCatalog'
import { buildRoute, ROUTES } from '@/constants/routes'
import { SkeletonList } from '@/components/ui/Skeleton'
import AddStudyMaterialsModal from '@/components/study-materials/AddStudyMaterialsModal'

export default function StudyMaterialsPage() {
  const { subjects, chapters, materials, loading, reload } = useStudyCatalog()
  const [showAdd, setShowAdd] = useState(false)

  if (loading) return <SkeletonList count={4} />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F8FAFC]">Study Materials</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Choose a subject</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6366F1] text-white text-sm font-medium hover:bg-[#5558E6] transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Slides
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16 text-sm text-[#94A3B8]">
          No subjects yet. Create subjects and chapters from My Subjects first.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const total = materials.filter((m) => m.subjectId === s.id).length
            return (
              <Link
                key={s.id}
                to={buildRoute(ROUTES.STUDY_SUBJECT, { subjectId: s.id })}
                className="group flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-4 hover:border-[#6366F1]/40 transition-all"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: `${s.color}20` }}
                >
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#F8FAFC] truncate">{s.name}</p>
                  <p className="text-xs text-[#64748B]">
                    {total} Lecture Slide{total === 1 ? '' : 's'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#64748B] group-hover:text-[#818CF8] transition-colors" />
              </Link>
            )
          })}
        </div>
      )}

      <AddStudyMaterialsModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        subjects={subjects}
        chapters={chapters}
        materials={materials}
        onAdded={reload}
      />
    </div>
  )
}
