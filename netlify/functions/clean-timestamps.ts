/**
 * Netlify Serverless Function: clean-timestamps
 *
 * Receives raw user-pasted timestamp text and normalizes it using
 * OpenRouter AI. The API key is NEVER exposed to the frontend.
 *
 * POST /.netlify/functions/clean-timestamps
 * Body: { rawText: string, videoDurationSeconds?: number }
 * Response: { timestamps: LectureTimestamp[] } | { error: string }
 *
 * Environment variables (set in Netlify Dashboard):
 *   OPENROUTER_API_KEY — your OpenRouter key
 *   OPENROUTER_MODEL   — model to use (default: openai/gpt-4o-mini)
 */

import type { Handler, HandlerEvent } from '@netlify/functions'

interface LectureTimestamp {
  time: number
  label: string
}

const AI_SYSTEM_PROMPT = `You are a timestamp formatter. You ONLY format and normalize timestamps that the user provides.

Rules you MUST follow:
- Do NOT invent timestamps that are not in the input.
- Do NOT change the meaning of any timestamp.
- Do NOT create timestamps that were not provided by the user.
- Do NOT remove valid timestamps from the input.
- Preserve ALL timestamp information from the input.
- Convert any time format (MM:SS, HH:MM:SS, "X min Y sec", etc.) to integer seconds.
- Clean up label/title text (fix capitalization, trim whitespace).
- Return ONLY a valid JSON array with no extra text, markdown, or code fences.

Output schema (JSON array):
[{"time": <integer seconds>, "label": "<string>"}]`

const AI_USER_PROMPT = (rawText: string) =>
  `Normalize these timestamps into the JSON array format described. Do not add or remove any timestamps:\n\n${rawText}`

function isValidTimestampArray(data: unknown): data is LectureTimestamp[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return true
  if (data.length > 200) return false
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).time === 'number' &&
      (item as Record<string, unknown>).time >= 0 &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      ((item as Record<string, unknown>).label as string).trim().length > 0
  )
}

function normalizeTimestamps(timestamps: LectureTimestamp[], maxSeconds?: number): LectureTimestamp[] {
  return timestamps
    .filter((t) => !maxSeconds || t.time <= maxSeconds + 60) // allow 60s grace
    .map((t) => ({ time: Math.round(Math.max(0, t.time)), label: t.label.trim() }))
    .sort((a, b) => a.time - b.time)
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'AI service is not configured on this server.' }),
    }
  }

  const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'

  let rawText = ''
  let videoDurationSeconds: number | undefined

  try {
    const body = JSON.parse(event.body ?? '{}')
    rawText = typeof body.rawText === 'string' ? body.rawText.trim() : ''
    videoDurationSeconds = typeof body.videoDurationSeconds === 'number' ? body.videoDurationSeconds : undefined
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid request body.' }),
    }
  }

  if (!rawText) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'rawText is required.' }),
    }
  }

  if (rawText.length > 10_000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Input text is too long (max 10,000 characters).' }),
    }
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zyntra-focus.netlify.app',
        'X-Title': 'ZyntraFocus',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: AI_USER_PROMPT(rawText) },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenRouter error:', response.status, errText)
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'AI service returned an error. Please try again.' }),
      }
    }

    const json = await response.json()
    const content: string = json?.choices?.[0]?.message?.content ?? ''

    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('AI returned non-JSON content:', cleaned.slice(0, 200))
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'AI returned an unreadable response. Please try again or edit manually.' }),
      }
    }

    if (!isValidTimestampArray(parsed)) {
      console.error('AI returned invalid schema:', JSON.stringify(parsed).slice(0, 200))
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'AI returned invalid timestamp data. Please edit manually.' }),
      }
    }

    const normalized = normalizeTimestamps(parsed, videoDurationSeconds)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ timestamps: normalized }),
    }
  } catch (err) {
    console.error('clean-timestamps function error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
    }
  }
}
