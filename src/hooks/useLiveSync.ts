/**
 * useLiveSync.ts
 *
 * Core live synchronization hook for the Live Player.
 *
 * Responsibilities:
 *   1. Every LIVE_SYNC_INTERVAL_MS (2s): compare player.getCurrentTime()
 *      vs calculateExpectedLivePosition(). If drift > LIVE_DRIFT_TOLERANCE_SECONDS
 *      AND syncMode is FOLLOWING_LIVE → controlled seek.
 *   2. Exposes syncMode (FOLLOWING_LIVE | DELAYED), behindLiveSeconds,
 *      expectedPosition, and goLive() callback.
 *   3. On pause → switches to DELAYED mode automatically.
 *   4. goLive() → seek to current expected position → FOLLOWING_LIVE.
 *   5. NO Firestore calls in the sync loop.
 *
 * PRD references: §11.2 (player controls), §11.3 (pause), §11.4 (play), §12 (sync)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ScheduledClass, SyncMode } from '@/types/schedule.types'
import { calculateExpectedLivePosition } from '@/utils/schedule.utils'
import {
  LIVE_SYNC_INTERVAL_MS,
  LIVE_DRIFT_TOLERANCE_SECONDS,
  LIVE_DELAYED_THRESHOLD_SECONDS,
} from '@/constants/firebase'

interface UseLiveSyncOptions {
  /** The locked schedule currently playing. Null when not yet loaded. */
  schedule: ScheduledClass | null
  /** Ref to the YT.Player instance. May be null before player is ready. */
  playerRef: React.MutableRefObject<YT.Player | null>
  /** Current reliable now from useSchedule (updated every second). */
  reliableNowMs: number
  /** Whether the player is ready to accept API calls. */
  isPlayerReady: boolean
  /** Whether a mandatory 10-minute break is currently active */
  isBreakActive?: boolean
}

interface UseLiveSyncResult {
  /** Current sync mode */
  syncMode: SyncMode
  /** Seconds the viewer is behind the live position (0 when in sync) */
  behindLiveSeconds: number
  /** Expected position in seconds right now */
  expectedPosition: number
  /** Call this to seek back to live position and switch to FOLLOWING_LIVE */
  goLive: () => void
  /** Call this when the player pauses (from user action) */
  onUserPause: () => void
  /** Call this when the player resumes play (from user action) */
  onUserPlay: () => void
}

export function useLiveSync({
  schedule,
  playerRef,
  reliableNowMs,
  isPlayerReady,
  isBreakActive = false,
}: UseLiveSyncOptions): UseLiveSyncResult {
  const [syncMode, setSyncMode] = useState<SyncMode>('FOLLOWING_LIVE')
  const [behindLiveSeconds, setBehindLiveSeconds] = useState(0)

  // Keep syncMode accessible in the interval without stale closures
  const syncModeRef = useRef<SyncMode>('FOLLOWING_LIVE')
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isBreakActiveRef = useRef(isBreakActive)

  // Update ref when state changes
  useEffect(() => {
    syncModeRef.current = syncMode
  }, [syncMode])

  useEffect(() => {
    isBreakActiveRef.current = isBreakActive
  }, [isBreakActive])

  // Compute expected position from current reliable time
  const expectedPosition = schedule
    ? calculateExpectedLivePosition(schedule, reliableNowMs)
    : 0

  // ── Sync loop — no Firestore, runs every LIVE_SYNC_INTERVAL_MS ──────
  useEffect(() => {
    if (!schedule || !isPlayerReady) return

    const tick = () => {
      const player = playerRef.current
      if (!player) return

      // During mandatory break, keep paused and skip seeking
      if (isBreakActiveRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = (player as any).getPlayerState?.()
          if (s === 1 /* PLAYING */) player.pauseVideo?.()
        } catch { /* ignore */ }
        return
      }

      let currentTime = 0
      try {
        currentTime = player.getCurrentTime?.() ?? 0
      } catch {
        return
      }

      const rangeStart = schedule.rangeStartSeconds ?? 0
      const rangeEnd = schedule.rangeEndSeconds ?? (rangeStart + schedule.durationSeconds)

      // Clamping: If reached or exceeded end of range, halt playback
      if (currentTime >= rangeEnd) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s = (player as any).getPlayerState?.()
          if (s === 1 /* PLAYING */) player.pauseVideo?.()
        } catch { /* ignore */ }
        setBehindLiveSeconds(0)
        return
      }

      // If somehow before rangeStart, seek forward into range
      if (currentTime < rangeStart) {
        try {
          player.seekTo?.(rangeStart, true)
        } catch { /* ignore */ }
        return
      }

      const expectedPos = calculateExpectedLivePosition(schedule, Date.now())
      const drift = expectedPos - currentTime

      // Update behind-live indicator
      const behind = Math.max(0, drift)
      setBehindLiveSeconds(behind)

      // Auto-resync only in FOLLOWING_LIVE mode
      if (syncModeRef.current === 'FOLLOWING_LIVE') {
        if (drift > LIVE_DRIFT_TOLERANCE_SECONDS) {
          // Drifted too far behind — controlled seek to catch up
          try {
            player.seekTo?.(expectedPos, true)
          } catch {
            /* ignore */
          }
        } else if (drift < -LIVE_DRIFT_TOLERANCE_SECONDS) {
          // Somehow ahead of live (e.g. after manual seek) — resync back
          try {
            player.seekTo?.(expectedPos, true)
          } catch {
            /* ignore */
          }
        }
      } else {
        // DELAYED mode: just track how far behind we are
        if (behind < LIVE_DELAYED_THRESHOLD_SECONDS) {
          // Close enough to live — auto-restore FOLLOWING_LIVE
          setSyncMode('FOLLOWING_LIVE')
          syncModeRef.current = 'FOLLOWING_LIVE'
        }
      }
    }

    syncIntervalRef.current = setInterval(tick, LIVE_SYNC_INTERVAL_MS)
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [schedule, isPlayerReady, playerRef])

  // ── goLive — seek to expected position and switch to FOLLOWING_LIVE ──
  const goLive = useCallback(() => {
    if (!schedule || !playerRef.current || isBreakActiveRef.current) return

    const expectedPos = calculateExpectedLivePosition(schedule, Date.now())
    try {
      playerRef.current.seekTo?.(expectedPos, true)
      playerRef.current.playVideo?.()
    } catch {
      /* ignore */
    }
    setSyncMode('FOLLOWING_LIVE')
    syncModeRef.current = 'FOLLOWING_LIVE'
    setBehindLiveSeconds(0)
  }, [schedule, playerRef])

  // ── onUserPause — switch to DELAYED mode ─────────────────────────────
  const onUserPause = useCallback(() => {
    setSyncMode('DELAYED')
    syncModeRef.current = 'DELAYED'
  }, [])

  // ── onUserPlay — resume; stay in DELAYED or FOLLOWING_LIVE ───────────
  const onUserPlay = useCallback(() => {
    // When resuming from pause, if the player was only briefly paused
    // and drift is tiny, auto-restore FOLLOWING_LIVE.
    // The sync loop handles this via LIVE_DELAYED_THRESHOLD_SECONDS check.
    // No explicit state change here to avoid double-trigger with the loop.
  }, [])

  return {
    syncMode,
    behindLiveSeconds,
    expectedPosition,
    goLive,
    onUserPause,
    onUserPlay,
  }
}

