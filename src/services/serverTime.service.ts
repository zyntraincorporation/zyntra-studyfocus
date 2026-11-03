/**
 * serverTime.service.ts
 *
 * Provides a reliable server-synchronized time source for the Live Learning System.
 *
 * Problem: Device clocks can be wrong, manipulated, or drifted.
 * Using only `new Date()` for schedule timing is insecure.
 *
 * Solution: NTP-style clock offset calculation using the Netlify server-time function.
 *   clockOffset = serverTime + (rtt / 2) - localTime
 *   reliableNow() = Date.now() + clockOffset
 *
 * Usage:
 *   import { initClockSync, getReliableTime } from '@/services/serverTime.service'
 *   await initClockSync()                   // Call once at app/page init
 *   const nowMs = getReliableTime()         // Use everywhere instead of Date.now()
 *
 * Recalibration happens:
 *   - On initial call to initClockSync()
 *   - On document visibility change (tab comes back to foreground)
 *   - Periodically (every CLOCK_RESYNC_INTERVAL_MS)
 *
 * Limitation: We do NOT guarantee millisecond accuracy.
 * Goal: Synchronization within a few seconds under normal network conditions.
 * This is sufficient for schedule-based live class management.
 */

import type { ClockSyncState, ServerTimeResponse } from '@/types/schedule.types'
import { CLOCK_RESYNC_INTERVAL_MS } from '@/constants/firebase'

// ── Internal State ────────────────────────────────────────────────────
// Module-level singleton (not exported — use provided functions)
let syncState: ClockSyncState = {
  offsetMs: 0,
  lastSyncedAt: 0,
  roundTripTimeMs: 0,
  isSynced: false,
}

let resyncTimer: ReturnType<typeof setInterval> | null = null
let visibilityListener: (() => void) | null = null

// ── Core Sync Function ────────────────────────────────────────────────

/**
 * Fetches the server time and calculates the clock offset using NTP-style RTT compensation.
 * Falls back to local time silently if the network call fails.
 */
async function performClockSync(): Promise<void> {
  const t0 = Date.now()
  try {
    const res = await fetch('/.netlify/functions/server-time', {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) {
      console.warn('[serverTime] Server returned non-OK status:', res.status)
      return
    }

    const data: ServerTimeResponse = await res.json()
    const t1 = Date.now()

    if (typeof data.serverTime !== 'number' || data.serverTime <= 0) {
      console.warn('[serverTime] Invalid serverTime received:', data)
      return
    }

    const roundTripTimeMs = t1 - t0
    // NTP-style: estimate server time at moment t1 by adding half of RTT
    const estimatedServerTimeAtT1 = data.serverTime + roundTripTimeMs / 2
    const offsetMs = estimatedServerTimeAtT1 - t1

    syncState = {
      offsetMs,
      lastSyncedAt: t1,
      roundTripTimeMs,
      isSynced: true,
    }

    if (import.meta.env.DEV) {
      console.debug(
        `[serverTime] Synced. Offset: ${offsetMs.toFixed(0)}ms, RTT: ${roundTripTimeMs}ms`
      )
    }
  } catch (err) {
    // Network failure — keep using last known offset (or 0 if never synced)
    console.warn('[serverTime] Sync failed, using local clock fallback:', err)
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Returns the reliable current time in milliseconds.
 * Applies the measured clock offset to compensate for device clock drift.
 * Falls back to Date.now() if sync has never succeeded.
 */
export function getReliableTime(): number {
  return Date.now() + syncState.offsetMs
}

/**
 * Returns the current sync state (for debugging or UI indicators).
 */
export function getClockSyncState(): Readonly<ClockSyncState> {
  return { ...syncState }
}

/**
 * Initialises the clock sync system.
 * - Performs an immediate sync
 * - Schedules periodic re-syncs
 * - Registers a visibility change listener for tab-focus re-sync
 *
 * Safe to call multiple times — subsequent calls are no-ops if already running.
 *
 * Call this once when the live player or schedule page mounts.
 */
export async function initClockSync(): Promise<void> {
  // Perform immediate sync
  await performClockSync()

  // Periodic re-sync (every 5 minutes by default)
  if (!resyncTimer) {
    resyncTimer = setInterval(() => {
      performClockSync()
    }, CLOCK_RESYNC_INTERVAL_MS)
  }

  // Re-sync when tab comes back to foreground
  // (Background tab throttling can cause large clock drift)
  if (!visibilityListener) {
    visibilityListener = () => {
      if (document.visibilityState === 'visible') {
        performClockSync()
      }
    }
    document.addEventListener('visibilitychange', visibilityListener)
  }
}

/**
 * Tears down the clock sync system.
 * Call this when the live player unmounts to prevent memory leaks.
 */
export function destroyClockSync(): void {
  if (resyncTimer !== null) {
    clearInterval(resyncTimer)
    resyncTimer = null
  }
  if (visibilityListener !== null) {
    document.removeEventListener('visibilitychange', visibilityListener)
    visibilityListener = null
  }
}

/**
 * Force an immediate re-sync (e.g. on network recovery).
 * Returns the new offset in ms.
 */
export async function forceClockResync(): Promise<number> {
  await performClockSync()
  return syncState.offsetMs
}

