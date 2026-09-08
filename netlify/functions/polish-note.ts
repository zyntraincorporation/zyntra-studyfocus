/**
 * Netlify Serverless Function: polish-note (Functions v2 with Response Streaming)
 *
 * Receives raw plain text / markdown note and converts it into
 * a beautiful, color-coded, exam-ready HTML snippet using AI.
 * The API key is NEVER exposed to the frontend.
 *
 * Uses Server-Sent Events (SSE) streaming to bypass Netlify's 10-second
 * synchronous timeout limit, supporting large payloads (8,500+ characters).
 *
 * POST /.netlify/functions/polish-note
 * Body: { rawText: string, subjectName?: string, chapterName?: string }
 * Response: Server-Sent Events stream (text/event-stream)
 *
 * Environment variables (set in Netlify Dashboard):
 *   OPENROUTER_API_KEY -- your OpenRouter key
 */

import type { Config } from '@netlify/functions'

const NOTE_SYSTEM_PROMPT = `You are an elite academic note architect and exam revision specialist for a dark-themed educational platform.
Your task is to transform raw study notes (physics, chemistry, math, biology concepts, formulas, equations) into a masterclass interactive study guide in Bengali (বাংলা) optimized for fast exam revision.

LANGUAGE REQUIREMENT (MANDATORY BENGALI - বাংলা):
- ALL content — headings, subheadings, explanations, concept definitions, variable descriptions, callout tips, and summaries — MUST BE WRITTEN IN CLEAR, NATURAL, FLUENT BENGALI (বাংলা).
- Do NOT output English explanations. Keep all conceptual explanations in Bengali so Bangladeshi HSC and Admission students can grasp them effortlessly.
- Standard English technical terms can be mentioned in parentheses alongside the Bengali term for clarity, e.g.:
  - "তাপগতিবিদ্যার প্রথম সূত্র (First Law of Thermodynamics)"
  - "বিপরীত ত্রিকোণমিতিক ফাংশন (Inverse Trigonometric Functions)"
- Mathematical formulas must keep standard universal physics/math notation (e.g. $W$, $P$, $V$, $T_1$, $T_2$, $\\Delta Q$, $\\gamma$, $\\eta$, $C_p$, $C_v$, $\\sin^{-1}x$, etc.).

EDITORIAL FREEDOM & CONCISE STRUCTURE:
- Break content into numbered main topics (e.g. ১.১, ১.২...), clean subheadings, concise bullet points, and summary cards.
- Do NOT repeat long-winded paragraphs. Keep explanations SHORT, CONCEPTUAL, HIGH-YIELD, and crystal-clear (সংক্ষেপে অথচ নিখুঁতভাবে বুঝিয়ে লেখা).

CRITICAL COMPLETION REQUIREMENT (NEVER TRUNCATE):
- You MUST cover EVERY SINGLE topic, type, subtopic, and concept provided in the input from the very beginning to the absolute last item (e.g. Type-01 to Type-10).
- NEVER stop halfway. Keep explanations compact so that all sections are 100% complete and fully conclude.

FORMULA PRESENTATION (PROMINENT, BEAUTIFUL & MOBILE-SAFE):
- NEVER output raw unformatted LaTeX text like "\\frac{...}{...}".
- Format ALL formulas using standard LaTeX math syntax:
  - For major formulas, use display block syntax $$ ... $$ wrapped in a clean formula card:
    <div class="formula-card">
      <div class="formula-name">[সূত্রের নাম / বিষয় (বাংলা)]</div>
      <div class="formula-math">$$ [LaTeX সমীকরণ] $$</div>
      <div class="formula-vars">
        যেখানে: $চলক_১$ = চলকের বাংলা অর্থ, $চলক_২$ = চলকের বাংলা অর্থ, একক/শর্তাবলী
      </div>
    </div>
  - For inline variables, Greek symbols, and small equations, use inline LaTeX syntax $ ... $:
    e.g. $T_1$, $T_2$, $\\Delta U$, $\\Delta Q = \\Delta W$, $\\gamma$, $\\eta$, $\\sin^{-1}x$.

CONCEPTS & CALLOUTS:
- Highlight key terms with: <span class="term-badge">টার্ম</span>
- Highlight definitions with: <span class="def-term">সংজ্ঞা</span>
- Highlight warnings with: <span class="warn-term">সতর্কতা</span>
- Highlight tips/examples with: <span class="tip-term">টিপস/উদাহরণ</span>
- Callout boxes:
  - Concept Box: <div class="concept-box">সংক্ষিপ্ত ধারণা বা মূল ভাব</div>
  - Tip/Shortcut: <div class="tip-box"><span class="tip-term">টিপস:</span> গুরুত্বপূর্ণ শর্টকাট বা টেকনিক</div>
  - Caution: <div class="caution-box"><span class="warn-term">সতর্কতা:</span> সচরাচর হওয়া ভুল বা ব্যতিক্রম</div>

OUTPUT FORMAT:
- Return ONLY the clean HTML snippet (no markdown fences, no \`\`\`html, no conversational text).
- Wrap everything in: <div class="academic-note">`

const NOTE_USER_PROMPT = (rawText: string, subjectName?: string, chapterName?: string) => {
  const contextParts = [
    subjectName ? `বিষয় (Subject): ${subjectName}` : '',
    chapterName ? `অধ্যায় (Chapter): ${chapterName}` : '',
  ].filter(Boolean)
  const context = contextParts.length > 0 ? `[একাডেমিক তথ্য: ${contextParts.join(' | ')}]\n\n` : ''
  return `${context}নিচের স্টাডি নোটগুলোকে একটি নিখুঁত, সুন্দর ও সম্পূর্ণ বাংলা রিভিশন গাইডে রূপান্তর করো। প্রতিটি টপিক সংক্ষেপে পরিষ্কার বাংলায় বুঝিয়ে বলবে, কোনো টপিক বাদ দেবে না এবং সূত্রগুলো ফর্মুলা কার্ড সহ উপস্থাপন করবে:\n\n${rawText}`
}

export default async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI service is not configured on this server.' }), {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  let rawText = ''
  let subjectName = ''
  let chapterName = ''
  try {
    const body = await req.json()
    rawText = typeof body.rawText === 'string' ? body.rawText.trim() : ''
    subjectName = typeof body.subjectName === 'string' ? body.subjectName.trim() : ''
    chapterName = typeof body.chapterName === 'string' ? body.chapterName.trim() : ''
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  if (!rawText) {
    return new Response(JSON.stringify({ error: 'rawText is required.' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }

  if (rawText.length > 25000) {
    return new Response(JSON.stringify({ error: 'Input text is too long (max 25,000 characters).' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
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
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: NOTE_SYSTEM_PROMPT },
          { role: 'user', content: NOTE_USER_PROMPT(rawText, subjectName, chapterName) },
        ],
        temperature: 0.3,
        max_tokens: 16000,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('OpenRouter error:', response.status, errText)
      return new Response(JSON.stringify({ error: 'AI service returned an error. Please try again.' }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('polish-note function error:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
}

export const config: Config = {
  path: '/.netlify/functions/polish-note',
}
