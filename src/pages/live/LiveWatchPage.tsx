/**
 * LiveWatchPage.tsx — /live/:scheduleId
 *
 * Fullscreen Scheduled Live Player — no AppLayout chrome.
 *
 * State machine:
 *   isLoading → Loading spinner
 *   error / !schedule → Error screen
 *   status === 'ended' → Class-ended screen with review link
 *   status === 'upcoming' → Waiting Room (countdown)
 *   status === 'live' → Full Live Player (YouTube IFrame, restricted controls)
 *
 * PRD references:
 *   §7  — Schedule Status & Access Control
 *   §10 — Waiting Room
 *   §11 — Live Player UI & Controls
 *   §12 — Time Synchronisation
 *   §13 — Attendance Tracking
 *
 * Key behaviours (PRD §11):
 *   - Speed locked at 1x — enforced on every state change
 *   - Seek bar hidden via pointer-events-none overlay
 *   - Keyboard shortcuts (arrow seek, Space 2×speed) disabled
 *   - LIVE button → seekTo(expectedPosition) → FOLLOWING_LIVE mode
 *   - Pause keeps video paused; timeline continues; shows DELAYED badge
 *   - Class end detected when status transitions to 'ended' (time-based, no cron)
 *   - Attendance tracked every 30s via ATTENDANCE_SAVE_INTERVAL_MS
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Clock, Radio, AlertTriangle, Play, Pause,
  CheckCircle2, CalendarDays, Volume1, Volume2, VolumeX,
  Maximize, Minimize, Loader2, Wifi, Coffee, Sparkles, Lock, Zap,
  Hourglass,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSchedule } from '@/hooks/useSchedule'
import { useLiveSync } from '@/hooks/useLiveSync'
import LiveStatusBadge from '@/components/live/LiveStatusBadge'
import { initAttendanceRecord, updateAttendance, finaliseAttendance } from '@/services/attendance.service'
import { upsertActiveSession } from '@/services/sessions.service'
import { clearLectureLockAfterClass } from '@/services/schedule.service'
import { buildRoute, ROUTES } from '@/constants/routes'
import { getThumbnailUrl } from '@/utils/youtube.utils'
import {
  formatScheduleDate,
  formatScheduleDateWithWeekday,
  formatScheduleTime,
  formatScheduleTimeRange,
  formatCountdown,
  calculateExpectedLivePosition,
  formatSecondsToTimestampString,
  formatLiveDuration,
} from '@/utils/schedule.utils'
import { formatDuration, formatDurationHuman } from '@/utils/time.utils'
import { ATTENDANCE_SAVE_INTERVAL_MS } from '@/constants/firebase'
import type { Timestamp } from 'firebase/firestore'

// ── YT Player State constants ─────────────────────────────────────────
const YT_UNSTARTED = -1
const YT_ENDED = 0
const YT_PLAYING = 1
const YT_PAUSED = 2
const YT_BUFFERING = 3

// ── ctrlBtn style reuse ───────────────────────────────────────────────
const ctrlBtn = 'flex items-center justify-center transition-colors cursor-pointer rounded-xl'

// ── Waiting Room Component ────────────────────────────────────────────

interface WaitingRoomProps {
  title: string
  subjectName: string
  chapterName: string
  startAt: import('firebase/firestore').Timestamp
  endAt: import('firebase/firestore').Timestamp
  youtubeVideoId: string
  thumbnailUrl?: string
  countdownMs: number
  durationSeconds?: number
  durationFormatted?: string
  breakInfo?: import('@/types/schedule.types').BreakInfo
  isCustomRange?: boolean
  rangeStartSeconds?: number
  rangeEndSeconds?: number
  playbackSpeed?: number
}

function WaitingRoom({
  title, subjectName, chapterName, startAt, endAt,
  youtubeVideoId, thumbnailUrl, countdownMs, breakInfo,
  isCustomRange, rangeStartSeconds, rangeEndSeconds, playbackSpeed,
  durationSeconds, durationFormatted,
}: WaitingRoomProps) {
  const totalSeconds = Math.max(0, Math.floor(countdownMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const effectiveDuration = durationSeconds
    ? (playbackSpeed && playbackSpeed !== 1
        ? Math.round(durationSeconds / playbackSpeed)
        : durationSeconds)
    : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-6">
      {/* Thumbnail with countdown overlay */}
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        <img
          src={thumbnailUrl || getThumbnailUrl(youtubeVideoId, 'high')}
          alt={title}
          className="w-full object-cover aspect-video"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/75 backdrop-blur-xs px-5 py-2.5 rounded-2xl border border-white/10 text-center shadow-lg">
            <p className="text-[#F59E0B] font-bold text-xs sm:text-sm flex items-center gap-2 justify-center">
              <Clock size={15} />
              লাইভ ক্লাস শুরু হতে বাকি
            </p>
          </div>
        </div>
      </div>

      {/* ── Countdown timer (d, h, min, sec) ── */}
      <div className="space-y-3 w-full max-w-lg">
        {/* 4 Digital Metric Cards */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3.5 max-w-md mx-auto">
          <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-2.5 sm:p-3 text-center shadow-sm">
            <span className="text-2xl sm:text-4xl font-black font-mono text-[#F8FAFC] tabular-nums block">
              {days}
            </span>
            <span className="text-[10px] sm:text-xs text-[#818CF8] font-bold uppercase tracking-wider block mt-0.5">
              {days}d (দিন)
            </span>
          </div>

          <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-2.5 sm:p-3 text-center shadow-sm">
            <span className="text-2xl sm:text-4xl font-black font-mono text-[#F8FAFC] tabular-nums block">
              {String(hours).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs text-[#818CF8] font-bold uppercase tracking-wider block mt-0.5">
              {hours}h (ঘণ্টা)
            </span>
          </div>

          <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-2.5 sm:p-3 text-center shadow-sm">
            <span className="text-2xl sm:text-4xl font-black font-mono text-[#F8FAFC] tabular-nums block">
              {String(minutes).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs text-[#818CF8] font-bold uppercase tracking-wider block mt-0.5">
              {minutes}m (মিনিট)
            </span>
          </div>

          <div className="bg-[#0C1A0F] border border-[#22C55E]/40 rounded-2xl p-2.5 sm:p-3 text-center shadow-sm">
            <span className="text-2xl sm:text-4xl font-black font-mono text-[#4ADE80] tabular-nums block">
              {String(seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] sm:text-xs text-[#4ADE80] font-bold uppercase tracking-wider block mt-0.5">
              {seconds}s (সেকেন্ড)
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#94A3B8] font-medium pt-0.5">
          {formatScheduleDateWithWeekday(startAt, true)} — {formatScheduleTime(startAt)}
        </p>
      </div>

      {/* ── Class Info Card (All details including Duration) ── */}
      <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-4 sm:p-5 text-left w-full max-w-lg space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#1E2A36] pb-2.5">
          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={13} className="text-[#818CF8]" />
            ক্লাসের বিস্তারিত তথ্য
          </p>
          <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20 font-bold">
            আসন্ন শিডিউল
          </span>
        </div>

        <div>
          <p className="text-sm sm:text-base font-bold text-[#F8FAFC] leading-snug">{title}</p>
          <p className="text-xs text-[#94A3B8] mt-1">
            <span className="text-[#CBD5E1] font-medium">{subjectName}</span>
            {chapterName && <span className="text-[#64748B]"> · {chapterName}</span>}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Day & Date */}
          <div className="flex items-center gap-2.5 bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-2.5 text-xs">
            <CalendarDays size={15} className="text-[#818CF8] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block uppercase tracking-wide">তারিখ ও বার</span>
              <span className="font-medium text-[#F8FAFC] truncate block">{formatScheduleDateWithWeekday(startAt, true)}</span>
            </div>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-2.5 bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-2.5 text-xs">
            <Clock size={15} className="text-[#818CF8] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block uppercase tracking-wide">সময়সূচি</span>
              <span className="font-mono text-[#F8FAFC] truncate block">{formatScheduleTimeRange(startAt, endAt)}</span>
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2.5 bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-2.5 text-xs">
            <Hourglass size={15} className="text-[#F59E0B] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block uppercase tracking-wide">মোট ক্লাসের ব্যাপ্তি (Duration)</span>
              <span className="font-mono font-bold text-[#F8FAFC] truncate block">
                {effectiveDuration > 0 ? formatDurationHuman(effectiveDuration) : (durationFormatted || 'নির্ধারিত')}
                {effectiveDuration > 0 && (
                  <span className="text-[#64748B] font-normal ml-1">({formatLiveDuration(effectiveDuration)})</span>
                )}
              </span>
            </div>
          </div>

          {/* Playback speed */}
          <div className="flex items-center gap-2.5 bg-[#0B0F14] border border-[#1E2A36] rounded-xl p-2.5 text-xs">
            <Zap size={15} className="text-[#22C55E] shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-[#64748B] block uppercase tracking-wide">লাইভ স্পিড</span>
              <span className="font-mono font-bold text-[#F8FAFC] truncate block">
                {playbackSpeed && playbackSpeed !== 1 ? `${playbackSpeed}x স্পিড লক` : '1.0x (স্বাভাবিক)'}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Range */}
        {isCustomRange && (
          <div className="flex items-center gap-2 bg-[#6366F1]/10 border border-[#6366F1]/25 rounded-xl px-3 py-2 text-xs text-[#818CF8]">
            <span>
              কাস্টম সেগমেন্ট:{' '}
              <span className="font-mono font-semibold">
                {formatSecondsToTimestampString(rangeStartSeconds ?? 0)}
              </span>
              {' '}হতে{' '}
              <span className="font-mono font-semibold">
                {formatSecondsToTimestampString(rangeEndSeconds ?? 0)}
              </span>
            </span>
          </div>
        )}

        {/* Break info callout for long classes */}
        {breakInfo?.hasBreaks && (
          <div className="flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded-xl px-3 py-2.5 text-xs text-[#FBBF24]">
            <Coffee size={14} className="shrink-0 text-[#F59E0B]" />
            <span>প্রতি ১ ঘণ্টা পর ১০ মিনিটের বিরতি কার্যকর হবে ({breakInfo.totalBreaks}টি বিরতি)</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Class Ended Screen ────────────────────────────────────────────────

interface ClassEndedScreenProps {
  title: string
  lectureId: string
  scheduleId: string
  isCustomRange?: boolean
}

function ClassEndedScreen({ title, lectureId, isCustomRange }: ClassEndedScreenProps) {
  return (
    <div className="min-h-screen bg-[#080C10] flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <CheckCircle2 size={52} className="text-[#22C55E] mx-auto" />
        <div>
          <p className="text-xl font-bold text-[#F8FAFC]">ক্লাস শেষ হয়েছে</p>
          <p className="text-sm text-[#64748B] mt-1">{title}</p>
        </div>
        <p className="text-xs text-[#475569] bg-[#0C1A0F] border border-[#22C55E]/20 rounded-xl p-3 leading-relaxed">
          {isCustomRange
            ? '🎉 মূল লেকচারের সম্পূর্ণ অংশ (সব টাইমস্ট্যাম্প, স্লাইড ও নোটস সহ) এখন Unlock হয়েছে।'
            : '🎉 Recorded Mode এখন Unlock হয়েছে। নিচের বোতাম থেকে পুনরায় দেখুন।'}
        </p>
        <div className="flex gap-2 justify-center">
          <Link to={ROUTES.SCHEDULE}>
            <button className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#F8FAFC] border border-[#1E2A36] hover:border-[#2A3B4D] px-4 py-2 rounded-xl transition-colors cursor-pointer">
              <ChevronLeft size={14} />
              Schedule
            </button>
          </Link>
          <Link to={buildRoute(ROUTES.WATCH, { lectureId })}>
            <button className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer">
              <Play size={14} />
              Review করুন
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function LiveWatchPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>()
  const { user, userDoc } = useAuth()
  const navigate = useNavigate()
  const showClock: boolean = userDoc?.showClock ?? true

  // ── Bangladesh Live Clock (HH:MM AM/PM) — Matches WatchPage.tsx ──
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

  // ── Schedule data & live state (Phase 3 hooks) ───────────────────
  const { schedule, status, reliableNowMs, livePositionSeconds, breakInfo, isLoading, error } = useSchedule(
    user?.uid,
    scheduleId
  )

  // ── Player DOM & ref ─────────────────────────────────────────────
  const playerDivRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Player UI state ──────────────────────────────────────────────
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [needsInteraction, setNeedsInteraction] = useState(false) // autoplay policy

  // ── Live sync (Phase 3 hook) ─────────────────────────────────────
  const { syncMode, behindLiveSeconds, goLive, onUserPause, onUserPlay } = useLiveSync({
    schedule,
    playerRef,
    reliableNowMs,
    isPlayerReady,
    isBreakActive: breakInfo.isBreakActive,
  })

  // ── Attendance tracking state ────────────────────────────────────
  const sessionInstanceId = useRef(crypto.randomUUID())
  const attendanceInitRef = useRef(false)
  const attendanceSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attendanceFinalised = useRef(false)

  // Accumulated counters (updated in mutable refs to avoid stale closures)
  const activePlaybackSecsRef = useRef(0)
  const pauseSecsRef = useRef(0)
  const bufferingSecsRef = useRef(0)
  const liveFollowingSecsRef = useRef(0)
  const delayedViewingSecsRef = useRef(0)
  const lastTickRef = useRef<number>(0)
  const joinedAtRef = useRef<Timestamp | null>(null)
  const statusRef = useRef(status)
  const syncModeRef = useRef(syncMode)

  // Track played time in refs
  const isPlayingRef = useRef(false)
  const isBufferingRef = useRef(false)
  const scheduleRef = useRef(schedule)

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { syncModeRef.current = syncMode }, [syncMode])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { isBufferingRef.current = isBuffering }, [isBuffering])
  useEffect(() => { scheduleRef.current = schedule }, [schedule])

  // ── Controls auto-hide ───────────────────────────────────────────
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    if (isPlayingRef.current) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 2500)
    }
  }, [])

  // ── Fullscreen ───────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // ── Auto-pause on break start and auto-resume on break end ───────
  const wasBreakActiveRef = useRef(false)
  useEffect(() => {
    if (breakInfo.isBreakActive) {
      try {
        playerRef.current?.pauseVideo?.()
      } catch { /* ignore */ }
    } else if (wasBreakActiveRef.current && status === 'live') {
      // Break just finished! Resume live playback automatically
      try {
        playerRef.current?.seekTo?.(breakInfo.expectedVideoPosition, true)
        playerRef.current?.playVideo?.()
      } catch { /* ignore */ }
    }
    wasBreakActiveRef.current = breakInfo.isBreakActive
  }, [breakInfo.isBreakActive, breakInfo.expectedVideoPosition, status])

  // ── Init YT Player when status becomes 'live' ────────────────────
  useEffect(() => {
    if (!schedule || status !== 'live' || !playerDivRef.current) return
    if (playerRef.current) return // already initialised

    const forceDisableCaptions = (targetPlayer?: unknown) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pl = (targetPlayer || playerRef.current) as any
        if (!pl) return
        pl.setOption?.('captions', 'track', {})
        pl.setOption?.('cc', 'track', {})
        pl.unloadModule?.('captions')
        pl.unloadModule?.('cc')

        const iframe = pl.getIframe?.()
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setOption',
            args: ['captions', 'track', {}],
          }), '*')
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setOption',
            args: ['cc', 'track', {}],
          }), '*')
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'unloadModule',
            args: ['captions'],
          }), '*')
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'unloadModule',
            args: ['cc'],
          }), '*')
        }
      } catch {
        /* ignore */
      }
    }

    const initPlayer = () => {
      if (!playerDivRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playerRef.current = new (window as any).YT.Player(playerDivRef.current, {
        videoId: schedule.youtubeVideoId,
        playerVars: {
          rel: 0,
          controls: 0,         // hide default controls entirely
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1,
          iv_load_policy: 3,   // hide annotations
          fs: 0,               // disable fullscreen button
          disablekb: 1,        // disable keyboard in iframe
          cc_load_policy: 0,
          autohide: 1,
        } as unknown,
        events: {
          onReady: (e: YT.PlayerEvent) => {
            setIsPlayerReady(true)

            // Force captions off on load
            forceDisableCaptions(e.target)
            setTimeout(() => forceDisableCaptions(e.target), 150)
            setTimeout(() => forceDisableCaptions(e.target), 500)

            // 1. Set volume to saved level
            try {
              e.target.setVolume?.(volume)
              if (isMuted) e.target.mute?.()
            } catch { /* ignore */ }

            // 2. Lock speed at scheduled speed (default 1x)
            const targetSpeed = schedule.playbackSpeed && schedule.playbackSpeed > 0 ? schedule.playbackSpeed : 1
            try { e.target.setPlaybackRate?.(targetSpeed) } catch { /* ignore */ }

            // 3. Seek to expected live position and play
            const expectedPos = calculateExpectedLivePosition(schedule, Date.now())
            const rangeEnd = schedule.rangeEndSeconds ?? ((schedule.rangeStartSeconds ?? 0) + schedule.durationSeconds)
            if (expectedPos >= rangeEnd) {
              try {
                e.target.seekTo?.(rangeEnd, true)
                e.target.pauseVideo?.()
              } catch { /* ignore */ }
            } else {
              try {
                e.target.seekTo?.(expectedPos, true)
                e.target.playVideo?.()
              } catch {
                // Autoplay blocked — show interaction prompt
                setNeedsInteraction(true)
              }
            }
          },

          onApiChange: (e: unknown) => {
            // Disable captions if YouTube loads subtitle modules
            forceDisableCaptions(e)
          },

          onStateChange: (event: YT.OnStateChangeEvent) => {
            const s = event.data

            if (s === YT_PLAYING) {
              const rangeEnd = schedule.rangeEndSeconds ?? ((schedule.rangeStartSeconds ?? 0) + schedule.durationSeconds)
              try {
                const cur = playerRef.current?.getCurrentTime?.() ?? 0
                if (cur >= rangeEnd) {
                  playerRef.current?.pauseVideo?.()
                  setIsPlaying(false)
                  return
                }
              } catch { /* ignore */ }

              setIsPlaying(true)
              setIsBuffering(false)
              setNeedsInteraction(false)
              showControlsTemporarily()

              // Lock speed and force captions off every time playback starts
              const targetSpeed = schedule.playbackSpeed && schedule.playbackSpeed > 0 ? schedule.playbackSpeed : 1
              try { playerRef.current?.setPlaybackRate?.(targetSpeed) } catch { /* ignore */ }
              forceDisableCaptions()

              // Track timing for attendance
              lastTickRef.current = Date.now()
              onUserPlay()
            }

            if (s === YT_PAUSED) {
              setIsPlaying(false)
              setShowControls(true)
              flushAttendanceTick()
              onUserPause()
            }

            if (s === YT_BUFFERING) {
              setIsBuffering(true)
            }

            if (s === YT_ENDED || s === YT_UNSTARTED) {
              setIsPlaying(false)
              setIsBuffering(false)
              setShowControls(true)
            }
          },

          onPlaybackRateChange: () => {
            // Force scheduled speed back if user somehow changed it (PRD §11.2)
            const targetSpeed = schedule.playbackSpeed && schedule.playbackSpeed > 0 ? schedule.playbackSpeed : 1
            try { playerRef.current?.setPlaybackRate?.(targetSpeed) } catch { /* ignore */ }
          },

          onError: () => {
            setPlayerError('ভিডিও চালাতে সমস্যা হয়েছে। পেজ refresh করুন।')
          },
        } as unknown,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).YT?.Player) {
      initPlayer()
    } else {
      type ExtWindow = typeof window & { onYouTubeIframeAPIReady?: () => void }
      const win = window as ExtWindow
      const prev = win.onYouTubeIframeAPIReady
      win.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
    }

    return () => {
      try { playerRef.current?.destroy() } catch { /* ignore */ }
      playerRef.current = null
      setIsPlayerReady(false)
    }
  }, [schedule, status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attendance: initialise when player becomes ready ────────────
  useEffect(() => {
    if (!user || !scheduleId || !schedule || !isPlayerReady) return
    if (attendanceInitRef.current) return
    attendanceInitRef.current = true

    const sessionId = sessionInstanceId.current

    initAttendanceRecord(
      user.uid,
      scheduleId,
      sessionId,
      {
        lectureId: schedule.lectureId,
        durationSeconds: schedule.durationSeconds,
        startAt: schedule.startAt,
      },
      reliableNowMs
    ).then(() => {
      joinedAtRef.current = schedule.startAt // store for finalise
    }).catch((err) => {
      console.warn('[LiveWatchPage] Attendance init failed:', err)
    })

    // Periodic attendance save every 30s
    attendanceSaveRef.current = setInterval(() => {
      flushAttendanceTick()
      saveAttendance()
    }, ATTENDANCE_SAVE_INTERVAL_MS)

    return () => {
      if (attendanceSaveRef.current) {
        clearInterval(attendanceSaveRef.current)
        attendanceSaveRef.current = null
      }
    }
  }, [user, scheduleId, schedule, isPlayerReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attendance: finalise helper ──────────────────────────────────
  const finaliseSession = useCallback(() => {
    if (attendanceFinalised.current || !user || !scheduleId) return
    const sched = scheduleRef.current
    if (!sched) return

    attendanceFinalised.current = true

    // Stop periodic save
    if (attendanceSaveRef.current) {
      clearInterval(attendanceSaveRef.current)
      attendanceSaveRef.current = null
    }

    flushAttendanceTick()

    // Final attendance write & studySession creation for Daily Study Time
    finaliseAttendance(user.uid, scheduleId, sessionInstanceId.current, {
      totalActivePlaybackSeconds: Math.round(activePlaybackSecsRef.current),
      totalPauseDurationSeconds: Math.round(pauseSecsRef.current),
      totalBufferingSeconds: Math.round(bufferingSecsRef.current),
      liveFollowingTimeSeconds: Math.round(liveFollowingSecsRef.current),
      delayedViewingTimeSeconds: Math.round(delayedViewingSecsRef.current),
      scheduledDurationSeconds: sched.durationSeconds,
      joinedAt: joinedAtRef.current || sched.startAt,
      subjectId: sched.subjectId,
      chapterId: sched.chapterId,
      subjectName: sched.subjectName,
      lectureId: sched.lectureId,
      scheduleStartAt: sched.startAt,
    }).catch((err) => {
      console.warn('[LiveWatchPage] Attendance finalise failed:', err)
    })

    // Clear lecture lock if class ended
    if (statusRef.current === 'ended') {
      clearLectureLockAfterClass(user.uid, scheduleId, sched.lectureId).catch(() => {})
    }
  }, [user, scheduleId])

  // Finalise when class ends
  useEffect(() => {
    if (status !== 'ended') return
    finaliseSession()
    try { playerRef.current?.destroy() } catch { /* ignore */ }
    playerRef.current = null
  }, [status, finaliseSession])

  // Finalise when student navigates away early or closes browser
  useEffect(() => {
    const handleUnload = () => {
      finaliseSession()
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      finaliseSession()
    }
  }, [finaliseSession])

  // ── Helpers: attendance accumulation ────────────────────────────
  function flushAttendanceTick() {
    if (lastTickRef.current === 0) return
    const now = Date.now()
    const elapsed = (now - lastTickRef.current) / 1000
    lastTickRef.current = now

    if (isPlayingRef.current && !isBufferingRef.current) {
      activePlaybackSecsRef.current += elapsed
      if (syncModeRef.current === 'FOLLOWING_LIVE') {
        liveFollowingSecsRef.current += elapsed
      } else {
        delayedViewingSecsRef.current += elapsed
      }
    } else if (isBufferingRef.current) {
      bufferingSecsRef.current += elapsed
    } else {
      pauseSecsRef.current += elapsed
    }
  }

  function saveAttendance() {
    if (!user || !scheduleId || !schedule) return
    const activePlayback = Math.round(activePlaybackSecsRef.current)
    updateAttendance(user.uid, scheduleId, sessionInstanceId.current, {
      totalActivePlaybackSeconds: activePlayback,
      totalPauseDurationSeconds: Math.round(pauseSecsRef.current),
      totalBufferingSeconds: Math.round(bufferingSecsRef.current),
      liveFollowingTimeSeconds: Math.round(liveFollowingSecsRef.current),
      delayedViewingTimeSeconds: Math.round(delayedViewingSecsRef.current),
      scheduledDurationSeconds: schedule.durationSeconds,
      lastSeenAt: null as unknown as Timestamp, // server will fill
    }).catch(() => {})

    // Progressively sync study time to studySessions every 30s
    // Ensures genuine study time is preserved even on sudden computer power loss / crash
    if (activePlayback > 5) {
      const effectiveJoinedAt = joinedAtRef.current || schedule.startAt
      const startedAt = effectiveJoinedAt ? effectiveJoinedAt.toDate() : new Date(Date.now() - activePlayback * 1000)
      const endedAt = new Date(startedAt.getTime() + activePlayback * 1000)

      upsertActiveSession(user.uid, sessionInstanceId.current, {
        lectureId: schedule.lectureId,
        subjectId: schedule.subjectId,
        chapterId: schedule.chapterId,
        subjectName: schedule.subjectName,
        startedAt,
        endedAt,
        duration: activePlayback,
        isLive: true,
      }).catch((err) => {
        console.warn('[LiveWatchPage] Progressive study session upsert failed:', err)
      })
    }
  }

  // ── Player Controls ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (breakInfo.isBreakActive) return // Mandatory break cannot be unpaused
    const player = playerRef.current
    if (!player) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = player.getPlayerState?.() as number
      if (state === YT_PLAYING) {
        player.pauseVideo?.()
      } else {
        player.playVideo?.()
      }
    } catch { /* ignore */ }
    showControlsTemporarily()
  }, [breakInfo.isBreakActive, showControlsTemporarily])

  const toggleMute = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (isMuted) {
        player.unMute?.()
        player.setVolume?.(volume || 50)
        setIsMuted(false)
      } else {
        player.mute?.()
        setIsMuted(true)
      }
    } catch { /* ignore */ }
  }, [isMuted, volume])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    try {
      playerRef.current?.setVolume?.(v)
      if (v === 0) {
        playerRef.current?.mute?.()
        setIsMuted(true)
      } else {
        playerRef.current?.unMute?.()
        setIsMuted(false)
      }
    } catch { /* ignore */ }
  }, [])

  // ── Keyboard shortcuts — block arrow seek, 2x speed hold (PRD §11.2) ─
  useEffect(() => {
    if (status !== 'live') return
    const handler = (e: KeyboardEvent) => {
      // Block seeking shortcuts
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      // Block 2× speed hold shortcut (Space hold)
      // Space single tap = play/pause (handled separately via button)
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        if (breakInfo.isBreakActive) return // Blocked during mandatory break
        togglePlay()
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleMute()
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [status, breakInfo.isBreakActive, togglePlay, toggleFullscreen, toggleMute])

  // ── Volume icon helper ───────────────────────────────────────────
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  // ── Render guards ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
          <p className="text-sm text-[#64748B]">লোড হচ্ছে…</p>
        </div>
      </div>
    )
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-[#080C10] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle size={36} className="text-[#EF4444] mx-auto" />
          <p className="text-[#F8FAFC] font-semibold">{error ?? 'Schedule পাওয়া যায়নি।'}</p>
          <Link to={ROUTES.SCHEDULE} className="text-sm text-[#818CF8] hover:underline">
            ← Schedule Page-এ ফিরে যান
          </Link>
        </div>
      </div>
    )
  }

  // Class ended
  if (status === 'ended') {
    return (
      <ClassEndedScreen
        title={schedule.title}
        lectureId={schedule.lectureId}
        scheduleId={schedule.id}
        isCustomRange={schedule.isCustomRange}
      />
    )
  }

  const countdownMs = schedule.startAt.toMillis() - reliableNowMs

  // ── Waiting Room (upcoming) ────────────────────────────────────────
  if (status === 'upcoming') {
    return (
      <div className="min-h-screen bg-[#080C10] flex flex-col">
        {/* Minimal top bar for waiting room */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2A36]/50">
          <Link
            to={ROUTES.SCHEDULE}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#1E2A36] transition-colors"
            title="Schedule Page"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#F8FAFC] truncate">{schedule.title}</p>
            <p className="text-xs text-[#64748B] truncate">
              {schedule.subjectName} · {formatScheduleTimeRange(schedule.startAt, schedule.endAt)}
            </p>
          </div>
          <div className="flex items-center gap-1 text-[#64748B]">
            <Clock size={12} />
            <span className="text-xs font-medium">UPCOMING</span>
          </div>
        </div>
        <WaitingRoom
          title={schedule.title}
          subjectName={schedule.subjectName}
          chapterName={schedule.chapterName}
          startAt={schedule.startAt}
          endAt={schedule.endAt}
          youtubeVideoId={schedule.youtubeVideoId}
          thumbnailUrl={schedule.thumbnailUrl}
          countdownMs={countdownMs}
          breakInfo={breakInfo}
          isCustomRange={schedule.isCustomRange}
          rangeStartSeconds={schedule.rangeStartSeconds}
          rangeEndSeconds={schedule.rangeEndSeconds}
          playbackSpeed={schedule.playbackSpeed}
          durationSeconds={schedule.durationSeconds}
          durationFormatted={schedule.durationFormatted}
        />
      </div>
    )
  }

  // ── Live Player — video fills entire screen, all UI overlays on top ──
  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden"
      style={{ height: '100dvh' }}
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* ── YouTube IFrame — fills entire container ───────────────── */}
      <div
        ref={playerDivRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Seek-bar blocker (PRD §11.2: no seek) */}
      <div
        className="absolute inset-0 z-10"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      />

      {/* Click overlay — play/pause + double-tap fullscreen */}
      <div
        className="absolute inset-0 z-20 cursor-pointer"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        aria-label="Play/Pause"
      />

      {/* ── Mandatory 10-Minute Break Screen Overlay (PRD Break Mode) ───────── */}
      {breakInfo.isBreakActive && (
        <div className="absolute inset-0 z-50 bg-[#080C10]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#F59E0B]/20 border border-[#F59E0B]/40 px-4 py-1.5 rounded-full text-[#FBBF24] text-xs font-bold tracking-wider mb-5 shadow-lg">
            <Coffee size={14} className="text-[#FBBF24]" />
            <span>বাধ্যতামূলক স্টাডি বিরতি {breakInfo.currentBreakNumber} / {breakInfo.totalBreaks}</span>
          </div>

          {/* Big Countdown Timer */}
          <div className="space-y-2 mb-6">
            <p className="text-6xl sm:text-7xl font-black text-white font-mono tracking-tight tabular-nums drop-shadow-2xl">
              {formatDuration(breakInfo.breakRemainingSeconds)}
            </p>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              ১০ মিনিটের বিরতি চলছে • বিরতি শেষে ক্লাস স্বয়ংক্রিয়ভাবে পরবর্তী অংশ থেকে শুরু হবে
            </p>
          </div>

          {/* Focus & Health Tips */}
          <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-5 max-w-md w-full text-left space-y-3 mb-6 shadow-2xl">
            <p className="text-xs font-semibold text-[#818CF8] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} />
              মনোযোগ ও চোখ সতেজ রাখার কিছু টিপস
            </p>
            <ul className="space-y-2.5 text-xs text-[#CBD5E1]">
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none">💧</span>
                <span>এক গ্লাস বিশুদ্ধ পানি পান করুন ও নিজেকে হাইড্রেটেড রাখুন।</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none">🧘</span>
                <span>চেয়ার ছেড়ে উঠে একটু স্ট্রেচিং করুন বা হালকা হাঁটাহাঁটি করুন।</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none">👀</span>
                <span>চোখকে বিশ্রাম দিতে ২০ সেকেন্ড দূরে কোনো বস্তুর দিকে তাকান (20-20-20 Rule)।</span>
              </li>
            </ul>
          </div>

          {/* Non-skippable lock notice */}
          <div className="flex items-center gap-2 bg-[#0F172A] border border-[#334155]/60 rounded-xl px-4 py-2.5 text-xs text-[#94A3B8] max-w-md shadow-md">
            <Lock size={13} className="text-[#EF4444] shrink-0" />
            <span>পড়াশোনার পূর্ণ শৃঙ্খলার স্বার্থে এই বিরতি স্কিপ করা সম্ভব নয়।</span>
          </div>
        </div>
      )}

      {/* ── Floating Live Clock when controls auto-hide in Fullscreen ── */}
      {isFullscreen && showClock && bdTime && isPlaying && !showControls && (
        <div className="absolute top-3.5 right-4 z-30 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-mono text-white/90 border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5 select-none transition-opacity duration-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
          <span className="font-semibold tracking-tight tabular-nums">{bdTime}</span>
        </div>
      )}

      {/* ── Top bar — transparent overlay ────────────────────────── */}
      <div
        className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-3 transition-opacity duration-300 ${
          isPlaying && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
      >
        {/* Left Section: Back + Authentic LIVE Badge + Class info (Facebook Live style) */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link
            to={ROUTES.SCHEDULE}
            className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Schedule Page"
          >
            <ChevronLeft size={18} />
          </Link>

          {/* Real-Life LIVE Badge on Left */}
          <LiveStatusBadge
            syncMode={syncMode}
            behindLiveSeconds={behindLiveSeconds}
            isPlaying={isPlaying}
            isBreak={breakInfo.isBreakActive}
            breakRemainingSeconds={breakInfo.breakRemainingSeconds}
            onClick={goLive}
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate drop-shadow">{schedule.title}</p>
            <p className="text-xs text-[#94A3B8] truncate drop-shadow">
              {schedule.subjectName} · {schedule.chapterName}
              {schedule.isCustomRange && (
                <span className="text-[#38BDF8] ml-1.5 font-mono font-medium">
                  [{formatSecondsToTimestampString(schedule.rangeStartSeconds ?? 0)} – {formatSecondsToTimestampString(schedule.rangeEndSeconds ?? schedule.durationSeconds)}]
                </span>
              )}
              {schedule.playbackSpeed && schedule.playbackSpeed !== 1 && (
                <span className="text-[#A5B4FC] ml-2 font-mono font-bold bg-[#6366F1]/30 px-1.5 py-0.5 rounded text-[10px] border border-[#6366F1]/40 shadow-sm">
                  ⚡ {schedule.playbackSpeed}x
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Section: Live Clock — Completely isolated on the right edge */}
        {showClock && bdTime && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-mono text-white/95 shadow-md shrink-0 select-none ml-2"
            title="বর্তমান সময়"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
            <span className="font-semibold tracking-tight tabular-nums">{bdTime}</span>
          </div>
        )}
      </div>

      {/* ── Bottom controls bar — transparent overlay ─────────────── */}
      {(() => {
        const rangeStart = schedule.rangeStartSeconds ?? 0
        const currentPlaybackPosition = syncMode === 'FOLLOWING_LIVE'
          ? livePositionSeconds
          : Math.max(rangeStart, livePositionSeconds - behindLiveSeconds)

        const liveElapsedSeconds = Math.max(0, livePositionSeconds - rangeStart)
        const currentPlaybackElapsed = Math.max(0, currentPlaybackPosition - rangeStart)

        const liveProgressPercent = syncMode === 'FOLLOWING_LIVE'
          ? 100
          : liveElapsedSeconds > 0
            ? Math.max(2, Math.min(100, (currentPlaybackElapsed / liveElapsedSeconds) * 100))
            : 100

        return (
          <div
            className={`absolute bottom-0 left-0 right-0 z-40 transition-opacity duration-300 ${
              showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)' }}
          >
            <div className="px-4 pb-4 pt-10">
              {/* Facebook Live-style Progress Bar — filled to the end (100%) with live dot */}
              <div
                className="relative w-full py-2 cursor-pointer group mb-2 select-none"
                onClick={goLive}
                title={syncMode === 'FOLLOWING_LIVE' ? 'লাইভ সম্প্রচার চলছে (Live)' : 'লাইভ পজিশনে যান'}
              >
                {/* Track */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#EF4444] rounded-full transition-all duration-150"
                    style={{ width: `${liveProgressPercent}%` }}
                  />
                </div>

                {/* Glowing Live Dot at the edge of the bar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-150 pointer-events-none"
                  style={{ left: `${liveProgressPercent}%` }}
                >
                  <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                    {syncMode === 'FOLLOWING_LIVE' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,1)] border border-white" />
                  </span>
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className={`${ctrlBtn} text-white hover:text-[#A5B4FC] min-w-[40px] min-h-[40px]`}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying
                    ? <Pause size={20} className="fill-white" />
                    : <Play size={20} className="fill-white" />
                  }
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className={`${ctrlBtn} text-[#CBD5E1] hover:text-white min-w-[36px] min-h-[36px]`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    <VolumeIcon size={18} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-[#6366F1] cursor-pointer"
                    title="Volume"
                  />
                </div>

                {/* Live status badge + elapsed live duration (Facebook / YouTube Live style) */}
                <div className="flex items-center gap-2 ml-1">
                  <LiveStatusBadge
                    syncMode={syncMode}
                    behindLiveSeconds={behindLiveSeconds}
                    isPlaying={isPlaying}
                    isBreak={breakInfo.isBreakActive}
                    breakRemainingSeconds={breakInfo.breakRemainingSeconds}
                    onClick={goLive}
                  />

                  {/* Kotokkhon dhore live cholteche (Elapsed time so far) */}
                  {!breakInfo.isBreakActive && (
                    <span className="text-xs font-mono font-bold text-white/95 tabular-nums tracking-wide drop-shadow select-none">
                      {formatDuration(currentPlaybackElapsed)}
                    </span>
                  )}
                </div>

                {/* LIVE button (when DELAYED) */}
                {syncMode === 'DELAYED' && (
                  <button
                    onClick={goLive}
                    className="flex items-center gap-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer shadow-lg ml-1"
                    title="Live Position-এ ফিরে যান"
                  >
                    <Wifi size={12} />
                    LIVE-এ যান
                  </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Playback speed indicator if not 1x */}
                {schedule.playbackSpeed && schedule.playbackSpeed !== 1 && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#A5B4FC] bg-[#6366F1]/20 border border-[#6366F1]/30 px-2 py-1 rounded-lg select-none mr-1"
                    title={`লাইভ ক্লাসের গতি ${schedule.playbackSpeed}x-এ লক করা`}
                  >
                    <Zap size={11} className="text-[#818CF8]" />
                    {schedule.playbackSpeed}x
                  </span>
                )}

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className={`${ctrlBtn} text-[#CBD5E1] hover:text-white min-w-[36px] min-h-[36px]`}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Buffering spinner ─────────────────────────────────────── */}
      {isBuffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 rounded-full p-4">
            <Loader2 size={32} className="text-[#6366F1] animate-spin" />
          </div>
        </div>
      )}

      {/* ── Autoplay blocked prompt ───────────────────────────────── */}
      {needsInteraction && !isPlaying && !isBuffering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <button
            onClick={() => {
              setNeedsInteraction(false)
              const expectedPos = schedule
                ? calculateExpectedLivePosition(schedule, Date.now())
                : 0
              const rangeEnd = schedule
                ? (schedule.rangeEndSeconds ?? ((schedule.rangeStartSeconds ?? 0) + schedule.durationSeconds))
                : Infinity
              try {
                if (expectedPos >= rangeEnd) {
                  playerRef.current?.seekTo?.(rangeEnd, true)
                  playerRef.current?.pauseVideo?.()
                } else {
                  playerRef.current?.seekTo?.(expectedPos, true)
                  playerRef.current?.playVideo?.()
                }
              } catch { /* ignore */ }
            }}
            className="flex flex-col items-center gap-3 bg-[#6366F1] hover:bg-[#4F46E5] px-8 py-5 rounded-2xl text-white transition-colors cursor-pointer shadow-xl"
          >
            <Play size={32} className="fill-white" />
            <span className="text-sm font-semibold">Live Class শুরু করুন</span>
          </button>
        </div>
      )}

      {/* ── Player error ──────────────────────────────────────────── */}
      {playerError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#080C10]/90">
          <div className="text-center space-y-3 p-6">
            <AlertTriangle size={36} className="text-[#EF4444] mx-auto" />
            <p className="text-sm text-[#F8FAFC]">{playerError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-[#818CF8] hover:underline cursor-pointer"
            >
              পেজ রিফ্রেশ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
