import { useEffect, useState } from 'react'
import { Bookmark, Trash2 } from 'lucide-react'
import { getAllBookmarks, deleteBookmark } from '@/services/bookmarks.service'
import type { Bookmark as BookmarkType, BookmarkCategory } from '@/types/bookmarks.types'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/time.utils'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const CATEGORIES: Array<{ value: BookmarkCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'important', label: 'Important' },
  { value: 'formula', label: 'Formula' },
  { value: 'exam_question', label: 'Exam' },
  { value: 'confusing', label: 'Confusing' },
  { value: 'revision', label: 'Revision' },
  { value: 'example', label: 'Example' },
]

const badgeVariantMap: Record<BookmarkCategory, 'brand' | 'info' | 'warning' | 'danger' | 'success' | 'default'> = {
  important: 'brand', formula: 'info', exam_question: 'warning',
  confusing: 'danger', revision: 'success', example: 'default',
}

export default function BookmarksPage() {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<BookmarkCategory | 'all'>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    getAllBookmarks(user.uid).then(setBookmarks).finally(() => setIsLoading(false))
  }, [user])

  const filtered = filter === 'all' ? bookmarks : bookmarks.filter((b) => b.category === filter)

  const handleDelete = async () => {
    if (!user || !deleteId) return
    setIsDeleting(true)
    await deleteBookmark(user.uid, deleteId)
    setBookmarks((prev) => prev.filter((b) => b.id !== deleteId))
    setDeleteId(null)
    setIsDeleting(false)
  }

  if (isLoading) return <SkeletonList count={5} />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#F8FAFC]">Bookmarks</h1>
        <span className="text-sm text-[#64748B]">{bookmarks.length} total</span>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              filter === value
                ? 'bg-[#6366F1] text-white border-[#6366F1]'
                : 'text-[#94A3B8] border-[#1E2A36] hover:border-[#6366F1]/40 hover:text-[#F8FAFC]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={36} />}
          title="No bookmarks found"
          description="Bookmark important moments while watching lectures."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((bm) => (
            <div key={bm.id} className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={badgeVariantMap[bm.category]}>{bm.category.replace('_', ' ')}</Badge>
                    <span className="text-xs font-mono text-[#818CF8]">⏱ {formatDuration(bm.timestamp)}</span>
                  </div>
                  <p className="text-sm font-medium text-[#F8FAFC]">{bm.label || '—'}</p>
                  <p className="text-xs text-[#64748B] mt-1 truncate">{bm.subjectName} · {bm.lectureTitle}</p>
                </div>
                <button
                  onClick={() => setDeleteId(bm.id)}
                  className="text-[#64748B] hover:text-[#EF4444] transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Bookmark"
        message="This bookmark will be permanently deleted."
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  )
}
