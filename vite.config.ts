import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

function netlifyDevFunctionsPlugin(env: Record<string, string>) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/.netlify/functions/polish-note' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: any) => { body += chunk })
          req.on('end', async () => {
            try {
              const { rawText, subjectName, chapterName } = JSON.parse(body)
              const apiKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
              if (!apiKey) {
                res.statusCode = 503
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'AI service is not configured (missing OPENROUTER_API_KEY in .env).' }))
                return
              }
              const contextParts = [
                subjectName ? `বিষয় (Subject): ${subjectName}` : '',
                chapterName ? `অধ্যায় (Chapter): ${chapterName}` : '',
              ].filter(Boolean)
              const context = contextParts.length > 0 ? `[একাডেমিক তথ্য: ${contextParts.join(' | ')}]\n\n` : ''
              const userPrompt = `${context}নিচের স্টাডি নোটগুলোকে একটি নিখুঁত, সুন্দর ও সম্পূর্ণ বাংলা রিভিশন গাইডে রূপান্তর করো। প্রতিটি টপিক সংক্ষেপে পরিষ্কার বাংলায় বুঝিয়ে বলবে, কোনো টপিক বাদ দেবে না এবং সূত্রগুলো ফর্মুলা কার্ড সহ উপস্থাপন করবে:\n\n${rawText}`

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
                    {
                      role: 'system',
                      content: `You are an elite academic note architect and exam revision specialist for a dark-themed educational platform.
Your task is to transform raw study notes (physics, chemistry, math, biology concepts, formulas, equations) into a masterclass interactive study guide in Bengali (বাংলা) optimized for fast exam revision.

LANGUAGE REQUIREMENT (MANDATORY BENGALI - বাংলা):
- ALL content — headings, subheadings, explanations, concept definitions, variable descriptions, callout tips, and summaries — MUST BE WRITTEN IN CLEAR, NATURAL, FLUENT BENGALI (বাংলা).
- Do NOT output English explanations. Keep all conceptual explanations in Bengali so Bangladeshi HSC and Admission students can grasp them effortlessly.
- Standard English technical terms can be mentioned in parentheses alongside the Bengali term for clarity.
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
                    },
                    { role: 'user', content: userPrompt },
                  ],
                  temperature: 0.3,
                  max_tokens: 16000,
                  stream: true,
                }),
              })

              if (!response.ok) {
                const errText = await response.text()
                res.statusCode = 502
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: `AI error: ${errText}` }))
                return
              }

              res.statusCode = 200
              res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
              res.setHeader('Cache-Control', 'no-cache, no-transform')
              res.setHeader('Connection', 'keep-alive')
              res.setHeader('X-Accel-Buffering', 'no')

              const reader = response.body?.getReader()
              if (!reader) {
                res.end()
                return
              }

              while (true) {
                const { done, value } = await reader.read()
                if (done) {
                  res.end()
                  break
                }
                res.write(value)
              }
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || 'Error processing AI note' }))
            }
          })
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      netlifyDevFunctionsPlugin(env),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.jpg'],
      manifest: {
        name: 'ZyntraFocus',
        short_name: 'ZyntraFocus',
        description: 'Distraction-Free Personal Learning Platform',
        theme_color: '#0B0F14',
        background_color: '#0B0F14',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: 'icon.jpg', sizes: '192x192', type: 'image/jpeg' },
          { src: 'icon.jpg', sizes: '512x512', type: 'image/jpeg' },
          { src: 'icon.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        navigateFallbackDenylist: [/^\/api/, /^\/\.netlify/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // manualChunks as a function (required by Rollup types)
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router')) {
            return 'router'
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3') || id.includes('node_modules/victory')) {
            return 'charts'
          }
        },
      },
    },
  },
  }
})
