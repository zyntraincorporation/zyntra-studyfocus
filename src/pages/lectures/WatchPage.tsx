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
  X, Star, Zap, Play, Pause, Volume1, Volume2, VolumeX, Maximize, Minimize,
  Gauge, Settings2, SkipBack, SkipForward, Clock, Paperclip,
  ExternalLink, List, Subtitles, Presentation, BookOpen, Maximize2, Minimize2,
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
import DOMPurify from 'dompurify'
import { renderMathInHtml } from '@/utils/mathRenderer'

// ── Sanitize lecture note HTML ─────────────────────────────────────────
function sanitizeWatchNote(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's',
      'code', 'pre', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'sup', 'sub', 'caption', 'colgroup', 'col',
      'details', 'summary', 'mark', 'small', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: ['style', 'class', 'colspan', 'rowspan', 'id', 'open'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src'],
  })
  return renderMathInHtml(clean)
}

/**
 * StableHtmlNote — renders sanitized HTML via a ref so that parent re-renders
 * (e.g. the 1-second polling interval that updates currentTime) never reset the
 * DOM. This preserves <details> open/closed state across re-renders.
 */
function StableHtmlNote({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const elRef = useRef<HTMLDivElement>(null)
  const prevHtmlRef = useRef<string>('')

  useEffect(() => {
    if (!elRef.current) return
    if (prevHtmlRef.current === html) return   // nothing changed — keep DOM untouched
    prevHtmlRef.current = html
    elRef.current.innerHTML = html
  }, [html])

  return <div ref={elRef} className={className} style={style} />
}

// ── Error messages ────────────────────────────────────────────────────
const PLAYER_ERRORS: Record<number, string> = {
  2: 'Invalid video — please check the YouTube URL.',
  5: 'HTML5 player error. Try refreshing.',
  100: 'This video is unavailable or private.',
  101: 'This video cannot be embedded.',
  150: 'This video cannot be embedded.',
}

const QUALITY_LABELS: Record<string, string> = {
  auto: 'Auto',
  hd1080: '1080p HD',
  hd720: '720p HD',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
}

const ALL_QUALITIES = ['auto', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny']

type SidePanelTab = 'notes' | 'bookmarks' | 'timestamps'
const NOTE_CATEGORIES: NoteCategory[] = ['important', 'formula', 'exam', 'confusing', 'revision', 'general']
const BM_CATEGORIES: BookmarkCategory[] = ['important', 'formula', 'exam_question', 'confusing', 'revision', 'example']

// ── Convert any Google Drive share URL → clean embeddable preview URL ─
function toSlideEmbedUrl(url: string): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (trimmed.includes('/preview')) return trimmed
  if (trimmed.includes('docs.google.com/viewer')) return trimmed

  const mFile = trimmed.match(/\/file\/d\/([^/?#]+)/)
  if (mFile) return `https://drive.google.com/file/d/${mFile[1]}/preview`

  const mId = trimmed.match(/[?&]id=([^&#]+)/)
  if (mId) return `https://drive.google.com/file/d/${mId[1]}/preview`

  const mDocs = trimmed.match(/docs\.google\.com\/(presentation|document|spreadsheets)\/d\/([^/?#]+)/)
  if (mDocs) return `https://docs.google.com/${mDocs[1]}/d/${mDocs[2]}/preview`

  if (trimmed.includes('drive.google.com')) {
    const rawIdMatch = trimmed.match(/[-\w]{25,}/)
    if (rawIdMatch) return `https://drive.google.com/file/d/${rawIdMatch[0]}/preview`
  }

  if (/\.pdf($|[?#])/i.test(trimmed)) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`
  }

  return trimmed
}

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
      className="absolute bottom-full mb-2 right-0 bg-[#0B0F14] border border-[#1E2A36] rounded-xl shadow-xl py-1 z-50 min-w-max max-h-[70vh] overflow-y-auto"
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
  const showClock: boolean = userDoc?.showClock ?? true

  // ── Bangladesh Live Clock (HH:MM AM/PM) ──────────────────────────
  const [bdTime, setBdTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(now)
      setBdTime(formatted)
    }

    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

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
  const [availableQualities, setAvailableQualities] = useState<string[]>(ALL_QUALITIES)
  const [currentQuality, setCurrentQuality] = useState('auto')
  const [qualityOpen, setQualityOpen] = useState(false)

  // ── Captions / Subtitles ──────────────────────────────────────────
  const [isCaptionsOn, setIsCaptionsOn] = useState(false)

  // ── HUD Notification State (Volume / Seek / Quality / Speed / CC) ──
  const [hud, setHud] = useState<{
    icon: 'volume' | 'volume-low' | 'mute' | 'seek-back' | 'seek-forward' | 'speed' | 'quality' | 'captions'
    text: string
    value?: number
  } | null>(null)
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showHud = useCallback((
    icon: 'volume' | 'volume-low' | 'mute' | 'seek-back' | 'seek-forward' | 'speed' | 'quality' | 'captions',
    text: string,
    value?: number
  ) => {
    setHud({ icon, text, value })
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current)
    hudTimerRef.current = setTimeout(() => setHud(null), 1500)
  }, [])

  // ── Dropdowns ─────────────────────────────────────────────────────
  const [speedOpen, setSpeedOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [slideModalOpen, setSlideModalOpen] = useState(false)
  const [contentTab, setContentTab] = useState<'slide' | 'note' | 'split'>('slide')
  const [noteFullscreen, setNoteFullscreen] = useState(false)
  const [noteHalfPage, setNoteHalfPage] = useState(false)
  const [noteFullWidth, setNoteFullWidth] = useState(false)
  const [noteModalFullWidth, setNoteModalFullWidth] = useState(false)
  const [noteZoom, setNoteZoom] = useState(100)

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
  const lastClickRef = useRef<{ time: number; xPercent: number } | null>(null)
  const isCaptionsOnRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableTracksRef = useRef<any[]>([])
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

  // ── Update Quality Options ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateQualities = useCallback((p?: any) => {
    const pl = p || playerRef.current
    if (!pl) return
    try {
      const quals = pl.getAvailableQualityLevels?.()
      if (Array.isArray(quals) && quals.length > 0) {
        const filtered = quals.filter((q: string) => q !== 'auto' && q !== 'tiny' && q !== 'small')
        const list = ['auto', ...quals.filter((q: string) => q !== 'auto')]
        setAvailableQualities(list)

        // Auto-set highest quality: prefer hd1080, else hd720, else highest available
        const PREFERRED = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small']
        const best = PREFERRED.find(q => filtered.includes(q)) ?? (filtered[0] || 'hd1080')
        try {
          pl.setPlaybackQuality?.(best)
          pl.setPlaybackQualityRange?.(best, best)
        } catch { /* ignore */ }
        setCurrentQuality(best)
      } else {
        setAvailableQualities(ALL_QUALITIES)
        try {
          pl.setPlaybackQuality?.('hd1080')
          pl.setPlaybackQualityRange?.('hd1080', 'hd1080')
        } catch { /* ignore */ }
        setCurrentQuality('hd1080')
      }
    } catch {
      setAvailableQualities(ALL_QUALITIES)
    }
  }, [])

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
      if (lec?.slideUrl) {
        setContentTab('slide')
      } else if (lec?.noteHtml) {
        setContentTab('note')
      }
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
          cc_load_policy: 1,
          cc_lang_pref: 'bn',
          autohide: 1,
        } as any,
        events: {
          onReady: (e: YT.PlayerEvent) => {
            setIsPlayerReady(true)
            const dur = e.target.getDuration()
            localDurationRef.current = dur
            setDuration(dur)
            e.target.setPlaybackRate(speedRef.current)
            updateQualities(e.target)
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pl = e.target as any
              pl.loadModule?.('captions')
              pl.setOption?.('captions', 'fontSize', -1)
              pl.setOption?.('captions', 'textAlign', 'center')
              pl.setOption?.('captions', 'alignment', 'center')
              pl.setOption?.('captions', 'position', { x: 50, y: 88 })
              if (!isCaptionsOnRef.current) {
                pl.setOption?.('captions', 'track', {})
              }
            } catch { /* ignore */ }
          },
          onApiChange: (e: any) => {
            try {
              const tracklist = e?.target?.getOption?.('captions', 'tracklist') || e?.target?.getOption?.('cc', 'tracklist')
              if (Array.isArray(tracklist) && tracklist.length > 0) {
                availableTracksRef.current = tracklist
              }
            } catch { /* ignore */ }
          },
          onStateChange: handleStateChange,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPlaybackQualityChange: (e: any) => {
            if (e?.data) setCurrentQuality(e.data)
          },
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

  // ── Controls auto-hide (active when playing) ─────────────────────
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2500)
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
      updateQualities()
    }
    if (s === YTState?.PAUSED) {
      setIsPlaying(false)
      setShowControls(true)
      stopPolling(); flushProgress(); endSession()
    }
    if (s === YTState?.BUFFERING) {
      stopPolling()
      updateQualities()
    }
    if (s === YTState?.ENDED) {
      setIsPlaying(false)
      setShowControls(true)
      stopPolling(); flushProgress(); endSession()
    }
  }, [showControlsTemporarily, updateQualities]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (s === window.YT?.PlayerState?.PLAYING) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
    showControlsTemporarily()
  }, [showControlsTemporarily])

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, localDurationRef.current))
    playerRef.current?.seekTo(clamped, true)
    setCurrentTime(clamped)
    localPositionRef.current = clamped
    showControlsTemporarily()
    // Flush progress on seek
    setTimeout(flushProgress, 100)
  }, [flushProgress, showControlsTemporarily])

  const seekBy = useCallback((delta: number) => {
    seekTo(localPositionRef.current + delta)
  }, [seekTo])

  const handleVolumeChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val))
    playerRef.current?.setVolume(clamped)
    setVolume(clamped)
    if (clamped === 0) {
      playerRef.current?.mute()
      setIsMuted(true)
      showHud('mute', 'Muted', 0)
    } else {
      playerRef.current?.unMute()
      setIsMuted(false)
      showHud(clamped > 50 ? 'volume' : 'volume-low', `${clamped}%`, clamped)
    }
  }, [showHud])

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return
    if (isMuted || playerRef.current.isMuted()) {
      playerRef.current.unMute()
      setIsMuted(false)
      const v = volume === 0 ? 80 : volume
      playerRef.current.setVolume(v)
      setVolume(v)
      showHud(v > 50 ? 'volume' : 'volume-low', `${v}%`, v)
    } else {
      playerRef.current.mute()
      setIsMuted(true)
      showHud('mute', 'Muted', 0)
    }
  }, [isMuted, volume, showHud])

  const handleSpeedSelect = useCallback((s: number) => {
    playerRef.current?.setPlaybackRate(s)
    setSpeed(s)
    speedRef.current = s
    preHoldSpeedRef.current = s
    setSpeedOpen(false)
    setMoreOpen(false)
    showHud('speed', `${s}× Speed`)
  }, [showHud])

  const handleQualitySelect = useCallback((q: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = playerRef.current as any
    if (p) {
      try {
        p.setPlaybackQuality?.(q)
        p.setPlaybackQualityRange?.(q, q)
        const pos = localPositionRef.current
        if (pos > 0) {
          p.seekTo?.(pos, true)
        }
      } catch (err) {
        console.warn('Quality change error:', err)
      }
    }
    setCurrentQuality(q)
    setQualityOpen(false)
    setMoreOpen(false)
    showHud('quality', `Quality: ${QUALITY_LABELS[q] ?? q}`)
  }, [showHud])

  // Toggle Subtitles / Captions
  const toggleCaptions = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = playerRef.current as any
    if (!p) return

    const next = !isCaptionsOnRef.current
    isCaptionsOnRef.current = next
    setIsCaptionsOn(next)

    // Send direct postMessage command to YouTube iframe contentWindow
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postCmd = (func: string, args: any[]) => {
      try {
        const iframe = p.getIframe?.()
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func,
            args,
          }), '*')
        }
      } catch { /* ignore */ }
    }

    try {
      if (!next) {
        // TURN OFF CAPTIONS
        try { p.setOption?.('captions', 'track', {}) } catch { /* ignore */ }
        try { p.setOption?.('cc', 'track', {}) } catch { /* ignore */ }
        postCmd('setOption', ['captions', 'track', {}])
        postCmd('setOption', ['cc', 'track', {}])
        showHud('captions', 'Captions: OFF')
      } else {
        // TURN ON CAPTIONS
        try { p.loadModule?.('captions') } catch { /* ignore */ }
        try { p.loadModule?.('cc') } catch { /* ignore */ }
        postCmd('loadModule', ['captions'])

        const applyTrack = () => {
          try {
            const tracklist = p.getOption?.('captions', 'tracklist') ||
                              p.getOption?.('cc', 'tracklist') ||
                              availableTracksRef.current
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let trackToSet: any = { languageCode: 'bn' }
            if (Array.isArray(tracklist) && tracklist.length > 0) {
              availableTracksRef.current = tracklist
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const preferred = tracklist.find((t: any) => t.languageCode === 'bn' || t.languageCode === 'en') || tracklist[0]
              trackToSet = preferred
            }

            p.setOption?.('captions', 'track', trackToSet)
            p.setOption?.('cc', 'track', trackToSet)
            p.setOption?.('captions', 'fontSize', -1)
            p.setOption?.('captions', 'textAlign', 'center')
            p.setOption?.('captions', 'alignment', 'center')
            p.setOption?.('captions', 'position', { x: 50, y: 88 })
            p.setOption?.('captions', 'reload', true)

            postCmd('setOption', ['captions', 'track', trackToSet])
            postCmd('setOption', ['captions', 'fontSize', -1])
            postCmd('setOption', ['captions', 'textAlign', 'center'])
            postCmd('setOption', ['captions', 'alignment', 'center'])
            postCmd('setOption', ['captions', 'position', { x: 50, y: 88 }])
            postCmd('setOption', ['captions', 'reload', true])
          } catch (e) {
            console.warn(e)
          }
        }

        applyTrack()
        setTimeout(applyTrack, 80)
        setTimeout(applyTrack, 250)
        setTimeout(applyTrack, 600)
        showHud('captions', 'Captions: ON')
      }
    } catch (err) {
      console.warn('Captions toggle error:', err)
      showHud('captions', next ? 'Captions: ON' : 'Captions: OFF')
    }
  }, [showHud])

  // Video container click & double click handler (Facebook style)
  const handleVideoContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    showControlsTemporarily()

    // If side panel is open, clicking on the video screen closes it!
    if (panelOpen) {
      setPanelOpen(false)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const xPercent = (x / rect.width) * 100
    const now = Date.now()

    if (lastClickRef.current && (now - lastClickRef.current.time) < 300) {
      // Double click detected on left or right third!
      const prevX = lastClickRef.current.xPercent
      lastClickRef.current = null
      if (xPercent < 35 && prevX < 35) {
        seekBy(-seekInterval)
        showHud('seek-back', `-${seekInterval}s`)
        return
      }
      if (xPercent > 65 && prevX > 65) {
        seekBy(seekInterval)
        showHud('seek-forward', `+${seekInterval}s`)
        return
      }
    }

    lastClickRef.current = { time: now, xPercent }
    togglePlay()
  }

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape')
          } catch (e) { /* ignore */ }
        }
      } else {
        await document.exitFullscreen()
        if (screen.orientation && screen.orientation.unlock) {
          try {
            screen.orientation.unlock()
          } catch (e) { /* ignore */ }
        }
      }
    } catch (err) {
      console.warn('Fullscreen error:', err)
    }
  }, [])

  const openPanel = useCallback((tab: SidePanelTab) => {
    if (panelOpen && activeTab === tab) {
      setPanelOpen(false)
    } else {
      setActiveTab(tab)
      setPanelOpen(true)
    }
    setSpeedOpen(false); setQualityOpen(false); setAttachOpen(false); setMoreOpen(false)
  }, [panelOpen, activeTab])

  // ── Unified Keyboard Shortcuts (Rock-solid with Ref) ──────────────
  const handlersRef = useRef({
    togglePlay,
    toggleFullscreen,
    toggleMute,
    toggleCaptions,
    openPanel,
    lecture,
    setSlideModalOpen,
    setNoteFullscreen,
    setPanelOpen,
    setSpeedOpen,
    setQualityOpen,
    setAttachOpen,
    setMoreOpen,
    seekInterval,
    volume,
    isMuted,
  })

  useEffect(() => {
    handlersRef.current = {
      togglePlay,
      toggleFullscreen,
      toggleMute,
      toggleCaptions,
      openPanel,
      lecture,
      setSlideModalOpen,
      setNoteFullscreen,
      setPanelOpen,
      setSpeedOpen,
      setQualityOpen,
      setAttachOpen,
      setMoreOpen,
      seekInterval,
      volume,
      isMuted,
    }
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const h = handlersRef.current

      // Space: tap = play/pause, hold 300ms = 2x speed
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        preHoldSpeedRef.current = speedRef.current
        spaceHoldTimerRef.current = setTimeout(() => {
          isHoldingSpaceRef.current = true
          spaceHoldTimerRef.current = null
          playerRef.current?.setPlaybackRate(2)
          setSpeed(2)
          showHud('speed', '2× Speed')
        }, 300)
        return
      }

      // ↑ Arrow Up = Increase Volume
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const cur = h.isMuted ? 0 : h.volume
        const next = Math.min(100, cur + 5)
        playerRef.current?.unMute()
        playerRef.current?.setVolume(next)
        setVolume(next)
        setIsMuted(false)
        showHud(next > 50 ? 'volume' : 'volume-low', `${next}%`, next)
        return
      }

      // ↓ Arrow Down = Decrease Volume
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const cur = h.isMuted ? 0 : h.volume
        const next = Math.max(0, cur - 5)
        if (next === 0) {
          playerRef.current?.mute()
          setIsMuted(true)
          setVolume(0)
          showHud('mute', 'Muted', 0)
        } else {
          playerRef.current?.unMute()
          playerRef.current?.setVolume(next)
          setVolume(next)
          setIsMuted(false)
          showHud(next > 50 ? 'volume' : 'volume-low', `${next}%`, next)
        }
        return
      }

      // ← Arrow Left = Rewind
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const next = Math.max(0, Math.min(localPositionRef.current - h.seekInterval, localDurationRef.current))
        playerRef.current?.seekTo(next, true)
        setCurrentTime(next)
        localPositionRef.current = next
        showHud('seek-back', `-${h.seekInterval}s`)
        return
      }

      // → Arrow Right = Forward
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const next = Math.max(0, Math.min(localPositionRef.current + h.seekInterval, localDurationRef.current))
        playerRef.current?.seekTo(next, true)
        setCurrentTime(next)
        localPositionRef.current = next
        showHud('seek-forward', `+${h.seekInterval}s`)
        return
      }

      // 'k' or 'K' = Play / Pause
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        h.togglePlay()
        return
      }

      // 'm' or 'M' = Mute / Unmute
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        h.toggleMute()
        return
      }

      // 'f' or 'F' = Fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        h.toggleFullscreen()
        return
      }

      // 'c' or 'C' = Captions / Subtitles
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        h.toggleCaptions()
        return
      }

      // 'n' or 'N' = Notes panel
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        h.openPanel('notes')
        return
      }

      // 'b' or 'B' = Bookmarks panel
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        h.openPanel('bookmarks')
        return
      }

      // 't' or 'T' = Timestamps panel
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        h.openPanel('timestamps')
        return
      }

      // 's' or 'S' = Lecture Slide
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (h.lecture?.slideUrl) {
          setSlideModalOpen(prev => !prev)
        }
        return
      }

      if (e.key === 'Escape') {
        h.setPanelOpen(false)
        h.setSlideModalOpen(false)
        h.setNoteFullscreen(false)
        h.setSpeedOpen(false)
        h.setQualityOpen(false)
        h.setAttachOpen(false)
        h.setMoreOpen(false)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        if (spaceHoldTimerRef.current !== null) {
          clearTimeout(spaceHoldTimerRef.current)
          spaceHoldTimerRef.current = null
          handlersRef.current.togglePlay()
        } else if (isHoldingSpaceRef.current) {
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
  }, [showHud])

  // ── Resume ────────────────────────────────────────────────────────
  const handleResume = () => {
    setShowResumeDialog(false)
    if (savedProgress && playerRef.current) {
      playerRef.current.seekTo(savedProgress.currentPosition, true)
      setCurrentTime(savedProgress.currentPosition)
      localPositionRef.current = savedProgress.currentPosition
      playerRef.current.playVideo()
    }
  }
  const handleStartOver = () => {
    setShowResumeDialog(false)
    playerRef.current?.seekTo(0, true)
    setCurrentTime(0)
    localPositionRef.current = 0
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
      className="flex items-center justify-between gap-1 sm:gap-3 px-2 sm:px-3 pb-1 w-full select-none"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── LEFT SECTION: Sound, Video Time & Bangladesh Clock ── */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0">
        {/* Volume */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={toggleMute}
            className={`${ctrlBtn} text-white/70 hover:text-white`}
            title={effectivelyMuted ? 'Unmute (M)' : 'Mute (M)'}
            aria-label={effectivelyMuted ? 'Unmute' : 'Mute'}
          >
            {effectivelyMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            type="range" min={0} max={100}
            value={effectivelyMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="hidden sm:block h-1 appearance-none cursor-pointer rounded-full"
            style={{
              width: '60px',
              background: `linear-gradient(to right, rgba(255,255,255,0.85) ${effectivelyMuted ? 0 : volume}%, rgba(255,255,255,0.15) ${effectivelyMuted ? 0 : volume}%)`,
            }}
            aria-label="Volume"
          />
        </div>

        {/* Elapsed / Duration Time */}
        <span className="text-xs text-white/60 font-mono shrink-0 tabular-nums">
          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
        </span>

        {/* Live Bangladesh Time (HH:MM AM/PM) */}
        {showClock && bdTime && (
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#111820] border border-[#1E2A36] text-[11px] font-mono text-[#94A3B8] shadow-sm shrink-0"
            title="Current Bangladesh Time"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
            <span className="text-[#F8FAFC] font-semibold tracking-tight tabular-nums">{bdTime}</span>
          </div>
        )}
      </div>

      {/* ── CENTER SECTION: Focused Navigation (Rewind, Play/Pause, Forward) ── */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 shrink-0">
        {/* Rewind */}
        <button
          onClick={() => seekBy(-seekInterval)}
          className="flex flex-col items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title={`Rewind ${seekInterval}s (←)`}
          aria-label={`Rewind ${seekInterval} seconds`}
        >
          <SkipBack size={18} />
          <span className="text-[9px] text-white/50 leading-none mt-0.5">{seekInterval}s</span>
        </button>

        {/* Center Play / Pause (Primary Anchor) */}
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white active:scale-95 shadow-md shadow-[#6366F1]/30 transition-all cursor-pointer"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>

        {/* Forward */}
        <button
          onClick={() => seekBy(seekInterval)}
          className="flex flex-col items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title={`Forward ${seekInterval}s (→)`}
          aria-label={`Forward ${seekInterval} seconds`}
        >
          <SkipForward size={18} />
          <span className="text-[9px] text-white/50 leading-none mt-0.5">{seekInterval}s</span>
        </button>
      </div>

      {/* ── RIGHT SECTION: Controls, Tools & Fullscreen ── */}
      <div className="flex items-center justify-end gap-0.5 sm:gap-1.5 flex-1 min-w-0">
        {/* Captions / Subtitles Button */}
        <button
          onClick={toggleCaptions}
          className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs ${
            isCaptionsOn ? 'text-[#818CF8] bg-[#6366F1]/20 font-bold' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title={isCaptionsOn ? 'Disable Subtitles (C)' : 'Enable Subtitles (C)'}
          aria-label="Subtitles"
        >
          <Subtitles size={17} />
        </button>

        {/* Speed (desktop) */}
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

        {/* Quality (desktop) */}
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

        {/* Notes */}
        <button
          onClick={() => openPanel('notes')}
          className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs ${
            panelOpen && activeTab === 'notes' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="Notes (N)"
          aria-label="Notes (N)"
        >
          <FileText size={16} />
          <span className="hidden xl:block ml-1">Notes</span>
        </button>

        {/* Bookmarks */}
        <button
          onClick={() => openPanel('bookmarks')}
          className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs ${
            panelOpen && activeTab === 'bookmarks' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
          }`}
          title="Bookmarks (B)"
          aria-label="Bookmarks (B)"
        >
          <Bookmark size={16} />
          <span className="hidden xl:block ml-1">Marks</span>
        </button>

        {/* Timestamps */}
        {hasTimestamps && (
          <button
            onClick={() => openPanel('timestamps')}
            className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs ${
              panelOpen && activeTab === 'timestamps' ? 'text-[#818CF8] bg-[#6366F1]/15' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title="Timestamps (T)"
            aria-label="Timestamps / Chapters (T)"
          >
            <List size={16} />
          </button>
        )}

        {/* Dedicated Lecture Slide Button */}
        {lecture.slideUrl && (
          <button
            onClick={() => {
              setContentTab('slide')
              setSlideModalOpen(true)
            }}
            className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs text-[#818CF8] bg-[#6366F1]/10 hover:text-white hover:bg-[#6366F1]/20 font-medium transition-colors`}
            title="Lecture Slide (S)"
            aria-label="Lecture Slide (S)"
          >
            <Presentation size={16} />
            <span className="hidden xl:block ml-1">Slide</span>
          </button>
        )}

        {/* Dedicated Lecture Note Button */}
        {lecture.noteHtml && (
          <button
            onClick={() => {
              setContentTab('note')
              setNoteFullscreen(true)
            }}
            className={`${!isFullscreen ? 'max-sm:hidden' : ''} ${ctrlBtn} px-1.5 rounded-lg text-xs text-[#38BDF8] bg-[#38BDF8]/10 hover:text-white hover:bg-[#38BDF8]/20 font-medium transition-colors`}
            title="Lecture Note (Interactive)"
            aria-label="Lecture Note"
          >
            <BookOpen size={16} />
            <span className="hidden xl:block ml-1">Note</span>
          </button>
        )}

        {/* Attachments */}
        {hasAttachments && (
          <div className={`relative ${!isFullscreen ? 'max-sm:hidden' : ''}`} data-dropdown>
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
                  <button
                    onClick={() => { setAttachOpen(false); setContentTab('slide'); setSlideModalOpen(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[#818CF8] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 font-medium transition-colors mb-0.5 cursor-pointer"
                  >
                    <FileText size={12} className="shrink-0" />
                    <span className="truncate max-w-[180px]">Lecture Slide</span>
                    <span className="ml-auto text-[9px] bg-[#6366F1]/20 text-[#818CF8] px-1.5 py-0.5 rounded font-semibold">VIEW</span>
                  </button>
                )}
                {lecture.noteHtml && (
                  <button
                    onClick={() => { setAttachOpen(false); setContentTab('note'); setNoteFullscreen(true) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-[#38BDF8] bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 font-medium transition-colors mb-0.5 cursor-pointer"
                  >
                    <BookOpen size={12} className="shrink-0" />
                    <span className="truncate max-w-[180px]">Interactive Note</span>
                    <span className="ml-auto text-[9px] bg-[#38BDF8]/20 text-[#38BDF8] px-1.5 py-0.5 rounded font-semibold">NOTE</span>
                  </button>
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

        {/* Mobile More menu (speed + quality) */}
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

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className={`${ctrlBtn} text-white/70 hover:text-white`}
          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
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
        <div className="flex flex-col min-w-0 w-full">

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
                className={`relative bg-black group overflow-hidden select-none ${isFullscreen ? 'flex-1' : ''}`}
                style={isFullscreen ? undefined : { aspectRatio: '16/9' }}
                onMouseMove={showControlsTemporarily}
                onTouchStart={showControlsTemporarily}
                onMouseLeave={() => isPlaying && setShowControls(false)}
              >
                {/* YouTube iframe (exact original 1:1 ratio) */}
                <div
                  ref={playerDivRef}
                  id="yt-player"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Video backdrop target with single-click play/pause & double-click seek (Facebook style) */}
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={handleVideoContainerClick}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  role="button"
                />

                {/* ── Center Controls Overlay (Transparent Play/Pause Icon) ── */}
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 z-20 ${
                    (!isPlaying || showControls) ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                >
                  {/* Transparent Center Play / Pause Icon (No Background) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePlay()
                    }}
                    className="pointer-events-auto text-white/90 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)] filter p-3 rounded-full"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause size={56} fill="currentColor" />
                    ) : (
                      <Play size={60} fill="currentColor" className="ml-1" />
                    )}
                  </button>
                </div>

                {/* ── Top-Center HUD Toast (Volume / Seek / Quality / Speed) ── */}
                {hud && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2.5 shadow-2xl z-40 pointer-events-none animate-fade-in text-xs sm:text-sm font-semibold">
                    {hud.icon === 'volume' && <Volume2 size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'volume-low' && <Volume1 size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'mute' && <VolumeX size={16} className="text-[#EF4444]" />}
                    {hud.icon === 'seek-back' && <SkipBack size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'seek-forward' && <SkipForward size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'quality' && <Settings2 size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'speed' && <Gauge size={16} className="text-[#818CF8]" />}
                    {hud.icon === 'captions' && <Subtitles size={16} className="text-[#818CF8]" />}
                    <span>{hud.text}</span>
                    {typeof hud.value === 'number' && (
                      <div className="w-14 sm:w-20 h-1.5 bg-white/20 rounded-full overflow-hidden ml-1">
                        <div
                          className="h-full bg-[#6366F1] rounded-full transition-all duration-150"
                          style={{ width: `${hud.value}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

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

                {/* ── Persistent Floating Live Clock in Fullscreen ── */}
                {isFullscreen && showClock && bdTime && (
                  <div className="absolute top-3.5 right-4 z-35 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono text-white/90 border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
                    <span className="font-semibold tracking-tight tabular-nums">{bdTime}</span>
                  </div>
                )}

                {/* ── Slidable Drawer Tab Button (< / >) on Right Edge ── */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!panelOpen) {
                      if (hasTimestamps) setActiveTab('timestamps')
                      else setActiveTab('notes')
                      setPanelOpen(true)
                    } else {
                      setPanelOpen(false)
                    }
                  }}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-[#111820]/90 hover:bg-[#6366F1] text-[#818CF8] hover:text-white border border-r-0 border-white/20 hover:border-[#6366F1] py-3.5 px-2 rounded-l-xl shadow-2xl backdrop-blur-md transition-all duration-300 cursor-pointer flex flex-col items-center gap-1.5 group select-none ${
                    (!isPlaying || showControls || panelOpen)
                      ? 'opacity-100 translate-x-0 pointer-events-auto'
                      : 'opacity-0 translate-x-3 pointer-events-none'
                  }`}
                  title={panelOpen ? 'Close side panel (or click video)' : 'Open Timestamps & Notes (<)'}
                  aria-label={panelOpen ? 'Close panel' : 'Open panel'}
                >
                  <ChevronLeft
                    size={18}
                    className={`transition-transform duration-300 ${
                      panelOpen ? 'rotate-180 text-white' : 'text-[#818CF8] group-hover:text-white group-hover:-translate-x-0.5'
                    }`}
                  />
                  <div className="flex flex-col items-center gap-1 mt-0.5">
                    {activeTab === 'timestamps' && <Clock size={12} className="text-[#818CF8] group-hover:text-white" />}
                    {activeTab === 'notes' && <FileText size={12} className="text-[#818CF8] group-hover:text-white" />}
                    {activeTab === 'bookmarks' && <Bookmark size={12} className="text-[#818CF8] group-hover:text-white" />}
                  </div>
                </button>

                {/* ── Fullscreen: controls overlay (auto-hide) ── */}
                {isFullscreen && (
                  <div
                    className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 z-30 ${
                      showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Gradient bg */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
                    <div className="relative pt-10 space-y-0">
                      {/* Time & Remaining Time display in fullscreen above progress bar */}
                      <div className="px-4 mb-0.5 flex items-center justify-between select-none">
                        <span className="text-xs text-white/70 font-mono tabular-nums font-medium">
                          {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
                        </span>
                        <span className="text-xs text-white/70 font-mono tabular-nums font-medium">
                          -{formatDuration(Math.max(0, Math.floor(duration - currentTime)))}
                        </span>
                      </div>
                      {progressBar}
                      <div className="pb-3">{controlsBar}</div>
                    </div>
                  </div>
                )}

                {/* ── Side panel (overlay inside video container for BOTH normal & fullscreen mode) ── */}
                <aside
                  className={`absolute top-0 right-0 bottom-0 w-72 sm:w-80 max-w-full bg-[#0B0F14]/96 backdrop-blur-md border-l border-[#1E2A36] flex flex-col overflow-hidden z-35 transition-transform duration-300 ease-in-out shadow-2xl ${
                    panelOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {panelContent}
                </aside>

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

              {/* ── Embedded Lecture Content Panel (Slide / Note tabs, below video in normal mode) ── */}
              {!isFullscreen && (lecture.slideUrl || lecture.noteHtml) && (
                <div className="border-t border-[#1E2A36] bg-[#0B0F14] w-full">
                  {/* Header & Tab Selector Bar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E2A36] flex-wrap gap-2">
                    {/* Tabs */}
                    <div className="flex items-center bg-[#111820] border border-[#1E2A36] rounded-xl p-1 gap-1">
                      {lecture.slideUrl && (
                        <button
                          type="button"
                          onClick={() => setContentTab('slide')}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                            contentTab === 'slide'
                              ? 'bg-[#6366F1] text-white shadow-sm shadow-[#6366F1]/30'
                              : 'text-[#64748B] hover:text-[#94A3B8]'
                          }`}
                        >
                          <FileText size={13} />
                          <span>Slide</span>
                        </button>
                      )}
                      {lecture.noteHtml && (
                        <button
                          type="button"
                          onClick={() => setContentTab('note')}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                            contentTab === 'note'
                              ? 'bg-[#38BDF8] text-[#0B0F14] font-semibold shadow-sm shadow-[#38BDF8]/30'
                              : 'text-[#64748B] hover:text-[#94A3B8]'
                          }`}
                        >
                          <BookOpen size={13} />
                          <span>Interactive Note</span>
                        </button>
                      )}
                      {/* Split view: only when both slide and note exist */}
                      {lecture.slideUrl && lecture.noteHtml && (
                        <button
                          type="button"
                          onClick={() => setContentTab('split')}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                            contentTab === 'split'
                              ? 'bg-[#34D399] text-[#0B0F14] font-semibold shadow-sm shadow-[#34D399]/30'
                              : 'text-[#64748B] hover:text-[#94A3B8]'
                          }`}
                          title="Split view: Slide + Note side by side"
                        >
                          <Minimize2 size={13} />
                          <span className="hidden sm:inline">Split Notes</span>
                          <span className="sm:hidden">Split</span>
                        </button>
                      )}
                    </div>

                    {/* View Controls */}
                    <div className="flex items-center gap-1.5">
                      {contentTab === 'slide' && lecture.slideUrl && (
                        <button
                          onClick={() => setSlideModalOpen(true)}
                          className="flex items-center gap-1 text-xs text-[#818CF8] hover:text-white px-2.5 py-1.5 rounded-lg bg-[#6366F1]/10 hover:bg-[#6366F1]/20 transition-colors font-medium cursor-pointer"
                          title="Open Slide Fullscreen"
                        >
                          <Maximize size={12} />
                          <span>Full Screen</span>
                        </button>
                      )}

                      {(contentTab === 'note' || contentTab === 'split') && lecture.noteHtml && (
                        <>
                          {/* Half Page Toggle — only in single-note tab */}
                          {contentTab === 'note' && (
                            <button
                              onClick={() => setNoteHalfPage(prev => !prev)}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium cursor-pointer ${
                                noteHalfPage
                                  ? 'bg-[#38BDF8]/20 border-[#38BDF8]/40 text-[#38BDF8]'
                                  : 'bg-[#17202A] border-[#1E2A36] text-[#94A3B8] hover:text-[#F8FAFC]'
                              }`}
                              title={noteHalfPage ? 'Switch to Full Height' : 'Switch to Compact Half Page View'}
                            >
                              {noteHalfPage ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                              <span className="hidden sm:inline">{noteHalfPage ? 'Full Height' : 'Half Page'}</span>
                            </button>
                          )}

                          {/* Full Width Toggle */}
                          {contentTab === 'note' && (
                            <button
                              onClick={() => setNoteFullWidth(prev => !prev)}
                              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium cursor-pointer ${
                                noteFullWidth
                                  ? 'bg-[#34D399]/20 border-[#34D399]/40 text-[#34D399]'
                                  : 'bg-[#17202A] border-[#1E2A36] text-[#94A3B8] hover:text-[#F8FAFC]'
                              }`}
                              title={noteFullWidth ? 'Switch to Reading Width' : 'Expand to Full Page Width'}
                            >
                              {noteFullWidth ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                              <span className="hidden sm:inline">{noteFullWidth ? 'Fit Column' : 'Full Width'}</span>
                            </button>
                          )}

                          {/* Full Page Overlay */}
                          <button
                            onClick={() => setNoteFullscreen(true)}
                            className="flex items-center gap-1 text-xs text-[#38BDF8] hover:text-white px-2.5 py-1.5 rounded-lg bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 transition-colors font-semibold cursor-pointer"
                            title="Open Note in Full Overlay Mode (Video keeps playing)"
                          >
                            <Maximize size={12} />
                            <span>Full Page</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tab 1: Slide only */}
                  {contentTab === 'slide' && lecture.slideUrl && (
                    <div
                      className="w-full overflow-hidden relative bg-[#0B0F14] border-t border-[#1E2A36] h-[75vh]"
                    >
                      <iframe
                        src={toSlideEmbedUrl(lecture.slideUrl)}
                        allow="autoplay"
                        loading="lazy"
                        title="Lecture Slide"
                        className="absolute inset-0 w-full h-full border-none bg-[#0B0F14] block"
                      />
                    </div>
                  )}

                  {/* Tab 2: Interactive Note only */}
                  {contentTab === 'note' && lecture.noteHtml && (
                    <div
                      className={`w-full overflow-y-auto bg-[#080C12] transition-all duration-200 border-t border-[#1E2A36] ${
                        noteHalfPage ? 'max-h-[50vh]' : 'max-h-[85vh]'
                      }`}
                    >
                      <div className={`mx-auto px-4 sm:px-8 py-6 selection:bg-[#6366F1]/30 ${
                        noteFullWidth ? 'max-w-none' : 'max-w-4xl'
                      }`}>
                        <StableHtmlNote
                          className="academic-note"
                          html={sanitizeWatchNote(
                            lecture.noteHtml.trim().startsWith('<div class="academic-note"')
                              ? lecture.noteHtml
                              : `<div class="academic-note">${lecture.noteHtml}</div>`
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Split — Slide + Note side by side on desktop, stacked on mobile */}
                  {contentTab === 'split' && lecture.slideUrl && lecture.noteHtml && (
                    <div className="flex flex-col md:flex-row border-t border-[#1E2A36] w-full h-[85vh] md:h-[80vh]">
                      {/* Left/Top: Slide */}
                      <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-hidden border-b md:border-b-0 md:border-r border-[#1E2A36] bg-[#0B0F14] relative flex-shrink-0">
                        <iframe
                          src={toSlideEmbedUrl(lecture.slideUrl)}
                          allow="autoplay"
                          loading="lazy"
                          title="Lecture Slide"
                          className="w-full h-full border-none bg-[#0B0F14] block"
                        />
                      </div>
                      {/* Right/Bottom: Note — scrolls independently */}
                      <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto bg-[#080C12] overscroll-contain">
                        <div className="px-4 sm:px-6 py-5 selection:bg-[#6366F1]/30">
                          <StableHtmlNote
                            className="academic-note"
                            html={sanitizeWatchNote(
                              lecture.noteHtml.trim().startsWith('<div class="academic-note"')
                                ? lecture.noteHtml
                                : `<div class="academic-note">${lecture.noteHtml}</div>`
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Resume dialog ── */}
      <Modal isOpen={showResumeDialog} onClose={handleResume} title="Resume where you left off?" size="sm">
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

      {/* ── Lecture Slide Modal (full-screen in-app viewer) ── */}
      {slideModalOpen && lecture?.slideUrl && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Lecture Slide Viewer"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0B0F14] border-b border-[#1E2A36] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} className="text-[#818CF8] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F8FAFC] truncate">Lecture Slide</p>
                <p className="text-[10px] text-[#64748B] truncate">{lecture.title}</p>
              </div>
            </div>
            <button
              onClick={() => setSlideModalOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820] transition-colors cursor-pointer shrink-0"
              aria-label="Close slide viewer"
            >
              <X size={18} />
            </button>
          </div>

          {/* iframe fills remaining space cleanly, bottom bar intact */}
          <div className="flex-1 w-full relative overflow-hidden bg-[#0B0F14]" style={{ minHeight: 0 }}>
            <iframe
              src={toSlideEmbedUrl(lecture.slideUrl)}
              allow="autoplay"
              title="Lecture Slide"
              className="w-full h-full border-none bg-[#0B0F14] block"
            />
          </div>
        </div>
      )}

      {/* ── Lecture Interactive Note Fullscreen Modal (Video keeps playing!) ── */}
      {noteFullscreen && lecture?.noteHtml && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Lecture Note Viewer"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0B0F14] border-b border-[#1E2A36] shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen size={16} className="text-[#38BDF8] shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#F8FAFC] truncate">{lecture.title}</p>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] shrink-0">
                    Interactive Note
                  </span>
                </div>
                <p className="text-[10px] text-[#64748B] truncate">{lecture.subjectName} / {lecture.chapterName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Zoom controls */}
              <div className="flex items-center bg-[#17202A] border border-[#1E2A36] rounded-lg p-0.5">
                <button
                  onClick={() => setNoteZoom(z => Math.max(75, z - 15))}
                  disabled={noteZoom <= 75}
                  className="px-2 py-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-30 transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <button
                  onClick={() => setNoteZoom(100)}
                  className="px-2 py-1 text-[11px] font-mono text-[#38BDF8] transition-colors cursor-pointer"
                  title="Reset Zoom"
                >
                  {noteZoom}%
                </button>
                <button
                  onClick={() => setNoteZoom(z => Math.min(200, z + 15))}
                  disabled={noteZoom >= 200}
                  className="px-2 py-1 text-xs text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-30 transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              {/* Full Width Toggle */}
              <button
                onClick={() => setNoteModalFullWidth(prev => !prev)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  noteModalFullWidth
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8]/40 text-[#38BDF8]'
                    : 'border-[#1E2A36] text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820]'
                }`}
                title={noteModalFullWidth ? 'Switch to Reading Width' : 'Expand to Full Page Width'}
              >
                {noteModalFullWidth ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="hidden sm:inline">{noteModalFullWidth ? 'Fit Column' : 'Full Width'}</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setNoteFullscreen(false)}
                className="flex items-center gap-1 text-xs text-[#64748B] hover:text-[#F8FAFC] px-2.5 py-1.5 rounded-lg hover:bg-[#111820] transition-colors cursor-pointer"
                title="Close Full Page Note (Esc)"
              >
                <X size={16} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Note Scroll Content */}
          <div className="flex-1 w-full overflow-y-auto bg-[#080C12]" style={{ minHeight: 0 }}>
            <div
              className={`mx-auto px-4 sm:px-8 md:px-12 py-8 selection:bg-[#6366F1]/30 transition-all duration-200 ${
                noteModalFullWidth ? 'max-w-none' : 'max-w-4xl'
              }`}
              style={{
                zoom: `${noteZoom}%`,
                fontSize: `${Math.round(15 * (noteZoom / 100))}px`,
              }}
            >
              <StableHtmlNote
                className="academic-note"
                html={sanitizeWatchNote(
                  lecture.noteHtml.trim().startsWith('<div class="academic-note"')
                    ? lecture.noteHtml
                    : `<div class="academic-note">${lecture.noteHtml}</div>`
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
