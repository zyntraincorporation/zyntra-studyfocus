import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
  Minus,
  Plus,
  ChevronDown,
  FileText,
  Save,
  Check,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStudyCatalog } from '@/hooks/useStudyCatalog'
import { buildRoute, ROUTES } from '@/constants/routes'
import { toSlideEmbedUrl } from '@/utils/embed.utils'
import { formatClock } from '@/utils/studyMaterials.utils'
import { addDailySubjectSeconds, getProgress, saveProgress } from '@/services/studyMaterials.service'
import { createSession } from '@/services/sessions.service'
import LoadingScreen from '@/components/ui/LoadingScreen'



export default function StudyMaterialReaderPage() {
  const { resourceId } = useParams<{ resourceId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { subjects, chapters, materials, loading } = useStudyCatalog()

  const rootRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const material = useMemo(() => materials.find((m) => m.id === resourceId), [materials, resourceId])
  const chapter = chapters.find((c) => c.id === material?.chapterId)
  const subject = subjects.find((s) => s.id === material?.subjectId)

  // Navigation scope = CURRENT SUBJECT only: chapters (by chapter order) that actually have
  // study materials, each with its materials ordered by serial/order.
  const subjectGroups = useMemo(() => {
    if (!material) return []
    return chapters
      .filter((c) => c.subjectId === material.subjectId)
      .map((c) => ({ c, items: materials.filter((m) => m.chapterId === c.id) }))
      .filter((g) => g.items.length > 0)
  }, [chapters, materials, material])
  const flat = useMemo(() => subjectGroups.flatMap((g) => g.items), [subjectGroups])
  const idx = flat.findIndex((m) => m.id === resourceId)
  const prev = idx > 0 ? flat[idx - 1] : null
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null

  const go = useCallback(
    (id: string) => {
      setDrawer(false)
      navigate(buildRoute(ROUTES.STUDY_READER, { resourceId: id }), { replace: true })
    },
    [navigate]
  )

  // ── Study timer ─────────────────────────────────────────────────────────────
  // Counts in memory only (never a write per second). Firebase is written
  // exclusively by the explicit Save button, which adds the accumulated
  // seconds to today's total for the CURRENT SUBJECT and resets to 00:00:00.
  // Does NOT start automatically; survives switching PDFs inside the subject.
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const matRef = useRef(material)
  matRef.current = material
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const [fsBar, setFsBar] = useState(true)

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 2500)
  }

  const saveNow = async () => {
    const m = matRef.current
    const secs = elapsedRef.current
    if (!user || !m || saving || secs <= 0) return // nothing accumulated → no empty entry
    setSaving(true)
    setRunning(false) // stays paused after Save; Play must be pressed again
    try {
      const endedAt = new Date()
      await Promise.all([
        addDailySubjectSeconds(user.uid, m.subjectId, secs, {
          chapterId: m.chapterId,
          resourceId: m.id,
        }),
        // Same study-session record the rest of the app uses → shows in Analytics
        createSession(user.uid, {
          lectureId: m.id,
          subjectId: m.subjectId,
          chapterId: m.chapterId,
          subjectName: subject?.name ?? '',
          startedAt: new Date(endedAt.getTime() - secs * 1000),
          endedAt,
        }),
      ])
      // Subtract only what was saved so ticks that arrived during the write are kept.
      elapsedRef.current = Math.max(0, elapsedRef.current - secs)
      setElapsed(elapsedRef.current)
      showToast(true, `Saved ${formatClock(secs)} to ${subject?.name ?? 'subject'}`)
    } catch {
      showToast(false, 'Could not save — time kept, try again')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!running) return
    let last = Date.now()
    const t = setInterval(() => {
      const delta = Math.floor((Date.now() - last) / 1000)
      if (delta < 1) return
      last += delta * 1000
      elapsedRef.current += delta
      setElapsed(elapsedRef.current)
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  // Warn before closing the tab with unsaved time
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (elapsedRef.current > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  // ── Per-resource position (user-marked page) ──────────────────────────
  const [page, setPage] = useState(0)
  const [resumePage, setResumePage] = useState<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!user || !material) return
    let cancelled = false
    setPage(0)
    setResumePage(null)
    getProgress(user.uid, material.id)
      .then((p) => {
        if (cancelled) return
        if (p?.lastPage) {
          setPage(p.lastPage)
          setResumePage(p.lastPage)
        }
      })
      .catch(() => {})
    saveProgress(user.uid, material, { opened: true }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, material?.id])

  const changePage = (n: number) => {
    const v = Math.max(0, Math.min(9999, n || 0))
    setPage(v)
    if (!user || !material) return
    clearTimeout(saveTimer.current)
    const m = material
    saveTimer.current = setTimeout(() => {
      saveProgress(user.uid, m, { lastPage: v }).catch(() => {})
    }, 800)
  }

  // ── Fullscreen ────────────────────────────────────────────────────────
  // The reading area is `absolute inset-0` inside a 100dvh root, so the PDF viewport is always
  // exactly the available screen (portrait or landscape) and the Drive viewer re-fits itself on
  // resize, keeping the PDF aspect ratio. Where the Fullscreen API is unavailable (e.g. iPhone
  // Safari) the same chrome-free layout is used without native fullscreen.
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggleFs = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (rootRef.current?.requestFullscreen) {
      rootRef.current.requestFullscreen().catch(() => setIsFs((v) => !v))
    } else {
      setIsFs((v) => !v)
    }
  }

  const close = () => {
    if (elapsedRef.current > 0 && !confirm('You have unsaved study time. Leave without saving?')) {
      return
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    navigate(
      material ? buildRoute(ROUTES.STUDY_SUBJECT, { subjectId: material.subjectId }) : ROUTES.STUDY_MATERIALS
    )
  }

  // Keyboard: ←/→ previous/next resource (when focus is on page, not iframe)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowLeft' && prev) go(prev.id)
      if (e.key === 'ArrowRight' && next) go(next.id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [prev, next, go])

  useEffect(() => {
    if (material) setExpanded((e) => ({ ...e, [material.chapterId]: true }))
  }, [material?.chapterId])

  if (loading) return <LoadingScreen />
  if (!material) {
    return (
      <div className="fixed inset-0 bg-[#0B0F14] flex flex-col items-center justify-center gap-4 text-[#94A3B8]">
        <p className="text-sm">Study material not found.</p>
        <button
          onClick={close}
          className="px-4 py-2 rounded-lg bg-[#6366F1] text-white text-sm cursor-pointer"
        >
          Back to Study Materials
        </button>
      </div>
    )
  }

  const btn =
    'h-9 min-w-9 px-2 flex items-center justify-center gap-1 rounded-lg text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer text-xs'

  const timerEl = (
    <div className="flex items-center gap-1 px-1 rounded-lg bg-[#111820] border border-[#1E2A36]">
      <button
        onClick={() => setRunning((r) => !r)}
        className={btn}
        aria-label={running ? 'Pause timer' : 'Start timer'}
      >
        {running ? <Pause size={16} className="text-[#F59E0B]" /> : <Play size={16} className="text-[#22C55E]" />}
      </button>
      <span className="text-xs tabular-nums text-[#E2E8F0] w-[4.5rem] text-center">{formatClock(elapsed)}</span>
      <button
        onClick={saveNow}
        disabled={saving || elapsed <= 0}
        className={btn}
        aria-label="Save study time to today's subject total"
        title={`Add this time to today's ${subject?.name ?? 'subject'} total`}
      >
        <Save size={14} />
        <span>{saving ? 'Saving' : 'Save'}</span>
      </button>
    </div>
  )

  const pageEl = (
    <div className="flex items-center gap-0.5" title="Mark your page so you can find it next time">
      <button className={btn} onClick={() => changePage(page - 1)} aria-label="Previous page mark">
        <Minus size={14} />
      </button>
      <input
        type="number"
        min={0}
        value={page || ''}
        placeholder="pg"
        onChange={(e) => changePage(parseInt(e.target.value, 10))}
        className="w-11 h-8 text-center text-xs bg-[#111820] border border-[#1E2A36] rounded-md focus:outline-none focus:border-[#6366F1]"
      />
      <button className={btn} onClick={() => changePage(page + 1)} aria-label="Next page mark">
        <Plus size={14} />
      </button>
    </div>
  )

  const navEl = (
    <>
      <button className={btn} disabled={!prev} onClick={() => prev && go(prev.id)} aria-label="Previous lecture slide">
        <ChevronLeft size={18} />
      </button>
      <button className={btn} onClick={() => setDrawer(true)} aria-label="Lecture slide navigator">
        <List size={18} />
      </button>
      <button className={btn} disabled={!next} onClick={() => next && go(next.id)} aria-label="Next lecture slide">
        <ChevronRight size={18} />
      </button>
      <button className={btn} onClick={toggleFs} aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen'}>
        {isFs ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </>
  )

  return (
    <div ref={rootRef} className="fixed inset-0 h-[100dvh] w-screen flex flex-col bg-[#0B0F14] text-[#F8FAFC]">
      {/* Top bar — removed completely in fullscreen */}
      {!isFs && (
        <header className="shrink-0 flex flex-wrap items-center gap-1 px-2 py-1 bg-[#0B0F14] border-b border-[#1E2A36]">
          <button onClick={close} className={btn} aria-label="Close reader">
            <X size={18} />
          </button>
          <div className="min-w-0 flex-1 basis-40 px-1">
            <p className="text-[10px] text-[#64748B] truncate leading-tight">
              {subject?.name ?? 'Subject'} → {chapter?.name ?? 'Chapter'}
            </p>
            <p className="text-sm font-medium truncate leading-tight">{material.title}</p>
          </div>
          {timerEl}
          {pageEl}
          {navEl}
        </header>
      )}

      {/* Fullscreen: only a small floating control pill over the PDF */}
      {isFs && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {fsBar ? (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#0B0F14]/85 backdrop-blur border border-[#1E2A36] opacity-70 hover:opacity-100 transition-opacity">
              <span className="hidden md:block max-w-[14rem] truncate px-2 text-xs text-[#94A3B8]">
                {material.title}
              </span>
              {timerEl}
              {pageEl}
              {navEl}
              <button className={btn} onClick={() => setFsBar(false)} aria-label="Hide controls">
                <ChevronUp size={16} />
              </button>
            </div>
          ) : (
            <button
              className={`${btn} bg-[#0B0F14]/70 border border-[#1E2A36] opacity-50 hover:opacity-100`}
              onClick={() => setFsBar(true)}
              aria-label="Show controls"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      )}

      {/* Reading area */}
      <div className="relative flex-1 min-h-0">
        <iframe
          key={material.id}
          title={material.title}
          src={toSlideEmbedUrl(material.googleDriveUrl)}
          className="absolute inset-0 w-full h-full border-0 bg-[#0B0F14]"
          allow="fullscreen"
        />
        {resumePage && (
          <button
            onClick={() => setResumePage(null)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#111820]/95 border border-[#1E2A36] text-xs text-[#E2E8F0] shadow-lg cursor-pointer"
          >
            You marked page {resumePage} last time · scroll there · dismiss
          </button>
        )}
        {toast && (
          <div
            role="status"
            className={`absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111820]/95 border border-[#1E2A36] text-xs shadow-lg animate-fade-in ${
              toast.ok ? 'text-[#22C55E]' : 'text-[#F59E0B]'
            }`}
          >
            {toast.ok && <Check size={13} />}
            {toast.text}
          </div>
        )}
      </div>

      {/* Navigation drawer: current Subject only → Chapters → Materials */}
      {drawer && (
        <div className="absolute inset-0 z-20 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="relative ml-auto w-full max-w-sm h-full bg-[#0B0F14] border-l border-[#1E2A36] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2A36]">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-[#64748B]">Lecture Slides</p>
                <p className="text-sm font-semibold truncate">
                  {subject?.icon} {subject?.name ?? 'Subject'}
                </p>
              </div>
              <button className={btn} onClick={() => setDrawer(false)} aria-label="Close list">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {subjectGroups.map(({ c, items }) => {
                const open = expanded[c.id] ?? false
                return (
                  <div key={c.id}>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))}
                      className="w-full flex items-center justify-between px-2 py-2.5 rounded-lg hover:bg-[#111820] text-sm cursor-pointer"
                    >
                      <span className={c.id === material.chapterId ? 'text-[#818CF8]' : ''}>{c.name}</span>
                      <span className="flex items-center gap-2 text-[11px] text-[#64748B]">
                        {items.length}
                        <ChevronDown
                          size={15}
                          className={`transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </button>
                    {open &&
                      items.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => go(m.id)}
                          className={`w-full flex items-center gap-2 pl-6 pr-2 py-2.5 rounded-lg text-left text-sm cursor-pointer ${
                            m.id === material.id
                              ? 'bg-[#6366F1]/15 text-[#818CF8]'
                              : 'text-[#CBD5E1] hover:bg-[#111820]'
                          }`}
                        >
                          <FileText size={14} className="shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </button>
                      ))}
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
