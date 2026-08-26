import { useEffect, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { getAllNotes, deleteNote } from '@/services/notes.service'
import type { Note } from '@/types/notes.types'
import { useAuth } from '@/contexts/AuthContext'
import { formatDuration } from '@/utils/time.utils'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Trash2 } from 'lucide-react'

const categoryColors: Record<string, string> = {
  important: 'brand', formula: 'info', exam: 'warning',
  revision: 'success', confusing: 'danger', general: 'default',
}

export default function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    getAllNotes(user.uid).then(setNotes).finally(() => setIsLoading(false))
  }, [user])

  const filtered = notes.filter(
    (n) =>
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.lectureTitle.toLowerCase().includes(search.toLowerCase()) ||
      n.subjectName.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (!user || !deleteId) return
    setIsDeleting(true)
    await deleteNote(user.uid, deleteId)
    setNotes((prev) => prev.filter((n) => n.id !== deleteId))
    setDeleteId(null)
    setIsDeleting(false)
  }

  if (isLoading) return <SkeletonList count={5} />

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#F8FAFC]">Notes</h1>
        <span className="text-sm text-[#64748B]">{notes.length} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes..."
          className="w-full h-10 pl-9 pr-4 bg-[#111820] border border-[#1E2A36] rounded-lg text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={36} />}
          title={search ? 'No notes match your search' : 'No notes yet'}
          description={!search ? 'Add timestamped notes while watching lectures.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <div key={note.id} className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-xs text-[#64748B] truncate">{note.subjectName} · {note.lectureTitle}</p>
                  <p className="text-xs text-[#818CF8] font-mono mt-0.5">
                    ⏱ {formatDuration(note.timestamp)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {note.category && (
                    <Badge variant={categoryColors[note.category] as 'default' | 'brand' | 'info' | 'warning' | 'success' | 'danger'}>
                      {note.category}
                    </Badge>
                  )}
                  <button
                    onClick={() => setDeleteId(note.id)}
                    className="text-[#64748B] hover:text-[#EF4444] transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[#F8FAFC] whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Note"
        message="This note will be permanently deleted."
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
      />
    </div>
  )
}
