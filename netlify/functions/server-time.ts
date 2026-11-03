/**
 * Netlify Serverless Function: server-time
 *
 * Provides a trusted server-side timestamp for the ZyntraFocus Live Learning System.
 * Used by the client to calculate a clock offset and compensate for device clock drift.
 *
 * This is intentionally minimal and fast — no auth, no DB, just a timestamp.
 * Security note: The client uses this for UI display only. Actual schedule enforcement
 * (lock/unlock) is based on Firestore server timestamps, not this endpoint.
 *
 * GET /.netlify/functions/server-time
 * Response: { serverTime: number, timezone: string }
 *   serverTime — Unix ms (Date.now() at moment of response generation)
 *   timezone   — 'Asia/Dhaka' (informational)
 */

import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    // Prevent caching — we always want a fresh server time
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Return the server's current time in milliseconds
  // This is the trusted time source for live class synchronization.
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      serverTime: Date.now(),
      timezone: 'Asia/Dhaka',
    }),
  }
}

