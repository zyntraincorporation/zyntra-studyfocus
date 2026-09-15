import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, Play, Pause, RotateCcw, ChevronDown,
  BookOpen, CheckCircle2, Maximize2, Minimize2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getSubjects } from '@/services/curriculum.service'
import { createSession } from '@/services/sessions.service'
import type { Subject } from '@/types/curriculum.types'

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_FOCUS_SECS = 45 * 60 // 45 minutes focus
const CHUNK_BREAK_SECS = 5 * 60  // 5 minutes break
const CYCLE_SECS = CHUNK_FOCUS_SECS + CHUNK_BREAK_SECS // 50 minutes total cycle

const COLOR_FOCUS = '#8B5CF6'    // Deep Work Violet
const GLOW_FOCUS = 'rgba(139, 92, 246, 0.35)'
const COLOR_BREAK = '#F59E0B'    // Break Amber
const GLOW_BREAK = 'rgba(245, 158, 11, 0.35)'
const LS_KEY = 'zf_countup_timer_state'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
function formatTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
function buildArc(progress: number, r: number) {
  const c = 2 * Math.PI * r
  return { strokeDasharray: `${c * progress} ${c}` }
}

// Gentle audio chimes via Web Audio API
function playChime(freq1: number, freq2: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq1, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + 0.35)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 1.2)
  } catch {}
}

interface PersistedState {
  baseElapsed: number
  startedAt: number | null
  subjectId: string | null
  subjectName: string
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(s: PersistedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

function clearState() {
  localStorage.removeItem(LS_KEY)
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TimerPage() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [display, setDisplay] = useState(0) // Count-up seconds
  const [saved, setSaved] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Auto-hide saved notification
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2500)
      return () => clearTimeout(t)
    }
  }, [saved])

  // Background-safe timestamp refs
  const startedAtRef    = useRef<number | null>(null)
  const baseElapsedRef  = useRef(0)
  const rafRef          = useRef<number | null>(null)
  const lastChimeRef    = useRef<number>(-1)
  const subjectsRef     = useRef<Subject[]>([])

  // Cycle calculations
  const cyclePos = display % CYCLE_SECS
  const isBreak = cyclePos >= CHUNK_FOCUS_SECS
  const chunkNumber = Math.floor(display / CYCLE_SECS) + 1
  const chunksCompleted = Math.floor(display / CHUNK_FOCUS_SECS)

  const progress = isBreak
    ? Math.min(1, (cyclePos - CHUNK_FOCUS_SECS) / CHUNK_BREAK_SECS)
    : Math.min(1, cyclePos / CHUNK_FOCUS_SECS)

  const activeColor = isBreak ? COLOR_BREAK : COLOR_FOCUS
  const activeGlow = isBreak ? GLOW_BREAK : GLOW_FOCUS

  // ── Load subjects ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    getSubjects(user.uid).then(s => {
      setSubjects(s)
      subjectsRef.current = s
    })
  }, [user])

  // ── Restore state on mount ───────────────────────────────────────────────
  useEffect(() => {
    const ps = loadState()
    if (!ps) return
    baseElapsedRef.current = ps.baseElapsed

    if (ps.startedAt !== null) {
      startedAtRef.current = ps.startedAt
      setRunning(true)
    } else {
      setDisplay(ps.baseElapsed)
    }

    if (ps.subjectId) {
      const restore = () => {
        const match = subjectsRef.current.find(s => s.id === ps.subjectId)
        if (match) setSelectedSubject(match)
        else setTimeout(restore, 300)
      }
      setTimeout(restore, 100)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persist state ────────────────────────────────────────────────────────
  const persistState = useCallback(() => {
    const ps: PersistedState = {
      baseElapsed: baseElapsedRef.current,
      startedAt: startedAtRef.current,
      subjectId: selectedSubject?.id ?? null,
      subjectName: selectedSubject?.name ?? '',
    }
    saveState(ps)
  }, [selectedSubject])

  // ── Tick (rAF-based, count-up) ───────────────────────────────────────────
  const tick = useCallback(() => {
    if (startedAtRef.current === null) return
    const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000) + baseElapsedRef.current
    setDisplay(elapsed)

    // Chime trigger for 45m break and 50m next chunk
    const pos = elapsed % CYCLE_SECS
    const cycleIdx = Math.floor(elapsed / CYCLE_SECS)

    // At 45 min mark (break reminder)
    if (pos >= CHUNK_FOCUS_SECS && pos < CHUNK_FOCUS_SECS + 3 && lastChimeRef.current !== cycleIdx * 2 + 1) {
      lastChimeRef.current = cycleIdx * 2 + 1
      playChime(587.33, 880) // D5 -> A5
    }
    // At cycle completion (back to focus)
    if (pos >= 0 && pos < 3 && elapsed >= CYCLE_SECS && lastChimeRef.current !== cycleIdx * 2) {
      lastChimeRef.current = cycleIdx * 2
      playChime(440, 659.25) // A4 -> E5
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Page visibility ──────────────────────────────────────────────────────
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && running) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [running, tick])

  // ── rAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [running, tick])

  // ── Persist on change ────────────────────────────────────────────────────
  useEffect(() => { persistState() }, [persistState])

  // ── beforeunload — auto-save whatever seconds were done ──────────────────
  useEffect(() => {
    const onUnload = () => {
      let totalElapsed = baseElapsedRef.current
      if (startedAtRef.current !== null) {
        totalElapsed += Math.floor((Date.now() - startedAtRef.current) / 1000)
        baseElapsedRef.current = totalElapsed
        startedAtRef.current = null
      }
      persistState()

      if (user && selectedSubject && totalElapsed > 0) {
        const endedAt = new Date()
        const startedAt = new Date(endedAt.getTime() - totalElapsed * 1000)
        createSession(user.uid, {
          lectureId: 'timer_deepwork',
          subjectId: selectedSubject.id,
          chapterId: 'timer',
          subjectName: selectedSubject.name,
          startedAt,
          endedAt,
          timerMode: 'pomodoro-45',
        }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [user, selectedSubject, persistState])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleRunning() }
      if (e.key === 'r' || e.key === 'R') reset()
      if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v)
      if (e.key === 'Escape') setFullscreen(false)
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) stopAndSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, selectedSubject])

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleRunning = useCallback(() => {
    if (running) {
      // Pause: lock elapsed time at current second
      if (startedAtRef.current !== null) {
        baseElapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000)
        startedAtRef.current = null
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setRunning(false)
    } else {
      // Resume: start from current elapsed time
      startedAtRef.current = Date.now()
      setRunning(true)
      setSaved(false)
    }
  }, [running])

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false)
    setSaved(false)
    baseElapsedRef.current = 0
    startedAtRef.current = null
    lastChimeRef.current = -1
    setDisplay(0)
    clearState()
  }, [])

  // Instantly saves whatever seconds (10s, 10m, 45m, etc.) to Firestore
  const stopAndSave = useCallback(async () => {
    if (!user || !selectedSubject) return

    let totalElapsed = baseElapsedRef.current
    if (startedAtRef.current !== null) {
      totalElapsed += Math.floor((Date.now() - startedAtRef.current) / 1000)
      baseElapsedRef.current = totalElapsed
      startedAtRef.current = null
    }

    if (totalElapsed <= 0) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setRunning(false)

    const endedAt = new Date()
    const startedAt = new Date(endedAt.getTime() - totalElapsed * 1000)

    await createSession(user.uid, {
      lectureId: 'timer_deepwork',
      subjectId: selectedSubject.id,
      chapterId: 'timer',
      subjectName: selectedSubject.name,
      startedAt,
      endedAt,
      timerMode: 'pomodoro-45',
    })

    baseElapsedRef.current = 0
    setDisplay(0)
    lastChimeRef.current = -1
    setSaved(true)
    clearState()
  }, [user, selectedSubject])

  const displayTime = formatTime(display)
  const R = 108, SIZE = 256

  // ── Ring UI ───────────────────────────────────────────────────────────────
  const Ring = ({ big = false }: { big?: boolean }) => (
    <div className="flex flex-col items-center">
      <div
        className={`${big ? 'mb-6 text-xs' : 'mb-4 text-[11px]'} px-3.5 py-1 rounded-full font-semibold tracking-wider uppercase transition-colors duration-300`}
        style={{
          background: isBreak ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
          color: activeColor,
          border: `1px solid ${isBreak ? 'rgba(245,158,11,0.35)' : 'rgba(139,92,246,0.35)'}`,
        }}>
        {isBreak ? '☕ 5m Break Reminder' : `Deep Work · Chunk ${chunkNumber}`}
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ width: big ? 320 : SIZE, height: big ? 320 : SIZE }}>
        {running && (
          <div
            className="absolute rounded-full"
            style={{
              width: (big ? 320 : SIZE) * 0.7,
              height: (big ? 320 : SIZE) * 0.7,
              background: `radial-gradient(circle, ${activeGlow} 0%, transparent 70%)`,
            }} />
        )}
        <svg
          width={big ? 320 : SIZE}
          height={big ? 320 : SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1E2A36" strokeWidth={10} />
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={activeColor}
            strokeWidth={10} strokeLinecap="round"
            style={{
              ...buildArc(progress, R),
              transition: running ? 'stroke-dasharray 0.5s linear' : 'none',
              filter: `drop-shadow(0 0 6px ${activeColor})`,
            }} />
        </svg>
        <div className="relative flex flex-col items-center z-10">
          <span
            className="font-mono font-bold leading-none tabular-nums"
            style={{
              fontSize: big ? (displayTime.length > 5 ? '4.5rem' : '5.5rem') : (displayTime.length > 5 ? '2.8rem' : '3.5rem'),
              color: '#F8FAFC',
              textShadow: running ? `0 0 32px ${activeColor}70` : 'none',
            }}>
            {displayTime}
          </span>
        </div>
      </div>

      {chunksCompleted > 0 && (
        <div className="flex items-center gap-1.5 mt-4">
          {Array.from({ length: chunksCompleted }).map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: big ? 9 : 7,
                height: big ? 9 : 7,
                background: COLOR_FOCUS,
                boxShadow: `0 0 5px ${COLOR_FOCUS}`,
              }} />
          ))}
        </div>
      )}
    </div>
  )

  const Controls = ({ big = false }: { big?: boolean }) => (
    <div className={`flex items-center justify-center gap-4 ${big ? 'mt-8' : 'mt-2'}`}>
      <button
        onClick={reset}
        title="Reset (R)"
        className={`${big ? 'w-14 h-14' : 'w-11 h-11'} rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer`}
        style={{ background: '#1E2A36', color: '#64748B' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2D3B4D'; (e.currentTarget as HTMLElement).style.color = '#F8FAFC' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1E2A36'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}>
        <RotateCcw size={big ? 20 : 17} />
      </button>
      <button
        onClick={toggleRunning}
        title={running ? 'Pause (Space)' : 'Play (Space)'}
        className={`${big ? 'w-24 h-24' : 'w-[4.5rem] h-[4.5rem]'} rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer`}
        style={{
          background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
          boxShadow: running ? `0 0 28px ${activeGlow}, 0 4px 16px rgba(0,0,0,0.4)` : '0 4px 16px rgba(0,0,0,0.4)',
          color: '#fff',
        }}>
        {running ? <Pause size={big ? 34 : 26} /> : <Play size={big ? 34 : 26} style={{ marginLeft: 3 }} />}
      </button>
      <button
        onClick={stopAndSave}
        disabled={!selectedSubject || display === 0}
        title={selectedSubject ? 'Save (S)' : 'Select subject to save'}
        className={`${big ? 'w-14 h-14' : 'w-11 h-11'} rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed`}
        style={{ background: saved ? '#22C55E22' : '#1E2A36', color: saved ? '#22C55E' : '#64748B' }}
        onMouseEnter={e => { if (!(e.currentTarget as HTMLButtonElement).disabled) (e.currentTarget as HTMLElement).style.background = '#2D3B4D' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = saved ? '#22C55E22' : '#1E2A36' }}>
        <CheckCircle2 size={big ? 20 : 17} />
      </button>
    </div>
  )

  // ── Fullscreen mode ────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
        style={{ background: '#0B0F14' }}>
        <button
          onClick={() => setFullscreen(false)}
          className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          style={{ background: '#1E2A36', color: '#64748B' }}
          title="Exit fullscreen (Esc / F)">
          <Minimize2 size={18} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Brain size={16} style={{ color: activeColor }} />
          <span className="text-sm font-semibold" style={{ color: activeColor }}>
            Deep Work
          </span>
          {selectedSubject && (
            <span className="text-sm text-[#64748B] ml-2">
              · {selectedSubject.icon} {selectedSubject.name}
            </span>
          )}
        </div>

        <Ring big />
        <Controls big />

        {saved && (
          <p className="mt-5 text-sm text-[#22C55E] animate-fade-in font-medium">✓ Saved</p>
        )}
      </div>
    )
  }

  // ── Normal Page UI ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-5 select-none animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={20} style={{ color: activeColor }} />
          <h1 className="text-lg font-bold text-[#F8FAFC]">Deep Work</h1>
        </div>
        <button
          onClick={() => setFullscreen(true)}
          title="Fullscreen (F)"
          className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all"
          style={{ background: '#1E2A36', color: '#64748B' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2D3B4D'; (e.currentTarget as HTMLElement).style.color = '#F8FAFC' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1E2A36'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}>
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Subject picker */}
      <div className="relative">
        <button
          id="timer-subject-picker"
          onClick={() => setSubjectOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
          style={{
            background: '#111820',
            border: `1px solid ${subjectOpen ? activeColor + '80' : '#1E2A36'}`,
            color: selectedSubject ? '#F8FAFC' : '#64748B',
          }}>
          <BookOpen size={15} style={{ color: selectedSubject ? activeColor : '#64748B', flexShrink: 0 }} />
          <span className="flex-1 text-left truncate font-medium">
            {selectedSubject ? `${selectedSubject.icon} ${selectedSubject.name}` : 'Select Subject'}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: '#64748B',
              transform: subjectOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms',
            }} />
        </button>

        {subjectOpen && subjects.length > 0 && (
          <div
            className="absolute top-full mt-1.5 left-0 right-0 rounded-xl overflow-hidden z-30 shadow-2xl"
            style={{ background: '#17202A', border: '1px solid #1E2A36' }}>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSubject(s); setSubjectOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left cursor-pointer transition-colors"
                style={{
                  color: selectedSubject?.id === s.id ? activeColor : '#F8FAFC',
                  background: selectedSubject?.id === s.id ? activeColor + '15' : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1E2A36'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = selectedSubject?.id === s.id ? activeColor + '15' : 'transparent'}>
                <span>{s.icon}</span>
                <span className="flex-1 truncate">{s.name}</span>
                {selectedSubject?.id === s.id && <CheckCircle2 size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ring */}
      <Ring />

      {/* Controls */}
      <Controls />

      {/* Saved Toast */}
      {saved && (
        <p className="text-center text-xs text-[#22C55E] animate-fade-in font-medium">
          ✓ Saved
        </p>
      )}
    </div>
  )
}
