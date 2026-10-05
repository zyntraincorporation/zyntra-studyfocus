import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { bulkAddStudyMaterials } from '@/services/studyMaterials.service'
import { parseLinks, nextSeqStart, padSeq } from '@/utils/studyMaterials.utils'
import type { StudyMaterial } from '@/types/studyMaterials.types'
import type { Subject, Chapter } from '@/types/curriculum.types'
import Modal from '@/components/ui/Modal'

const field =
  'w-full bg-[#0B0F14] border border-[#1E2A36] rounded-lg px-3 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#6366F1]'

interface Props {
  isOpen: boolean
  onClose: () => void
  subjects: Subject[]
  chapters: Chapter[]
  materials: StudyMaterial[]
  defaultSubjectId?: string
  onAdded: () => void | Promise<void>
}

/** Admin bulk add: Title + optional Starting Serial + comma separated Drive links. */
export default function AddStudyMaterialsModal({
  isOpen,
  onClose,
  subjects,
  chapters,
  materials,
  defaultSubjectId = '',
  onAdded,
}: Props) {
  const { user } = useAuth()
  const [subjectId, setSubjectId] = useState(defaultSubjectId)
  const [chapterId, setChapterId] = useState('')
  const [title, setTitle] = useState('')
  const [serial, setSerial] = useState('')
  const [links, setLinks] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSubjectId(defaultSubjectId)
    setChapterId('')
    setMsg(null)
  }, [isOpen, defaultSubjectId])

  const formChapters = useMemo(
    () => chapters.filter((c) => c.subjectId === subjectId),
    [chapters, subjectId]
  )

  const parsed = parseLinks(links)
  const serialTrim = serial.trim()
  const serialValid = serialTrim === '' || /^[1-9]\d*$/.test(serialTrim)
  const start = serialTrim === '' ? 1 : parseInt(serialTrim, 10)
  const inChapter = materials.filter((m) => m.chapterId === chapterId)
  const suggested = title.trim() && chapterId ? nextSeqStart(title, inChapter) : null

  const preview =
    title.trim() && parsed.length > 0 && serialValid
      ? parsed.map((_, i) => `${title.trim()} ${padSeq(start + i)}`)
      : []

  const submit = async () => {
    if (!user || !chapterId || !title.trim() || parsed.length === 0 || !serialValid) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await bulkAddStudyMaterials(user.uid, subjectId, chapterId, title, links, start)
      setMsg({
        ok: true,
        text: `Added ${r.created.length}` + (r.skipped ? ` · skipped ${r.skipped} duplicate link(s)` : ''),
      })
      setLinks('')
      await onAdded()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed to save.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Lecture Slides" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select
            className={field}
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setChapterId('')
            }}
          >
            <option value="">Subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            className={field}
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            disabled={!subjectId}
          >
            <option value="">Chapter…</option>
            {formChapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <input
            className={field}
            placeholder="Title, e.g. Vector Class Lecture"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={`${field} ${serialValid ? '' : 'border-[#EF4444]'}`}
            inputMode="numeric"
            placeholder="Start # (1)"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
        </div>
        {!serialValid && (
          <p className="text-xs text-[#EF4444]">Starting serial must be a positive whole number.</p>
        )}
        {suggested !== null && suggested > 1 && (
          <button
            type="button"
            onClick={() => setSerial(String(suggested))}
            className="text-xs text-[#818CF8] hover:underline cursor-pointer"
          >
            This chapter already has “{title.trim()}” up to {padSeq(suggested - 1)} — start at {padSeq(suggested)}
          </button>
        )}
        <textarea
          className={`${field} h-28 resize-none`}
          placeholder="Paste Google Drive links separated by commas"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
        />
        {preview.length > 0 && (
          <p className="text-xs text-[#94A3B8]">
            Will create {preview.length}: {preview.slice(0, 3).join(', ')}
            {preview.length > 3 ? ` … ${preview[preview.length - 1]}` : ''}
          </p>
        )}
        {msg && (
          <p className={`text-xs ${msg.ok ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{msg.text}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#94A3B8] hover:bg-[#1E2A36] cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={submit}
            disabled={busy || !chapterId || !title.trim() || parsed.length === 0 || !serialValid}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6366F1] text-white disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
