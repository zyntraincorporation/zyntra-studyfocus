/**
 * EntranceModal — shows on every page load / reload.
 * No session gating. Random quote each time.
 * User must actively dismiss to enter the app.
 *
 * Also exports: BreakQuote (inline, for Timer break screen)
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// ─── Quotes ──────────────────────────────────────────────────────────────────
export const QUOTES: string[] = [
  'তোমার বাবা বলেছে বিদেশে পাঠাবে কামলা হিসেবে। BUET সেই দরজাটা বন্ধ করতে পারে।',
  'তুমি কি BUET চাও, নাকি রেস্তোরাঁয় টাকা গুনতে চাও?',
  'তোমার স্বপ্ন America-তে research। সেই স্বপ্নের দাম আজকের এই chapter-টা।',
  'তুমি IoT project বানিয়েছ। প্রমাণ করেছ তুমি পারো। এখন পরীক্ষাটা পাস করো।',
  'Gas detector বানানো মানুষ BUET-এ ঢুকতে পারবে না — এটা কি বিশ্বাস করো?',
  'তোমার family কষ্ট করছে। তুমি এখন যা করছ সেটা তাদের জন্যও।',
  'কামলা visa নাকি engineer visa — সিদ্ধান্তটা এখন তোমার হাতে।',
  'তুমি বিশ্ব জয় করতে চাও। বিশ্ব জয় শুরু হয় এই Physics chapter থেকে।',
  'সেরা inventor হতে হলে আগে সেরা student হতে হয়।',
  'America-তে গিয়ে বদলা দিতে চাও? তাহলে আজ পড়তে বসো।',
  'তোমার বাবা মাসে ১ লাখ টাকার কথা বলেছে। তোমার স্বপ্ন তার চেয়ে অনেক বড়।',
  'Lab-এ experiment করবে নাকি রেস্তোরাঁয় কাজ করবে — তুমিই ঠিক করো।',
  'তুমি passionate electronics নিয়ে। Passion-কে degree দিয়ে protect করতে হয়।',
  'BUET-এর seat আছে ১০০০। তোমার competitor লক্ষাধিক। আজ কত ঘণ্টা পড়েছ?',
  'Research করতে হলে ভালো institute লাগবে। ভালো institute পেতে হলে আজ পড়তে হবে।',
  'তোমার IoT project দেখিয়ে দিয়েছে তোমার মাথা কাজ করে। এখন কাজে লাগাও।',
  'বিদেশে inventor হতে চাও? আগে দেশের এই syllabus শেষ করো।',
  'তুমি কি তোমার family-র জন্য best হতে চাও? তাহলে এখনই উঠে পড়তে বসো।',
  'একটা chapter বাকি মানে admission-এ একটা ঝুঁকি বেশি।',
  'তোমার dream fulfill করতে চাও? Plan মানে আজকের পড়া।',
  'সফল inventors-রাও student ছিল। তারা পড়ালেখা skip করেনি।',
  'তোমার future bright করতে চাও? Brightness আসে preparation থেকে।',
  'যেদিন BUET-এ ঢুকবে, সেদিন মনে পড়বে আজকের এই মুহূর্তটার কথা।',
  'IoT, robotics, electronics — এসব নিয়ে কাজ করতে engineering degree লাগবে।',
  'তুমি কি চাও তোমার বাবার স্বপ্নের চেয়ে বড় স্বপ্ন পূরণ করতে? তাহলে পড়ো।',
  'কামলা হয়ে বিদেশ না গিয়ে, researcher হয়ে বিদেশ যাওয়ার সুযোগ এখনও আছে।',
  'Math ভয় লাগলে practice করো। Fear যায় না, কিন্তু skill ভয়কে হারায়।',
  'তুমি best inventor হতে চাও। Inventors শুধু idea দেয় না, কাজও করে।',
  'আজকের missed lecture = কালকের regret।',
  'তোমার passion তোমাকে এখানে এনেছে। Discipline তোমাকে BUET পর্যন্ত নিয়ে যাবে।',
  'Syllabus incomplete থাকলে confidence আসবে না। একটা chapter শেষ করো আজই।',
]

// Self-check prompts — shown as rhetorical questions before dismissal
const SELF_CHECKS = [
  { q: 'আমি কি loser নাকি winner?', loser: 'Loser — site বন্ধ করে ঘুমায়', winner: 'Winner — target পূরণ করেই বের হয়' },
  { q: 'আমি কি সত্যিই BUET চাই?', loser: 'না — শুধু ভাবি', winner: 'হ্যাঁ — তাই এখন পড়ব' },
  { q: 'আজকের target কি পূরণ হবে?', loser: 'না — পরে করব', winner: 'হ্যাঁ — আজই শেষ করব' },
]

const DEFAULT_HSC = '2026-04-02'

export function getDaysLeft(hscDate?: string): number {
  const target = new Date(`${hscDate ?? DEFAULT_HSC}T00:00:00`)
  const diff = target.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── BreakQuote (Timer break inline) ─────────────────────────────────────────
export function BreakQuote() {
  const [quote] = useState(() => getRandom(QUOTES))
  return (
    <div className="max-w-xs text-center px-4 mt-6">
      <div className="w-6 h-px bg-[#F59E0B]/40 mx-auto mb-3 rounded-full" />
      <p className="text-sm text-[#94A3B8] leading-relaxed italic">"{quote}"</p>
    </div>
  )
}

// ─── Entrance Modal ───────────────────────────────────────────────────────────
export default function EntranceModal() {
  const { userDoc } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [quote]    = useState(() => getRandom(QUOTES))
  const [check]    = useState(() => getRandom(SELF_CHECKS))
  const [picked, setPicked] = useState<'winner' | 'loser' | null>(null)

  const daysLeft = getDaysLeft(userDoc?.hscDate)

  const dismiss = useCallback(() => setDismissed(true), [])

  // Escape key — only after picking winner/loser
  useEffect(() => {
    if (!picked) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [picked, dismiss])

  if (dismissed) return null

  const urgentColor = daysLeft < 60 ? '#EF4444' : daysLeft < 120 ? '#F59E0B' : '#818CF8'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
      <div
        className="w-full max-w-sm bg-[#0D1117] border border-[#1E2A36] rounded-2xl overflow-hidden shadow-2xl"
        style={{ animation: 'fadeInScale 0.25s ease-out' }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${urgentColor}, transparent)` }} />

        <div className="p-6 space-y-5">

          {/* Days counter */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#475569] mb-1 font-medium">HSC পর্যন্ত বাকি</p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span
                className="text-6xl font-black tabular-nums leading-none"
                style={{ color: urgentColor, textShadow: `0 0 40px ${urgentColor}40` }}
              >
                {daysLeft}
              </span>
              <span className="text-2xl font-semibold text-[#475569]">দিন</span>
            </div>
            <p className="text-[11px] text-[#334155] mt-1">
              এর মধ্যে যা করবে, ৪০ বছর তার ফল ভোগ করবে।
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#1E2A36]" />

          {/* Self-check */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#E2E8F0] text-center">{check.q}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPicked('loser')}
                className={`py-3 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer leading-snug ${
                  picked === 'loser'
                    ? 'bg-[#EF4444]/15 border-[#EF4444]/50 text-[#FCA5A5]'
                    : 'border-[#1E2A36] text-[#64748B] hover:border-[#EF4444]/30 hover:text-[#EF4444]'
                }`}
              >
                😔 {check.loser}
              </button>
              <button
                onClick={() => setPicked('winner')}
                className={`py-3 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer leading-snug ${
                  picked === 'winner'
                    ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#86EFAC]'
                    : 'border-[#1E2A36] text-[#64748B] hover:border-[#22C55E]/30 hover:text-[#22C55E]'
                }`}
              >
                💪 {check.winner}
              </button>
            </div>
          </div>

          {/* Quote — fire/regret styled */}
          <div
            className="relative rounded-xl px-4 py-4 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1a0800 0%, #110a00 60%, #0D1117 100%)',
              border: '1px solid rgba(249,115,22,0.25)',
              boxShadow: '0 0 24px rgba(239,68,68,0.08), inset 0 0 32px rgba(239,68,68,0.03)',
            }}
          >
            {/* Pulsing left bar */}
            <div
              className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
              style={{
                background: 'linear-gradient(180deg, #EF4444, #F97316, #EF4444)',
                boxShadow: '0 0 10px #EF444480',
                animation: 'pulse 2.5s ease-in-out infinite',
              }}
            />
            <p
              className="pl-4 text-[14px] font-semibold leading-relaxed"
              style={{
                color: '#FED7AA',
                textShadow: '0 0 20px rgba(249,115,22,0.25)',
              }}
            >
              "{quote}"
            </p>
          </div>

          {/* CTA — only enabled after picking */}
          <button
            onClick={dismiss}
            disabled={!picked}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed ${
              picked === 'winner'
                ? 'bg-[#6366F1] hover:bg-[#5558E6] text-white shadow-lg shadow-indigo-900/40'
                : picked === 'loser'
                ? 'bg-[#1E2A36] text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#EF4444]/20'
                : 'bg-[#111820] text-[#334155] border border-[#1E2A36]'
            }`}
          >
            {!picked
              ? 'উত্তর দাও, তারপর ঢোকো →'
              : picked === 'winner'
              ? 'আমি winner — এখন শুরু করি →'
              : 'তবুও ঢুকছি — কিন্তু আজ target পূরণ করব'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px #EF444480; }
          50%       { opacity: 0.5; box-shadow: 0 0 4px #EF444430; }
        }
      `}</style>
    </div>
  )
}
