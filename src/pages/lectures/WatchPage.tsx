/**
 * WatchPage — /watch/:lectureId
 * Distraction-free lecture player with fully custom controls.
 *
 * Controls:
 *  - Space (click) = play/pause
 *  - Space (hold 300ms) = 2× speed; release = restore previous speed
 *  - ← / → = seek ±seekInterval seconds (configurable in Settings → Playback)
 *  - M = mute
 *  - F = fullscreen
 *  - Esc = close panels / dropdowns
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, CheckCircle2, AlertTriangle, FileText, Bookmark,
  X, Star, Zap, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Gauge, Settings2, SkipBack, SkipForward, Clock, Paperclip,
  ExternalLink, List,
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
import { useBreakReminder } from '@/hooks/useBreakReminder'
import { buildRoute, ROUTES } from '@/constants/routes'
import { formatDuration } from '@/utils/time.utils'
import { calcPercentage } from '@/utils/progress.utils'
import {
  COMPLETION_THRESHOLD, PROGRESS_SAVE_INTERVAL,
  SESSION_IDLE_TIMEOUT, RESUME_THRESHOLD, PLAYBACK_SPEEDS,
  DEFAULT_SEEK_INTERVAL,
} from '@/constants/firebase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import BreakReminderModal from '@/components/ui/BreakReminderModal'

// ── Error messages ────────────────────────────────────────────────────
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

type SidePanelTab = 'notes' | 'bookmarks' | 'timestamps'
const NOTE_CATEGORIES: NoteCategory[] = ['important', 'formula', 'exam', 'confusing', 'revision', 'general']
const BM_CATEGORIES: BookmarkCategory[] = ['important', 'formula', 'exam_question', 'confusing', 'revision', 'example']

// ── Dropdown popup ────────────────────────────────────────────────────
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
      className="absolute bottom-full mb-2 right-0 bg-[#0B0F14] border border-[#1E2A36] rounded-xl shadow-xl py-1 z-50 min-w-max max-h-64 overflow-y-auto"
    >
      {children}
    </div>
  )
}

// ── Reusable ctrl button style ────────────────────────────────────────
const ctrlBtn = 'flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 transition-colors cursor-pointer shrink-0'

export default function WatchPage() {
  const { lectureId } = useParams<{ lectureId: string }>()
  const { user, userDoc, updateProgressMap } = useAuth()
  const navigate = useNavigate()

  // Configurable seek interval (from user settings, default 10s)
  const seekInterval: 5 | 10 = userDoc?.seekInterval ?? (DEFAULT_SEEK_INTERVAL as 5 | 10)

  // ── Data ──────────────────────────────────────────────────────────
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  // ── Resume ────────────────────────────────────────────────────────
  const [savedProgress, setSavedProgress] = useState<LectureProgress | null>(null)
  const [showResumeDialog, setShowResumeDialog] = useState(false)

  // ── Playback state ────────────────────────────────────────────────
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

  // ── Dropdowns ─────────────────────────────────────────────────────
  const [speedOpen, setSpeedOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

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
  const containerRef = useRef<HTMLDivElement>(null)  // fullscreen target (whole page)
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
  const isHoldingSpaceRef = useRef(false)
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preHoldSpeedRef = useRef(speedRef.current)

  useEffect(() => { lectureRef.current = lecture }, [lecture])
  useEffect(() => { speedRef.current = speed }, [speed])

  // ── Break reminder ─────────────────────────────────────────────────
  const breakReminder = useBreakReminder(userDoc?.breakReminderMinutes ?? 50)

  // Track active study time via isPlaying state (avoids stale closure in YT handler)
  useEffect(() => {
    if (isPlaying) {
      breakReminder.start()
    } else {
      breakReminder.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

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
        } as any,
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
  }, [lecture])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────
  // Re-bind when seekInterval changes so ←/→ uses the updated value
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        preHoldSpeedRef.current = speedRef.current
        spaceHoldTimerRef.current = setTimeout(() => {
          isHoldingSpaceRef.current = true
          spaceHoldTimerRef.current = null
          playerRef.current?.setPlaybackRate(2)
          setSpeed(2)
        }, 300)
        return
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekByKb(-seekInterval) }
      if (e.key === 'ArrowRight') { e.preventDefault(); seekByKb(seekInterval) }
      if (e.key === 'm' || e.key === 'M') toggleMute()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'Escape') {
        setPanelOpen(false)
        setSpeedOpen(false)
        setQualityOpen(false)
        setAttachOpen(false)
        setMoreOpen(false)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        if (spaceHoldTimerRef.current !== null) {
          clearTimeout(spaceHoldTimerRef.current)
          spaceHoldTimerRef.current = null
          togglePlay()
        } else if (isHoldingSpaceRef.current) {
          isHoldingSpaceRef.current = false
          const prev = preHoldSpeedRef.current
          playerRef.current?.setPlaybackRate(prev)
          setSpeed(prev)
        }
      }
    }

    // Thin wrappers that read seekInterval from closure
    function seekByKb(delta: number) {
      const next = Math.max(0, Math.min(localPositionRef.current + delta, localDurationRef.current))
      playerRef.current?.seekTo(next, true)
      setCurrentTime(next)
      localPositionRef.current = next
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [seekInterval]) // eslint-disable-line react-hooks/exhaustive-deps

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls auto-hide (active in fullscreen) ─────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      if (document.fullscreenElement) setShowControls(false)
    }, 3000)
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
      stopPolling(); flushProgress(); endSession()
    }
    if (s === YTState?.BUFFERING) {
      stopPolling()
    }
    if (s === YTState?.ENDED) {
      setIsPlaying(false)
      setShowControls(true)
      stopPolling(); flushProgress(); endSession()
    }
  }, [showControlsTemporarily]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Progress persistence ──────────────────────────────────────────
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
    const clamped = Math.max(0, Math.min(seconds, localDurationRef.current))
    playerRef.current?.seekTo(clamped, true)
    setCurrentTime(clamped)
    localPositionRef.current = clamped
    // Flush progress on seek
    setTimeout(flushProgress, 100)
  }, [flushProgress])

  const seekBy = useCallback((delta: number) => {
    seekTo(localPositionRef.current + delta)
  }, [seekTo])

  const handleVolumeChange = useCallback((val: number) => {
    playerRef.current?.setVolume(val)
    setVolume(val)
    if (val === 0) { playerRef.current?.mute(); setIsMuted(true) }
    else { playerRef.current?.unMute(); setIsMuted(false) }
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
    setSpeed(s); speedRef.current = s; preHoldSpeedRef.current = s
    setSpeedOpen(false); setMoreOpen(false)
  }, [])

  const handleQualitySelect = useCallback((q: string) => {
    ;(playerRef.current as any)?.setPlaybackQuality?.(q)
    setCurrentQuality(q); setQualityOpen(false); setMoreOpen(false)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) containerRef.current.requestFullscreen()
    else document.exitFullscreen()
  }, [])

  const openPanel = useCallback((tab: SidePanelTab) => {
    setActiveTab(tab); setPanelOpen(true)
    setSpeedOpen(false); setQualityOpen(false); setAttachOpen(false); setMoreOpen(false)
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
    setNoteText(''); setIsSavingNote(false)
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
    setBmLabel(''); setIsSavingBm(false)
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

  // ── Derived values ────────────────────────────────────────────────
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const effectivelyMuted = isMuted || volume === 0
  const hasAttachments = Boolean((lecture.attachments?.length ?? 0) > 0 || lecture.slideUrl)
  const hasTimestamps = (lecture.timestamps?.length ?? 0) > 0
  const currentTimeLabel = formatDuration(Math.floor(localPositionRef.current))

  // ── Side panel content (shared between normal + fullscreen) ───────
  const panelContent = (
    <>
      {/* Tab bar */}
      <div className="flex border-b border-[#1E2A36] shrink-0">
        {(['notes', 'bookmarks', 'timestamps'] as SidePanelTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
              activeTab === tab ? 'text-[#818CF8] border-b-2 border-[#6366F1]' : 'text-[#64748B] hover:text-[#F8FAFC]'
            }`}
            aria-label={tab.charAt(0).toUpperCase() + tab.slice(1)}
          >
            {tab === 'notes' && <FileText size={12} />}
            {tab === 'bookmarks' && <Bookmark size={12} />}
            {tab === 'timestamps' && <Clock size={12} />}
            <span className="capitalize">{tab}</span>
          </button>
        ))}
        <button
          onClick={() => setPanelOpen(false)}
          className="px-3 text-[#475569] hover:text-[#F8FAFC] cursor-pointer shrink-0"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'notes' && (
          <>
            {notes.length === 0 && <p className="text-xs text-[#64748B] text-center py-8">No notes yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className="bg-[#111820] border border-[#1E2A36] rounded-lg p-2.5">
                <button onClick={() => seekTo(n.timestamp)} className="text-xs font-mono text-[#818CF8] hover:text-[#6366F1] cursor-pointer mb-1 block">
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
                <button onClick={() => seekTo(bm.timestamp)} className="text-xs font-mono text-[#818CF8] hover:text-[#6366F1] cursor-pointer block">
                  ⏱ {formatDuration(bm.timestamp)}
                </button>
                <p className="text-xs text-[#F8FAFC] mt-0.5">{bm.label}</p>
                <p className="text-[10px] text-[#64748B] capitalize mt-0.5">{bm.category.replace('_', ' ')}</p>
              </div>
            ))}
          </>
        )}

        {activeTab === 'timestamps' && (
          <>
            {!hasTimestamps && (
              <p className="text-xs text-[#64748B] text-center py-8 leading-relaxed">
                No timestamps for this lecture.
                <br />
                <span className="text-[#475569]">Add timestamps when editing the lecture.</span>
              </p>
            )}
            {lecture.timestamps?.map((ts, i) => (
              <button
                key={i}
                onClick={() => seekTo(ts.time)}
                className="w-full flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-lg p-2.5 hover:border-[#6366F1]/40 transition-colors cursor-pointer group text-left"
              >
                <span className="text-xs font-mono text-[#818CF8] group-hover:text-[#6366F1] shrink-0 tabular-nums">
                  {formatDuration(ts.time)}
                </span>
                <span className="text-xs text-[#F8FAFC] truncate">{ts.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Input footer */}
      <div className="border-t border-[#1E2A36] p-3 space-y-2 shrink-0">
        {activeTab === 'notes' ? (
          <>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={`Note at ${currentTimeLabel}...`}
              className="w-full bg-[#111820] border border-[#1E2A36] rounded-lg px-3 py-2 text-xs text-[#F8FAFC] placeholder-[#64748B] resize-none focus:outline-none focus:ring-1 focus:ring-[#6366F1] h-20"
            />
            <div className="flex flex-wrap gap-1">
              {NOTE_CATEGORIES.map((c) => (
                <button key={c} onClick={() => setNoteCategory(c)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
                    noteCategory === c ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#818CF8]' : 'border-[#1E2A36] text-[#64748B] hover:border-[#6366F1]/40'
                  }`}
                >{c}</button>
              ))}
            </div>
            <Button size="sm" className="w-full" isLoading={isSavingNote} onClick={handleAddNote}>
              Save Note at {currentTimeLabel}
            </Button>
          </>
        ) : activeTab === 'bookmarks' ? (
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
                    bmCategory === c ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#818CF8]' : 'border-[#1E2A36] text-[#64748B] hover:border-[#6366F1]/40'
                  }`}
                >{c.replace('_', ' ')}</button>
              ))}
            </div>
            <Button size="sm" className="w-full" isLoading={isSavingBm} onClick={handleAddBookmark}>
              <Bookmark size={12} /> Bookmark at {currentTimeLabel}
            </Button>
          </>
        ) : (
          <p className="text-xs text-[#475569] text-center">Click any timestamp to jump to that moment.</p>
        )}
      </div>
    </>
  )

  // ── Isolated progress bar ─────────────────────────────────────────
  const progressBar = (
    <div
      className="px-3 py-2"
      onClick={(e) => { e.stopPropagation(); e.preventDefault() }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="range"
        min={0}
        max={duration || 100}
        step={0.25}
        value={currentTime}
        onChange={(e) => seekTo(Number(e.target.value))}
        className="w-full h-1.5 appearance-none cursor-pointer rounded-full"
        style={{
          background: `linear-gradient(to right, #6366F1 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
          touchAction: 'none',
        }}
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
      />
    </div>
  )

  // ── Controls bar ──────────────────────────────────────────────────
  const controlsBar = (
    <div
      className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 pb-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Rewind ── */}
      <button
        onClick={() => seekBy(-seekInterval)}
        className={`${ctrlBtn} flex-col text-white/70 hover:text-white`}
        title={`Rewind ${seekInterval}s`}
        aria-label={`Rewind ${seekInterval} seconds`}
      >
        <SkipBack size={18} />
        <span className="text-[9px] text-white/40 leading-none mt-0.5">{seekInterval}s</span>
      </button>

      {/* ── Play / Pause ── */}
      <button
        onClick={togglePlay}
        className={`${ctrlBtn} text-white hover:text-[#818CF8]`}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>

      {/* ── Forward ── */}
      <button
        onClick={() => seekBy(seekInterval)}
        className={`${ctrlBtn} flex-col text-white/70 hover:text-white`}
        title={`Forward ${seekInterval}s`}
        aria-label={`Forward ${seekInterval} seconds`}
      >
        <SkipForward size={18} />
        <span className="text-[9px] text-white/40 leading-none mt-0.5">{seekInterval}s</span>
      </button>

      {/* ── Time (hidden on small mobile) ── */}
      <span className="hidden xs:block text-xs text-white/55 font-mono shrink-0 tabular-nums ml-1">
        {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
      </span>

      <div className="flex-1" />

      {/* ── Speed (desktop) ── */}
      <div className="relative hidden sm:block" data-dropdown>
        <button
          onClick={() => { setSpeedOpen(!speedOpen); setQualityOpen(false); setMoreOpen(false) }}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            speedOpen ? 'bg-[#6366F1] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="Playback speed"
          aria-label={`Speed: ${speed}x`}
        >
          <Gauge size={13} />{speed}x
        </button>
        <ControlDropdown open={speedOpen} onClose={() => setSpeedOpen(false)}>
          <div className="px-1 py-1">
            <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Speed</p>
            {PLAYBACK_SPEEDS.map((s) => (
              <button key={s} onClick={() => handleSpeedSelect(s)}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                  speed === s ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                }`}
              >
                {s === 1 ? '1× (Normal)' : `${s}×`}
              </button>
            ))}
            <div className="border-t border-[#1E2A36] mt-1 pt-1 px-2">
              <p className="text-[10px] text-[#475569]">Hold Space for 2× · Release to restore</p>
            </div>
          </div>
        </ControlDropdown>
      </div>

      {/* ── Quality (desktop) ── */}
      {availableQualities.length > 0 && (
        <div className="relative hidden sm:block" data-dropdown>
          <button
            onClick={() => { setQualityOpen(!qualityOpen); setSpeedOpen(false); setMoreOpen(false) }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              qualityOpen ? 'bg-[#6366F1] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Video quality"
            aria-label={`Quality: ${QUALITY_LABELS[currentQuality] ?? currentQuality}`}
          >
            <Settings2 size={13} />{QUALITY_LABELS[currentQuality] ?? currentQuality}
          </button>
          <ControlDropdown open={qualityOpen} onClose={() => setQualityOpen(false)}>
            <div className="px-1 py-1">
              <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Quality</p>
              {availableQualities.map((q) => (
                <button key={q} onClick={() => handleQualitySelect(q)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                    currentQuality === q ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                  }`}
                >
                  {QUALITY_LABELS[q] ?? q}
                </button>
              ))}
            </div>
          </ControlDropdown>
        </div>
      )}

      {/* ── Volume (mute icon always; slider hidden on mobile) ── */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={toggleMute}
          className={`${ctrlBtn} text-white/70 hover:text-white`}
          title={effectivelyMuted ? 'Unmute (M)' : 'Mute (M)'}
          aria-label={effectivelyMuted ? 'Unmute' : 'Mute'}
        >
          {effectivelyMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range" min={0} max={100}
          value={effectivelyMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="hidden sm:block h-1 appearance-none cursor-pointer rounded-full"
          style={{
            width: '64px',
            background: `linear-gradient(to right, rgba(255,255,255,0.85) ${effectivelyMuted ? 0 : volume}%, rgba(255,255,255,0.15) ${effectivelyMuted ? 0 : volume}%)`,
          }}
          aria-label="Volume"
        />
      </div>

      {/* ── Notes button ── */}
      <button
        onClick={() => openPanel('notes')}
        className={`${ctrlBtn} px-1.5 rounded-lg text-xs ${
          panelOpen && activeTab === 'notes' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Notes"
        aria-label="Notes"
      >
        <FileText size={16} />
        <span className="hidden xl:block ml-1">Notes</span>
      </button>

      {/* ── Bookmarks button ── */}
      <button
        onClick={() => openPanel('bookmarks')}
        className={`${ctrlBtn} px-1.5 rounded-lg text-xs ${
          panelOpen && activeTab === 'bookmarks' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Bookmarks"
        aria-label="Bookmarks"
      >
        <Bookmark size={16} />
        <span className="hidden xl:block ml-1">Marks</span>
      </button>

      {/* ── Timestamps button (only if timestamps exist) ── */}
      {hasTimestamps && (
        <button
          onClick={() => openPanel('timestamps')}
          className={`${ctrlBtn} px-1.5 rounded-lg text-xs ${
            panelOpen && activeTab === 'timestamps' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="Timestamps"
          aria-label="Timestamps / Chapters"
        >
          <List size={16} />
        </button>
      )}

      {/* ── Attachments (only if lecture has attachments) ── */}
      {hasAttachments && (
        <div className="relative" data-dropdown>
          <button
            onClick={() => { setAttachOpen(!attachOpen); setSpeedOpen(false); setQualityOpen(false); setMoreOpen(false) }}
            className={`${ctrlBtn} px-1.5 rounded-lg ${
              attachOpen ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Attachments"
            aria-label="Attachments"
          >
            <Paperclip size={16} />
          </button>
          <ControlDropdown open={attachOpen} onClose={() => setAttachOpen(false)}>
            <div className="px-1 py-1">
              <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Attachments</p>
              {lecture.slideUrl && (
                <a
                  href={lecture.slideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAttachOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[#818CF8] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 font-medium transition-colors mb-0.5"
                >
                  <FileText size={12} className="shrink-0" />
                  <span className="truncate max-w-[180px]">Lecture Slide</span>
                  <ExternalLink size={11} className="shrink-0 opacity-70 ml-auto" />
                </a>
              )}
              {lecture.attachments?.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setAttachOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC] transition-colors"
                >
                  <Paperclip size={12} className="shrink-0" />
                  <span className="truncate max-w-[180px]">{att.title}</span>
                  <ExternalLink size={11} className="shrink-0 opacity-50 ml-auto" />
                </a>
              ))}
            </div>
          </ControlDropdown>
        </div>
      )}

      {/* ── More menu (mobile only: speed + quality) ── */}
      <div className="relative sm:hidden" data-dropdown>
        <button
          onClick={() => { setMoreOpen(!moreOpen); setAttachOpen(false) }}
          className={`${ctrlBtn} px-1.5 rounded-lg ${
            moreOpen ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="More options"
          aria-label="More options"
        >
          <Settings2 size={16} />
        </button>
        <ControlDropdown open={moreOpen} onClose={() => setMoreOpen(false)}>
          <div className="px-1 py-1">
            <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Speed</p>
            {PLAYBACK_SPEEDS.map((s) => (
              <button key={s} onClick={() => handleSpeedSelect(s)}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                  speed === s ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                }`}
              >{s === 1 ? '1× (Normal)' : `${s}×`}</button>
            ))}
            {availableQualities.length > 0 && (
              <>
                <div className="border-t border-[#1E2A36] my-1" />
                <p className="text-[10px] text-[#64748B] px-2 py-1 font-semibold uppercase tracking-wide">Quality</p>
                {availableQualities.map((q) => (
                  <button key={q} onClick={() => handleQualitySelect(q)}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                      currentQuality === q ? 'bg-[#6366F1]/20 text-[#818CF8] font-semibold' : 'text-[#94A3B8] hover:bg-[#111820] hover:text-[#F8FAFC]'
                    }`}
                  >{QUALITY_LABELS[q] ?? q}</button>
                ))}
              </>
            )}
          </div>
        </ControlDropdown>
      </div>

      {/* ── Fullscreen ── */}
      <button
        onClick={toggleFullscreen}
        className={`${ctrlBtn} text-white/70 hover:text-white`}
        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`select-none flex flex-col ${isFullscreen ? 'bg-black' : 'min-h-screen bg-[#0B0F14]'}`}
    >
      {/* ── Top bar (hidden in fullscreen) ── */}
      {!isFullscreen && (
        <header className="h-12 flex items-center justify-between px-3 border-b border-[#1E2A36] bg-[#0B0F14] shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to={buildRoute(ROUTES.CHAPTER, { subjectId: lecture.subjectId, chapterId: lecture.chapterId })}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820] transition-colors shrink-0"
              aria-label="Go back to chapter"
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
        </header>
      )}

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Video + controls column ── */}
        <div className={`flex flex-col min-w-0 ${panelOpen && !isFullscreen ? 'flex-1' : 'w-full'}`}>

          {playerError ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-4 py-12">
              <AlertTriangle size={36} className="text-[#EF4444]" />
              <p className="text-sm text-[#94A3B8] max-w-xs">{playerError}</p>
              <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          ) : (
            <>
              {/* ── Video area ── */}
              <div
                className={`relative bg-black ${isFullscreen ? 'flex-1' : ''}`}
                style={isFullscreen ? undefined : { aspectRatio: '16/9' }}
                onMouseMove={isFullscreen ? showControlsTemporarily : undefined}
                onTouchStart={isFullscreen ? showControlsTemporarily : undefined}
                onMouseLeave={() => isFullscreen && isPlaying && setShowControls(false)}
              >
                {/* YouTube iframe */}
                <div
                  ref={playerDivRef}
                  id="yt-player"
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Click-to-play overlay — explicit pointer target */}
                <div
                  className="absolute inset-0 cursor-pointer"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  role="button"
                />

                {/* Completed badge */}
                {isCompleted && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-[#22C55E]/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none z-10">
                    <CheckCircle2 size={12} /> Completed
                  </div>
                )}

                {/* Speed-hold badge */}
                {speed === 2 && isHoldingSpaceRef.current && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#6366F1]/90 text-white text-xs font-bold px-2.5 py-1 rounded-full pointer-events-none z-10">
                    <Gauge size={12} /> 2× Speed
                  </div>
                )}

                {/* ── Fullscreen: controls overlay (auto-hide) ── */}
                {isFullscreen && (
                  <div
                    className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 z-20 ${
                      showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Gradient bg */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                    <div className="relative pt-10 space-y-0">
                      {/* Time display in fullscreen */}
                      <div className="px-4 mb-0">
                        <span className="text-xs text-white/50 font-mono tabular-nums">
                          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
                        </span>
                      </div>
                      {progressBar}
                      <div className="pb-3">{controlsBar}</div>
                    </div>
                  </div>
                )}

                {/* ── Fullscreen: side panel (absolute right) ── */}
                {panelOpen && isFullscreen && (
                  <aside
                    className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-[#0B0F14]/96 backdrop-blur-sm border-l border-[#1E2A36] flex flex-col overflow-hidden z-30"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {panelContent}
                  </aside>
                )}

                {/* ── Break reminder (inside video div = visible in fullscreen) ── */}
                <BreakReminderModal
                  isVisible={breakReminder.reminderDue}
                  studiedMinutes={Math.floor(breakReminder.activeSeconds / 60)}
                  onStartBreak={breakReminder.reset}
                  onSnooze={() => breakReminder.snooze(5)}
                  onDismiss={breakReminder.dismiss}
                />
              </div>

              {/* ── Normal mode: progress bar (isolated row) ── */}
              {!isFullscreen && (
                <div className="bg-[#0d1117] border-t border-[#1E2A36]">
                  {progressBar}
                </div>
              )}

              {/* ── Normal mode: controls bar (isolated row) ── */}
              {!isFullscreen && (
                <div className="bg-[#0B0F14] border-t border-[#0d1117] py-1">
                  {controlsBar}
                </div>
              )}

              {/* ── Normal mode: metadata strip ── */}
              {!isFullscreen && (
                <div className="px-3 py-2 text-xs text-[#64748B] shrink-0 border-t border-[#1E2A36]">
                  {lecture.channelName && <span>{lecture.channelName} · </span>}
                  <span>{lecture.durationFormatted}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Side panel (normal mode — fixed bottom on mobile, right sidebar on md+) ── */}
        {panelOpen && !isFullscreen && (
          <aside className="
            fixed bottom-0 left-0 right-0 h-[65vh] z-50
            md:static md:h-auto md:w-80 xl:w-96 md:z-auto md:shrink-0
            bg-[#0B0F14] border-t md:border-t-0 md:border-l border-[#1E2A36]
            flex flex-col overflow-hidden
          ">
            {panelContent}
          </aside>
        )}
      </div>

      {/* ── Resume dialog ── */}
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
