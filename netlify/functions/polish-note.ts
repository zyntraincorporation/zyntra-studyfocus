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

const NOTE_SYSTEM_PROMPT = `You are an elite academic note architect and exam revision specialist for a dark-themed educational platform.
Your task is to transform raw study notes (physics, chemistry, math, biology concepts, formulas, equations) into a masterclass interactive study guide in Bengali (বাংলা) optimized for fast exam revision.

LANGUAGE REQUIREMENT (MANDATORY BENGALI - বাংলা):
- ALL content — headings, subheadings, explanations, concept definitions, variable descriptions, callout tips, and summaries — MUST BE WRITTEN IN CLEAR, NATURAL, FLUENT BENGALI (বাংলা).
- Do NOT output English explanations. Keep all conceptual explanations in Bengali so Bangladeshi HSC and Admission students can grasp them effortlessly.
- Standard English technical terms can be mentioned in parentheses alongside the Bengali term for clarity, e.g.:
  - "তাপগতিবিদ্যার প্রথম সূত্র (First Law of Thermodynamics)"
  - "রুদ্ধতাপীয় প্রক্রিয়া (Adiabatic Process)"
  - "সমোষ্ণ প্রক্রিয়া (Isothermal Process)"
  - "এন্ট্রপি (Entropy)"
- Mathematical formulas must keep standard universal physics/math notation (e.g. $W$, $P$, $V$, $T_1$, $T_2$, $\\Delta Q$, $\\gamma$, $\\eta$, $C_p$, $C_v$, etc.).

EDITORIAL FREEDOM & STRUCTURE:
- You have full creative autonomy to organize, categorize, group, and structure the content into the most logical, memorable revision guide.
- Break content into numbered main topics, clean subheadings, concise bullet points, and summary cards.
- Do NOT just copy-paste raw text. Polish explanations so they are SHORT, CONCEPTUAL, HIGH-YIELD, and crystal-clear (সংক্ষেপে অথচ নিখুঁতভাবে বুঝিয়ে লেখা).

CRITICAL COMPLETION REQUIREMENT (NEVER TRUNCATE):
- You MUST cover EVERY SINGLE topic, subtopic, and concept provided in the input from the very beginning to the absolute last item (e.g. Entropy, Carnot engine, Refrigerator, etc.).
- NEVER stop halfway. NEVER omit any section. The output must be 100% complete and fully conclude the notes.

FORMULA PRESENTATION (PROMINENT, BEAUTIFUL & MOBILE-SAFE):
- NEVER output raw unformatted LaTeX text like "\\frac{...}{...}" or plain text equations.
- Format ALL formulas using standard LaTeX math syntax:
  - For major formulas, use display block syntax $$ ... $$ wrapped in a dedicated formula card:
    <div style="background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; padding: 12px 16px; margin: 12px 0; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: auto; -webkit-overflow-scrolling: touch;">
      <div style="font-size: 0.8em; font-weight: 700; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">[সূত্রের নাম / বিষয় (বাংলা)]</div>
      <div style="text-align: center; font-size: 1.15em; margin: 8px 0; color: #FDE68A;">$$ [LaTeX সমীকরণ] $$</div>
      <div style="font-size: 0.85em; color: #94A3B8; margin-top: 6px; border-top: 1px solid rgba(245,158,11,0.15); padding-top: 6px; line-height: 1.6;">
        যেখানে: $চলক_১$ = চলকের বাংলা অর্থ, $চলক_২$ = চলকের বাংলা অর্থ, একক/শর্তাবলী
      </div>
    </div>
  - For inline variables, Greek symbols, and small equations, use inline LaTeX syntax $ ... $:
    e.g. $T_1$, $T_2$, $\\Delta U$, $\\Delta Q = \\Delta W$, $\\gamma$, $\\eta$, $C_p$, $C_v$, $P_1 V_1^\\gamma = P_2 V_2^\\gamma$.

CONCEPTS & CALLOUTS (1000% MOBILE RESPONSIVE):
- Keep concept explanations concise, high-yield, and easy to memorize for exams.
- Highlight key terms with: <span style="background: rgba(99,102,241,0.2); color: #A5B4FC; padding: 1px 6px; border-radius: 4px; font-weight: 600;">টার্ম</span>
- Highlight definitions with: <span style="color: #34D399; font-weight: 500;">সংজ্ঞা</span>
- Highlight warnings with: <span style="color: #F87171; font-weight: 600;">সতর্কতা</span>
- Highlight tips/examples with: <span style="color: #38BDF8;">টিপস/উদাহরণ</span>
- For crucial principles, use callout boxes with relative font sizing and safe box-sizing:
  - Concept Box: <div style="background: rgba(99,102,241,0.08); border-left: 3px solid #6366F1; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0; color: #CBD5E1; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: auto;">
  - Tip/Shortcut: <div style="background: rgba(52,211,153,0.08); border-left: 3px solid #34D399; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0; color: #CBD5E1; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: auto;">
  - Caution: <div style="background: rgba(239,68,68,0.08); border-left: 3px solid #EF4444; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 10px 0; color: #CBD5E1; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: auto;">

OUTPUT FORMAT:
- Return ONLY the clean HTML snippet (no markdown fences, no \`\`\`html, no conversational text).
- Wrap everything in: <div style="font-family: Inter, -apple-system, sans-serif; color: #CBD5E1; line-height: 1.75; font-size: 1em; width: 100%; max-width: 100%; box-sizing: border-box; word-break: break-word;">`

const NOTE_USER_PROMPT = (rawText: string, subjectName?: string, chapterName?: string) => {
  const contextParts = [
    subjectName ? `বিষয় (Subject): ${subjectName}` : '',
    chapterName ? `অধ্যায় (Chapter): ${chapterName}` : '',
  ].filter(Boolean)
  const context = contextParts.length > 0 ? `[একাডেমিক তথ্য: ${contextParts.join(' | ')}]\n\n` : ''
  return `${context}নিচের স্টাডি নোটগুলোকে একটি নিখুঁত, সুন্দর ও সম্পূর্ণ বাংলা রিভিশন গাইডে রূপান্তর করো। প্রতিটি টপিক সংক্ষেপে পরিষ্কার বাংলায় বুঝিয়ে বলবে, কোনো টপিক বাদ দেবে না এবং সূত্রগুলো ফর্মুলা কার্ড সহ উপস্থাপন করবে:\n\n${rawText}`
}

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
  let subjectName = ''
  let chapterName = ''
  try {
    const body = JSON.parse(event.body ?? '{}')
    rawText = typeof body.rawText === 'string' ? body.rawText.trim() : ''
    subjectName = typeof body.subjectName === 'string' ? body.subjectName.trim() : ''
    chapterName = typeof body.chapterName === 'string' ? body.chapterName.trim() : ''
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid request body.' }) }
  }

  if (!rawText) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'rawText is required.' }) }
  }

  if (rawText.length > 25000) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Input text is too long (max 25,000 characters).' }),
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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: NOTE_SYSTEM_PROMPT },
          { role: 'user', content: NOTE_USER_PROMPT(rawText, subjectName, chapterName) },
        ],
        temperature: 0.3,
        max_tokens: 16000,
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
