import { useState, useEffect, useCallback, useMemo } from 'react'
import { Coffee, Clock, RotateCcw, Play, CheckCircle2, AlertTriangle, Eye, ShieldAlert } from 'lucide-react'
import Button from '@/components/ui/Button'
import { QUOTES } from '@/components/ui/ExitQuoteModal'

interface BreakReminderModalProps {
  isVisible: boolean
  studiedMinutes: number
  onStartBreak(): void
  onSnooze(): void
  onDismiss(): void
  onResumeVideo?(): void
}

/**
 * Play a soothing, crystal clear 2-tone chime using Web Audio API.
 * 100% offline, zero asset dependencies.
 */
export function playChimeTone(type: 'alert' | 'complete' = 'alert') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    if (type === 'alert') {
      // 3 ascending gentle bell tones (E5, G#5, B5)
      const freqs = [659.25, 830.61, 987.77]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.16)
        gain.gain.setValueAtTime(0, now + idx * 0.16)
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.16 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.45)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.16)
        osc.stop(now + idx * 0.16 + 0.5)
      })
    } else {
      // 2 higher completion celebration tones (A5, C#6)
      const freqs = [880.00, 1108.73]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + idx * 0.2)
        gain.gain.setValueAtTime(0, now + idx * 0.2)
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.2 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + 0.55)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.2)
        osc.stop(now + idx * 0.2 + 0.6)
      })
    }
  } catch {
    // Browsers may block if audio context isn't allowed yet; ignore gracefully
  }
}

/**
 * BreakReminderModal — rendered inside video player container
 * Visible in normal & fullscreen mode.
 *
 * Reality check features:
 * - Direct reality reminder (BUET dream, electronics/IoT passion, avoiding distraction traps)
 * - 5-minute interactive guided break countdown
 * - Sound notification when break begins and ends
 */
export default function BreakReminderModal({
  isVisible,
  studiedMinutes,
  onStartBreak,
  onSnooze,
  onDismiss,
  onResumeVideo,
}: BreakReminderModalProps) {
  const [inActiveBreak, setInActiveBreak] = useState(false)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(300) // 5 minutes break
  const [quoteIndex, setQuoteIndex] = useState(0)

  // Pick a random reality check quote whenever the modal appears
  useEffect(() => {
    if (isVisible) {
      setQuoteIndex(Math.floor(Math.random() * QUOTES.length))
      setInActiveBreak(false)
      setBreakSecondsLeft(300)
    }
  }, [isVisible])

  // Active break countdown
  useEffect(() => {
    if (!isVisible || !inActiveBreak) return

    if (breakSecondsLeft <= 0) {
      playChimeTone('complete')
      return
    }

    const timer = setInterval(() => {
      setBreakSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [isVisible, inActiveBreak, breakSecondsLeft])

  const handleStart5mBreak = useCallback(() => {
    setInActiveBreak(true)
    setBreakSecondsLeft(300)
  }, [])

  const handleFinishBreak = useCallback(() => {
    setInActiveBreak(false)
    onStartBreak() // resets active seconds counter in hook
    if (onResumeVideo) {
      onResumeVideo()
    }
  }, [onStartBreak, onResumeVideo])

  if (!isVisible) return null

  const quote = QUOTES[quoteIndex] || 'তুমি বিশ্ব জয় করতে চাও। বিশ্ব জয় শুরু হয় এই মুহূর্ত থেকে।'
  const breakMinutes = Math.floor(breakSecondsLeft / 60)
  const breakSeconds = breakSecondsLeft % 60
  const breakComplete = breakSecondsLeft === 0

  return (
    <div
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Study Break Reminder"
    >
      <div className="bg-[#0D1117] border border-[#1E2A36] rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-md space-y-4 text-center">
        
        {!inActiveBreak ? (
          /* State 1: Break Announcement + Reality Check */
          <>
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
              <Clock size={13} />
              <span>টানা {studiedMinutes > 0 ? studiedMinutes : 50} মিনিট সক্রিয় পড়াশোনা</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#F8FAFC]">
                চোখ ও মস্তিষ্ককে ৫ মিনিট বিশ্রাম দাও
              </h2>
              <p className="text-xs text-[#94A3B8]">
                ভিডিও স্বয়ংক্রিয়ভাবে পজ করা হয়েছে। বার্নআউট এড়াতে স্বল্প বিরতি প্রয়োজন।
              </p>
            </div>

            {/* Reality check quote box */}
            <div
              className="relative text-left rounded-xl p-3.5 border border-[#F97316]/30 bg-[#160D08]"
              style={{ boxShadow: 'inset 0 0 20px rgba(249, 115, 22, 0.05)' }}
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-[#F97316] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#F97316]">
                    বাস্তবতার মুখোমুখি হও
                  </p>
                  <p className="text-xs sm:text-[13px] text-[#FED7AA] font-medium leading-relaxed">
                    "{quote}"
                  </p>
                </div>
              </div>
            </div>

            {/* Micro warning about break discipline */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#64748B] bg-[#111820] py-2 px-3 rounded-lg border border-[#1E2A36]">
              <Eye size={12} className="text-[#818CF8]" />
              <span>ব্রেক মানে রিলস দেখা নয় — পানি খাও, চোখ বন্ধ করো, হাত-পা স্ট্রেচ করো।</span>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <Button
                className="w-full bg-[#6366F1] hover:bg-[#5558E6] text-white py-2.5"
                onClick={handleStart5mBreak}
              >
                <Coffee size={15} />
                ৫ মিনিটের গাইডেড বিরতি শুরু করো
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onSnooze}
                >
                  <Clock size={13} />
                  আরও ৫ মিনিট পড়ব (Snooze)
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-[#94A3B8] hover:text-white"
                  onClick={onDismiss}
                >
                  চালিয়ে যাও (Dismiss)
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* State 2: Active 5-minute break timer */
          <>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
                <Coffee size={13} />
                <span>৫ মিনিট চোখ ও মাইন্ড রিল্যাক্সেশন</span>
              </div>

              {/* Countdown Display */}
              <div className="py-2">
                <span className="text-5xl font-extrabold tabular-nums tracking-tight text-[#F8FAFC]">
                  {String(breakMinutes).padStart(2, '0')}:{String(breakSeconds).padStart(2, '0')}
                </span>
                <p className="text-xs text-[#64748B] mt-1">
                  {breakComplete ? 'বিরতি সম্পন্ন হয়েছে!' : 'চোখ বন্ধ রাখো, গভীর শ্বাস নাও'}
                </p>
              </div>
            </div>

            {/* Reality guidance during break */}
            <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-3 text-xs text-[#94A3B8] space-y-1.5 text-left">
              <p className="font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-[#F59E0B]" />
                বিরতির ৩টি নিয়ম:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#94A3B8]">
                <li>ফোন স্ক্রিন বা সোশ্যাল মিডিয়া পুরোপুরি এড়িয়ে চলো।</li>
                <li>১ গ্লাস পানি পান করো।</li>
                <li>পরবর্তী লেকচারে কী শিখবে তা মনে মনে সাজাও।</li>
              </ul>
            </div>

            {/* Completion or Early Resume */}
            <div className="pt-2 space-y-2">
              <Button
                className={`w-full py-2.5 ${
                  breakComplete
                    ? 'bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-lg shadow-emerald-900/40'
                    : 'bg-[#6366F1] hover:bg-[#5558E6] text-white'
                }`}
                onClick={handleFinishBreak}
              >
                {breakComplete ? (
                  <>
                    <CheckCircle2 size={16} />
                    বিরতি শেষ — লেকচার আবার শুরু করো
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    এখনই বিরতি শেষ করে ভিডিও চালু করো
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setBreakSecondsLeft(300)}
                className="text-[11px] text-[#64748B] hover:text-[#94A3B8] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={11} /> ৫ মিনিট কাউন্টডাউন রিস্টার্ট করো
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
