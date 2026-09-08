/**
 * Netlify Serverless Function: polish-note
 *
 * Receives raw plain text / markdown note and converts it into
 * a beautiful, color-coded, exam-ready HTML snippet using AI.
 * The API key is NEVER exposed to the frontend.
 *
 * POST /.netlify/functions/polish-note
 * Body: { rawText: string }
 * Response: { html: string } | { error: string }
 *
 * Environment variables (set in Netlify Dashboard):
 *   OPENROUTER_API_KEY -- your OpenRouter key
 */

import type { Handler, HandlerEvent } from '@netlify/functions'

const NOTE_SYSTEM_PROMPT = `You are an expert study note formatter for a dark-themed educational platform.
Your job is to convert plain text or markdown notes into a beautiful, interactive HTML snippet optimized for exam revision.

STRICT RULES:
- Return ONLY the HTML content -- no markdown, no explanation, no code fences
- Use ONLY inline CSS styles -- no <style> tags, no <script> tags, no external resources
- Do NOT include <html>, <head>, or <body> tags
- The container background is dark (#0B0F14), so use light text

DESIGN GUIDELINES:
- Wrap everything in: <div style="font-family: Inter, sans-serif; color: #E2E8F0; line-height: 1.7; font-size: 14px;">
- Section headings: <h2 style="color: #818CF8; font-size: 16px; font-weight: 700; margin: 20px 0 8px; border-bottom: 1px solid #1E2A36; padding-bottom: 6px;">
- Sub-headings: <h3 style="color: #A5B4FC; font-size: 14px; font-weight: 600; margin: 14px 0 6px;">
- Key terms: <span style="background: rgba(99,102,241,0.2); color: #818CF8; padding: 1px 6px; border-radius: 4px; font-weight: 600;">term</span>
- Definitions: <span style="color: #34D399; font-weight: 500;">definition</span>
- Formulas: <code style="background: rgba(245,158,11,0.15); color: #F59E0B; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 13px;">formula</code>
- Warnings: <span style="color: #EF4444; font-weight: 600;">warning</span>
- Examples: <span style="color: #38BDF8;">example</span>
- Important callout: <div style="background: rgba(99,102,241,0.1); border-left: 3px solid #6366F1; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0;">
- Tip box: <div style="background: rgba(52,211,153,0.08); border-left: 3px solid #34D399; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0;">
- Caution box: <div style="background: rgba(239,68,68,0.08); border-left: 3px solid #EF4444; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0;">
- List item: <li style="margin: 4px 0; color: #CBD5E1;">
- Paragraph: <p style="margin: 8px 0; color: #CBD5E1;">

CONTENT RULES:
- Identify and highlight ALL key terms, formulas, definitions automatically
- Group related content under clear headings
- Keep content faithful to the input -- do not add facts not in the original
- Make it visually scannable in 60 seconds`

const NOTE_USER_PROMPT = (rawText: string) =>
  `Convert the following study notes into polished HTML. Keep ALL the information from the input:\n\n${rawText}`

export const handler: Handler = async (event: HandlerEvent) => {
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
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'AI service is not configured on this server.' }),
    }
  }

  let rawText = ''
  try {
    const body = JSON.parse(event.body ?? '{}')
    rawText = typeof body.rawText === 'string' ? body.rawText.trim() : ''
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid request body.' }) }
  }

  if (!rawText) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'rawText is required.' }) }
  }

  if (rawText.length > 8000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Input text is too long (max 8,000 characters).' }),
    }
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zyntrafocus.netlify.app',
        'X-Title': 'ZyntraFocus',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: NOTE_SYSTEM_PROMPT },
          { role: 'user', content: NOTE_USER_PROMPT(rawText) },
        ],
        temperature: 0.3,
        max_tokens: 8000,
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

    if (!content.trim()) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'AI returned an empty response. Please try again.' }),
      }
    }

    const html = content
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ html }),
    }
  } catch (err) {
    console.error('polish-note function error:', err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
    }
  }
}
