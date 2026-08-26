/**
 * WatchPage — /watch/:lectureId
 * Distraction-free lecture player with fully custom controls.
 *
 * Controls:
 *  - Space (click) = play/pause
 *  - Space (hold 300ms) = 2x speed; release = restore previous speed
 *  - ← / → = seek ±5s
 *  - M = mute
 *  - F = fullscreen
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle2, AlertTriangle, FileText, Bookmark,
  X, Star, Zap, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Gauge, Settings2,
} from 'lucide-react'
import { getLecture } from '@/services/curriculum.service'
import { getProgress, saveProgress, markCompleted } from '@/services/progress.service'
import { createSession } from '@/services/sessions.service'
import { getNotes, createNote } from '@/services/notes.service'
import { getBookmarks, createBookmark } from '@/services/bookmarks.service'
import type { Lecture } from '@/types/curriculum.types'
import type { LectureProgress } from '@/types/progress.types'
import type { Note, NoteCategory } from '@/types/notes.types'
import type { Bookmark as BookmarkType, BookmarkCategory } from '@/types/bookmarks.types'
import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { formatDuration } from '@/utils/time.utils'
import { calcPercentage } from '@/utils/progress.utils'
import {
  COMPLETION_THRESHOLD, PROGRESS_SAVE_INTERVAL,
  SESSION_IDLE_TIMEOUT, RESUME_THRESHOLD, PLAYBACK_SPEEDS,
} from '@/constants/firebase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

const PLAYER_ERRORS: Record<number, string> = {
  2: 'Invalid video — please check the YouTube URL.',
  5: 'HTML5 player error. Try refreshing.',
  100: 'This video is unavailable or private.',
  101: 'This video cannot be embedded.',
  150: 'This video cannot be embedded.',
}

const QUALITY_LABELS: Record<string, string> = {
  hd1080: '1080p', hd720: '720p', large: '480p',
  medium: '360p', small: '240p', tiny: '144p', auto: 'Auto',
}

type SidePanelTab = 'notes' | 'bookmarks'
const NOTE_CATEGORIES: NoteCategory[] = ['important', 'formula', 'exam', 'confusing', 'revision', 'general']
const BM_CATEGORIES: BookmarkCategory[] = ['important', 'formula', 'exam_question', 'confusing', 'revision', 'example']

// ── Small dropdown popup component ───────────────────────────────────
function ControlDropdown({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-dropdown]')) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      data-dropdown
      className="absolute bottom-full mb-2 right-0 bg-[#0B0F14] border border-[#1E2A36] rounded-xl shadow-xl py-1 z-50 min-w-max"
    >
      {children}
    </div>
  )
}

export default function WatchPage() {
  const { lectureId } = useParams<{ lectureId: string }>()
  const { user, userDoc, updateProgressMap } = useAuth()
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────────────
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  // ── Resume ────────────────────────────────────────────────────────
  const [savedProgress, setSavedProgress] = useState<LectureProgress | null>(null)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  // ── Playback UI ───────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speed, setSpeed] = useState(userDoc?.preferredSpeed ?? 1)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // ── Quality ───────────────────────────────────────────────────────
  const [availableQualities, setAvailableQualities] = useState<string[]>([])
  const [currentQuality, setCurrentQuality] = useState('auto')
  const [qualityOpen, setQualityOpen] = useState(false)

  // ── Speed dropdown ────────────────────────────────────────────────
  const [speedOpen, setSpeedOpen] = useState(false)

  // ── Side panel ────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SidePanelTab>('notes')

  // ── Notes ─────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('general')
  const [isSavingNote, setIsSavingNote] = useState(false)

  // ── Bookmarks ─────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [bmLabel, setBmLabel] = useState('')
  const [bmCategory, setBmCategory] = useState<BookmarkCategory>('important')
  const [isSavingBm, setIsSavingBm] = useState(false)

  // ── Refs ──────────────────────────────────────────────────────────
  const playerRef = useRef<YT.Player | null>(null)
  const playerDivRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const localPositionRef = useRef(0)
  const localDurationRef = useRef(0)
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionStartRef = useRef<Date | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedFiredRef = useRef(false)
  const lectureRef = useRef<Lecture | null>(null)
  const speedRef = useRef(userDoc?.preferredSpeed ?? 1)
  // Space-hold refs
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoldingSpaceRef = useRef(false)
  const preHoldSpeedRef = useRef(speedRef.current)

  useEffect(() => { lectureRef.current = lecture }, [lecture])
  useEffect(() => { speedRef.current = speed }, [speed])

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!lectureId || !user) return
    Promise.all([
      getLecture(user.uid, lectureId),
      getProgress(user.uid, lectureId),
      getNotes(user.uid, lectureId),
      getBookmarks(user.uid, lectureId),
    ]).then(([lec, prog, noteList, bmList]) => {
      setLecture(lec)
      setSavedProgress(prog)
      setIsCompleted(prog?.completed ?? false)
      completedFiredRef.current = prog?.completed ?? false
      setNotes(noteList)
      setBookmarks(bmList)
      if (prog && prog.currentPosition > RESUME_THRESHOLD && !prog.completed) {
        setShowResumeDialog(true)
      }
    }).finally(() => setIsLoading(false))
  }, [lectureId, user])

  // ── Init YouTube Player ───────────────────────────────────────────
  useEffect(() => {
    if (!lecture || !playerDivRef.current) return

    const initPlayer = () => {
      if (!playerDivRef.current) return
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        videoId: lecture.youtubeVideoId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playerVars: {
          rel: 0,
          controls: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          cc_load_policy: 0,
        } as any,
        events: {
          onReady: (e: YT.PlayerEvent) => {
            setIsPlayerReady(true)
            const dur = e.target.getDuration()
            localDurationRef.current = dur
            setDuration(dur)
            e.target.setPlaybackRate(speedRef.current)
            // Quality levels (deprecated API, cast to any)
            const pl = e.target as any
            const quals = pl.getAvailableQualityLevels?.()
            if (quals && quals.length > 0) {
              setAvailableQualities(['auto', ...quals.filter((q: string) => q !== 'auto')])
              setCurrentQuality(pl.getPlaybackQuality?.() ?? 'auto')
            }
          },
          onStateChange: handleStateChange,
          onPlaybackRateChange: (e: YT.OnPlaybackRateChangeEvent) => setSpeed(e.data),
          onError: (e: YT.OnErrorEvent) => setPlayerError(PLAYER_ERRORS[e.data] ?? 'Playback error.'),
        } as any,  // cast to any allows onPlaybackQualityChange (not in @types/youtube)
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      type ExtWindow = typeof window & { onYouTubeIframeAPIReady?: () => void }
      const win = window as ExtWindow
      const prev = win.onYouTubeIframeAPIReady
      win.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
    }

    return () => {
      clearAllIntervals()
      flushProgress()
      endSession()
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [lecture])

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Space hold/click
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        // Start hold timer
        preHoldSpeedRef.current = speedRef.current
        spaceHoldTimerRef.current = setTimeout(() => {
          // Hold detected — switch to 2x
          isHoldingSpaceRef.current = true
          spaceHoldTimerRef.current = null
          playerRef.current?.setPlaybackRate(2)
          setSpeed(2)
        }, 300)
        return
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5) }
      if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5) }
      if (e.key === 'm' || e.key === 'M') toggleMute()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'Escape') { setPanelOpen(false); setSpeedOpen(false); setQualityOpen(false) }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'Space') {
        if (spaceHoldTimerRef.current !== null) {
          // Timer still running → single click → play/pause
          clearTimeout(spaceHoldTimerRef.current)
          spaceHoldTimerRef.current = null
          togglePlay()
        } else if (isHoldingSpaceRef.current) {
          // Was holding → restore speed
          isHoldingSpaceRef.current = false
          const prev = preHoldSpeedRef.current
          playerRef.current?.setPlaybackRate(prev)
          setSpeed(prev)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ── Fullscreen change ─────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  // ── Visibility change ─────────────────────────────────────────────
  useEffect(() => {
    const h = () => {
      if (document.hidden) { flushProgress(); startIdleTimer() } else { clearIdleTimer() }
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])

  // ── Controls auto-hide ────────────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  // ── Player state handler ──────────────────────────────────────────
  const handleStateChange = useCallback((event: YT.OnStateChangeEvent) => {
    const s = event.data
    const YTState = window.YT?.PlayerState
    if (s === YTState?.PLAYING) {
      setIsPlaying(true)
      if (!sessionStartRef.current) sessionStartRef.current = new Date()
      clearIdleTimer()
      startPolling()
      startSaving()
      showControlsTemporarily()
    }
    if (s === YTState?.PAUSED) {
      setIsPlaying(false)
      setShowControls(true)
      stopPolling(); flushProgress(); startIdleTimer()
    }
    if (s === YTState?.BUFFERING) stopPolling()
    if (s === YTState?.ENDED) {
      setIsPlaying(false)
      setShowControls(true)
      stopPolling(); flushProgress(); endSession()
    }
  }, [showControlsTemporarily])

  // ── Polling ───────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return
    pollIntervalRef.current = setInterval(() => {
      const p = playerRef.current
      if (!p) return
      try {
        const pos = p.getCurrentTime()
        const dur = p.getDuration() || localDurationRef.current
        localPositionRef.current = pos
        localDurationRef.current = dur
        setCurrentTime(pos)
        if (dur > 0) setDuration(dur)
        const pct = calcPercentage(pos, dur)
        if (!completedFiredRef.current && pct >= COMPLETION_THRESHOLD * 100) {
          completedFiredRef.current = true
          setIsCompleted(true)
          if (user && lectureId) {
            markCompleted(user.uid, lectureId)
            updateProgressMap(lectureId, { completed: true, percentage: 100 })
          }
        }
      } catch { /* player destroyed */ }
    }, 1000)
  }, [user, lectureId, updateProgressMap])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
  }, [])

  // ── Save progress ─────────────────────────────────────────────────
  const flushProgress = useCallback(() => {
    if (!user || !lectureId || localPositionRef.current < 1) return
    const pos = localPositionRef.current
    const dur = localDurationRef.current
    const lec = lectureRef.current
    const data = {
      lectureId,
      subjectId: lec?.subjectId ?? '',
      chapterId: lec?.chapterId ?? '',
      lectureTitle: lec?.title ?? '',
      subjectName: lec?.subjectName ?? '',
      chapterName: lec?.chapterName ?? '',
      currentPosition: pos,
      duration: dur,
      percentage: calcPercentage(pos, dur),
      completed: completedFiredRef.current,
      completedAt: null,
    }
    saveProgress(user.uid, lectureId, data)
    updateProgressMap(lectureId, data)
  }, [user, lectureId, updateProgressMap])

  const startSaving = useCallback(() => {
    if (saveIntervalRef.current) return
    saveIntervalRef.current = setInterval(flushProgress, PROGRESS_SAVE_INTERVAL)
  }, [flushProgress])

  const stopSaving = useCallback(() => {
    if (saveIntervalRef.current) { clearInterval(saveIntervalRef.current); saveIntervalRef.current = null }
  }, [])

  // ── Session ───────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    const lec = lectureRef.current
    if (!sessionStartRef.current || !user || !lec) return
    createSession(user.uid, {
      lectureId: lec.id, subjectId: lec.subjectId, chapterId: lec.chapterId,
      subjectName: lec.subjectName, startedAt: sessionStartRef.current, endedAt: new Date(),
    })
    sessionStartRef.current = null
  }, [user])

  const startIdleTimer = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = setTimeout(endSession, SESSION_IDLE_TIMEOUT)
  }, [endSession])

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
  }, [])

  const clearAllIntervals = useCallback(() => {
    stopPolling(); stopSaving(); clearIdleTimer()
  }, [stopPolling, stopSaving, clearIdleTimer])

  // ── Playback controls ─────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return
    const s = playerRef.current.getPlayerState()
    if (s === window.YT?.PlayerState?.PLAYING) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }, [])

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(Math.max(0, Math.min(seconds, localDurationRef.current)), true)
    setCurrentTime(Math.max(0, Math.min(seconds, localDurationRef.current)))
    localPositionRef.current = seconds
  }, [])

  const seekBy = useCallback((delta: number) => {
    seekTo(localPositionRef.current + delta)
  }, [seekTo])

  const handleVolumeChange = useCallback((val: number) => {
    playerRef.current?.setVolume(val)
    setVolume(val)
    if (val === 0) {
      playerRef.current?.mute()
      setIsMuted(true)
    } else {
      playerRef.current?.unMute()
      setIsMuted(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return
    if (isMuted || playerRef.current.isMuted()) {
      playerRef.current.unMute()
      setIsMuted(false)
      const v = volume === 0 ? 80 : volume
      playerRef.current.setVolume(v)
      setVolume(v)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const handleSpeedSelect = useCallback((s: number) => {
    playerRef.current?.setPlaybackRate(s)
    setSpeed(s)
    speedRef.current = s
    preHoldSpeedRef.current = s
    setSpeedOpen(false)
  }, [])

  const handleQualitySelect = useCallback((q: string) => {
    ;(playerRef.current as any)?.setPlaybackQuality?.(q)
    setCurrentQuality(q)
    setQualityOpen(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) containerRef.current.requestFullscreen()
    else document.exitFullscreen()
  }, [])

  // ── Resume ────────────────────────────────────────────────────────
  const handleResume = () => {
    setShowResumeDialog(false)
    if (savedProgress && isPlayerReady && playerRef.current) {
      playerRef.current.seekTo(savedProgress.currentPosition, true)
      playerRef.current.playVideo()
    }
  }

  const handleStartOver = () => {
    setShowResumeDialog(false)
    playerRef.current?.seekTo(0, true)
    playerRef.current?.playVideo()
  }

  // ── Notes / Bookmarks ─────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!user || !lecture || !noteText.trim()) return
    setIsSavingNote(true)
    const n = await createNote(user.uid, {
      lectureId: lecture.id, subjectId: lecture.subjectId, chapterId: lecture.chapterId,
      lectureTitle: lecture.title, subjectName: lecture.subjectName, chapterName: lecture.chapterName,
      timestamp: Math.floor(localPositionRef.current), content: noteText.trim(), category: noteCategory,
    })
    setNotes((prev) => [...prev, n].sort((a, b) => a.timestamp - b.timestamp))
    setNoteText('')
    setIsSavingNote(false)
  }

  const handleAddBookmark = async () => {
    if (!user || !lecture) return
    setIsSavingBm(true)
    const ts = Math.floor(localPositionRef.current)
    const bm = await createBookmark(user.uid, {
      lectureId: lecture.id, subjectId: lecture.subjectId, chapterId: lecture.chapterId,
      lectureTitle: lecture.title, subjectName: lecture.subjectName,
      timestamp: ts, label: bmLabel.trim() || `Bookmark at ${formatDuration(ts)}`, category: bmCategory,
    })
    setBookmarks((prev) => [...prev, bm].sort((a, b) => a.timestamp - b.timestamp))
    setBmLabel('')
    setIsSavingBm(false)
  }

  // ── Loading / Error ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#64748B]">
          <Zap size={18} className="text-[#6366F1] animate-pulse" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }
  if (!lecture) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center text-[#64748B]">
        Lecture not found.
      </div>
    )
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const effectivelyMuted = isMuted || volume === 0

  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col select-none">

      {/* ── Top bar ── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-[#1E2A36] bg-[#0B0F14] shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to={buildRoute(ROUTES.CHAPTER, { subjectId: lecture.subjectId, chapterId: lecture.chapterId })}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820] transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#F8FAFC] truncate">{lecture.title}</p>
            <p className="text-[10px] text-[#64748B] truncate">{lecture.subjectName} / {lecture.chapterName}</p>
          </div>
          {isCompleted && <CheckCircle2 size={15} className="text-[#22C55E] shrink-0" />}
          {lecture.isImportant && <Star size={13} className="text-[#F59E0B] fill-[#F59E0B] shrink-0" />}
        </div>
        <button
          onClick={() => { setPanelOpen(!panelOpen); setSpeedOpen(false); setQualityOpen(false) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            panelOpen ? 'bg-[#6366F1]/15 text-[#818CF8]' : 'text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820]'
          }`}
        >
          <FileText size={13} />
          <span className="hidden sm:inline">Notes & Bookmarks</span>
        </button>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Video column ── */}
        <div className={`flex flex-col transition-all duration-300 ${panelOpen ? 'flex-1 min-w-0' : 'w-full'}`}>

          {playerError ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-4">
              <AlertTriangle size={36} className="text-[#EF4444]" />
              <p className="text-sm text-[#94A3B8] max-w-xs">{playerError}</p>
              <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <>
              {/* ── Video container ── */}
              <div
                ref={containerRef}
                className="relative bg-black"
                style={{ aspectRatio: '16/9' }}
                onMouseMove={showControlsTemporarily}
                onMouseLeave={() => isPlaying && setShowControls(false)}
              >
                {/* YouTube iframe — pointer-events:none so our overlay captures clicks */}
                <div
                  ref={playerDivRef}
                  id="yt-player"
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Click-to-play overlay (covers full video) */}
                <div
                  className="absolute inset-0 cursor-pointer"
                  onClick={togglePlay}
                />

                {/* ── Custom controls overlay ── */}
                <div
                  className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                  <div className="relative px-4 pb-4 pt-10 space-y-2">
                    {/* Progress bar */}
                    <div className="relative h-1 group/seek">
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.25}
                        value={currentTime}
                        onChange={(e) => seekTo(Number(e.target.value))}
                        className="w-full h-1 appearance-none cursor-pointer rounded-full"
                        style={{
                          background: `linear-gradient(to right, #6366F1 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
                        }}
                      />
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center gap-3">

                      {/* Play / Pause */}
                      <button
                        onClick={togglePlay}
                        className="text-white hover:text-[#818CF8] transition-colors cursor-pointer shrink-0"
                      >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                      </button>

                      {/* Time */}
                      <span className="text-xs text-white/70 font-mono shrink-0 tabular-nums">
                        {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Speed icon + dropdown */}
                      <div className="relative" data-dropdown>
                        <button
                          onClick={() => { setSpeedOpen(!speedOpen); setQualityOpen(false) }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            speedOpen ? 'bg-[#6366F1] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                          title="Playback speed"
                        >
                          <Gauge size={14} />
                          {speed}x
                        </button>
                        <ControlDropdown open={speedOpen} onClose={() => setSpeedOpen(false)}>
                          <div className="px-1 py-1">
                            <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Speed</p>
                            {PLAYBACK_SPEEDS.map((s) => (
                              <button
                                key={s}
                                onClick={() => handleSpeedSelect(s)}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                                  speed === s ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                                }`}
                              >
                                {s === 1 ? '1x (Normal)' : `${s}x`}
                              </button>
                            ))}
                            <div className="border-t border-[#1E2A36] mt-1 pt-1 px-2">
                              <p className="text-[10px] text-[#475569]">Hold Space for 2x · Release to restore</p>
                            </div>
                          </div>
                        </ControlDropdown>
                      </div>

                      {/* Quality icon + dropdown */}
                      <div className="relative" data-dropdown>
                        <button
                          onClick={() => { setQualityOpen(!qualityOpen); setSpeedOpen(false) }}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            qualityOpen ? 'bg-[#6366F1] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                          title="Video quality"
                        >
                          <Settings2 size={14} />
                          {QUALITY_LABELS[currentQuality] ?? currentQuality}
                        </button>
                        <ControlDropdown open={qualityOpen} onClose={() => setQualityOpen(false)}>
                          <div className="px-1 py-1">
                            <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Quality</p>
                            {availableQualities.length > 0 ? availableQualities.map((q) => (
                              <button
                                key={q}
                                onClick={() => handleQualitySelect(q)}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                                  currentQuality === q ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                                }`}
                              >
                                {QUALITY_LABELS[q] ?? q}
                              </button>
                            )) : (
                              <p className="text-xs text-[#475569] px-3 py-2">
                                Start playing to<br />load quality options
                              </p>
                            )}
                          </div>
                        </ControlDropdown>
                      </div>

                      {/* Volume */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={toggleMute}
                          className="text-white/70 hover:text-white transition-colors cursor-pointer"
                        >
                          {effectivelyMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={effectivelyMuted ? 0 : volume}
                          onChange={(e) => handleVolumeChange(Number(e.target.value))}
                          className="w-18 h-1 appearance-none cursor-pointer rounded-full"
                          style={{
                            width: '72px',
                            background: `linear-gradient(to right, rgba(255,255,255,0.85) ${effectivelyMuted ? 0 : volume}%, rgba(255,255,255,0.15) ${effectivelyMuted ? 0 : volume}%)`,
                          }}
                          title="Volume"
                        />
                      </div>

                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Fullscreen (F)"
                      >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Completed badge */}
                {isCompleted && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#22C55E]/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none">
                    <CheckCircle2 size={12} /> Completed
                  </div>
                )}

                {/* Space-hold 2x indicator */}
                {speed === 2 && isHoldingSpaceRef.current && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#6366F1]/90 text-white text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none">
                    <Gauge size={12} /> 2× Speed
                  </div>
                )}
              </div>

              {/* Below video */}
              <div className="px-4 py-2.5 border-t border-[#1E2A36] shrink-0">
                <p className="text-xs text-[#64748B]">
                  {lecture.channelName} · {lecture.durationFormatted}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Side Panel ── */}
        {panelOpen && (
          <aside className="w-80 xl:w-96 border-l border-[#1E2A36] bg-[#0B0F14] flex flex-col shrink-0 overflow-hidden">
            <div className="flex border-b border-[#1E2A36]">
              {(['notes', 'bookmarks'] as SidePanelTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                    activeTab === tab ? 'text-[#818CF8] border-b-2 border-[#6366F1]' : 'text-[#64748B] hover:text-[#F8FAFC]'
                  }`}
                >
                  {tab === 'notes' ? <FileText size={13} /> : <Bookmark size={13} />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === 'notes' ? notes.length : bookmarks.length})
                </button>
              ))}
              <button onClick={() => setPanelOpen(false)} className="px-3 text-[#475569] hover:text-[#F8FAFC] cursor-pointer">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTab === 'notes' && (
                <>
                  {notes.length === 0 && <p className="text-xs text-[#64748B] text-center py-8">No notes yet.</p>}
                  {notes.map((n) => (
                    <div key={n.id} className="bg-[#111820] border border-[#1E2A36] rounded-lg p-2.5">
                      <button onClick={() => seekTo(n.timestamp)} className="text-xs font-mono text-[#818CF8] hover:text-[#6366F1] cursor-pointer mb-1">
                        ⏱ {formatDuration(n.timestamp)}
                      </button>
                      <p className="text-xs text-[#F8FAFC] whitespace-pre-wrap">{n.content}</p>
                      {n.category && n.category !== 'general' && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-[#6366F1]/10 text-[#818CF8] capitalize">{n.category}</span>
                      )}
                    </div>
                  ))}
                </>
              )}
              {activeTab === 'bookmarks' && (
                <>
                  {bookmarks.length === 0 && <p className="text-xs text-[#64748B] text-center py-8">No bookmarks yet.</p>}
                  {bookmarks.map((bm) => (
                    <div key={bm.id} className="bg-[#111820] border border-[#1E2A36] rounded-lg p-2.5">
                      <button onClick={() => seekTo(bm.timestamp)} className="text-xs font-mono text-[#818CF8] hover:text-[#6366F1] cursor-pointer">
                        ⏱ {formatDuration(bm.timestamp)}
                      </button>
                      <p className="text-xs text-[#F8FAFC] mt-0.5">{bm.label}</p>
                      <p className="text-[10px] text-[#64748B] capitalize mt-0.5">{bm.category.replace('_', ' ')}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-[#1E2A36] p-3 space-y-2">
              {activeTab === 'notes' ? (
                <>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Note... (saves current timestamp)"
                    className="w-full bg-[#111820] border border-[#1E2A36] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] resize-none focus:outline-none focus:ring-1 focus:ring-[#6366F1] h-20"
                  />
                  <div className="flex flex-wrap gap-1">
                    {NOTE_CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setNoteCategory(c)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                          noteCategory === c ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#818CF8]' : 'border-[#1E2A36] text-[#64748B]'
                        }`}
                      >{c}</button>
                    ))}
                  </div>
                  <Button size="sm" className="w-full" isLoading={isSavingNote} onClick={handleAddNote}>
                    Save Note at {formatDuration(Math.floor(localPositionRef.current))}
                  </Button>
                </>
              ) : (
                <>
                  <input
                    value={bmLabel}
                    onChange={(e) => setBmLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full bg-[#111820] border border-[#1E2A36] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  />
                  <div className="flex flex-wrap gap-1">
                    {BM_CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setBmCategory(c)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                          bmCategory === c ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#818CF8]' : 'border-[#1E2A36] text-[#64748B]'
                        }`}
                      >{c.replace('_', ' ')}</button>
                    ))}
                  </div>
                  <Button size="sm" className="w-full" isLoading={isSavingBm} onClick={handleAddBookmark}>
                    <Bookmark size={12} /> Bookmark at {formatDuration(Math.floor(localPositionRef.current))}
                  </Button>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Resume Dialog ── */}
      <Modal isOpen={showResumeDialog} onClose={() => setShowResumeDialog(false)} title="Resume where you left off?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            You were at{' '}
            <span className="text-[#F8FAFC] font-semibold">{formatDuration(savedProgress?.currentPosition ?? 0)}</span>
            {' '}({savedProgress?.percentage ?? 0}% watched).
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" className="flex-1" onClick={handleStartOver}>Start Over</Button>
            <Button size="sm" className="flex-1" onClick={handleResume}>Resume</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
