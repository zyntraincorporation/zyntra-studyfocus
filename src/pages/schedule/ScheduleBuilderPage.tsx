/**
 * ScheduleBuilderPage.tsx — /schedule/create
 *
 * Multi-step schedule creation interface.
 * 1000% Responsive, generous modern layout for mobile, tablet, and desktop screens.
 * PRD Sections 5.1, 5.2, 5.3, 5.4
 *
 * Step 1: Select Lecture (from existing recorded library)
 * Step 2: Set Date & Time → Preview (auto-calculated end time)
 * Step 3: LOCK ROUTINE confirmation → atomic lock execution
 */

import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Search, Clock, CalendarDays, Lock,
  AlertTriangle, CheckCircle2, ChevronRight, X,
  Coffee, SlidersHorizontal, Play, Zap, Check, Sparkles
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getSubjects, getLecturesBySubject } from '@/services/curriculum.service'
import { createDraftSchedule, lockSchedule } from '@/services/schedule.service'
import { initClockSync, getReliableTime } from '@/services/serverTime.service'
import type { Subject, Lecture } from '@/types/curriculum.types'
import type { ScheduledClassDraftInput } from '@/types/schedule.types'
import { getThumbnailUrl } from '@/utils/youtube.utils'
import { formatDuration } from '@/utils/time.utils'
import {
  scheduledDateTimeToTimestamp,
  formatScheduleDate,
  formatScheduleTime,
  formatScheduleTimeRange,
  calculateScheduleBreakInfo,
  getTotalScheduledDuration,
  parseTimestampStringToSeconds,
  formatSecondsToTimestampString,
} from '@/utils/schedule.utils'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Timestamp } from 'firebase/firestore'

// ── Types ─────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3

// ── Local helpers ─────────────────────────────────────────────────────

function getTomorrowDateKey(): string {
  const tomorrow = new Date(Date.now() + 86400000)
  return tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

function getDefaultStartTime(): string {
  const d = new Date(Date.now() + 30 * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

// ── Step Indicator Component (Responsive & Prominent) ─────────────────
function StepBar({ step }: { step: Step }) {
  const steps = [
    { n: 1 as Step, label: '১. লেকচার' },
    { n: 2 as Step, label: '২. সময়' },
    { n: 3 as Step, label: '৩. লক' },
  ]
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-black transition-all ${
                s.n < step
                  ? 'bg-[#22C55E] text-white shadow-sm'
                  : s.n === step
                  ? 'bg-[#6366F1] text-white ring-4 ring-[#6366F1]/20 shadow-md'
                  : 'bg-[#1E2A36] text-[#64748B]'
              }`}
            >
              {s.n < step ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span
              className={`hidden sm:inline text-xs sm:text-sm font-bold ${
                s.n === step
                  ? 'text-[#F8FAFC]'
                  : s.n < step
                  ? 'text-[#22C55E]'
                  : 'text-[#64748B]'
              }`}
            >
              {s.label}
            </span>
          </div>

          {i < steps.length - 1 && (
            <div
              className={`h-0.5 sm:h-1 w-6 sm:w-14 mx-1.5 sm:mx-3 rounded-full transition-all ${
                s.n < step ? 'bg-[#22C55E]' : 'bg-[#1E2A36]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export default function ScheduleBuilderPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [reliableNowMs, setReliableNowMs] = useState(Date.now())

  // Step 1: Lecture selection state
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true)
  const [isLoadingLectures, setIsLoadingLectures] = useState(false)

  // Step 2: Date, Time & Range state
  const [scheduledDate, setScheduledDate] = useState(getTomorrowDateKey())
  const [scheduledStartTime, setScheduledStartTime] = useState(getDefaultStartTime())
  const [isCustomRange, setIsCustomRange] = useState(false)
  const [customRangeStart, setCustomRangeStart] = useState(0)
  const [customRangeEnd, setCustomRangeEnd] = useState(0)
  const [customStartInput, setCustomStartInput] = useState('00:00:00')
  const [customEndInput, setCustomEndInput] = useState('00:00:00')

  // Step 3: Lock state
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)
  const [lockSuccess, setLockSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────
  const handleSelectLecture = useCallback((lec: Lecture) => {
    setSelectedLecture(lec)
    setIsCustomRange(false)
    setCustomRangeStart(0)
    setCustomStartInput('00:00:00')
    setCustomRangeEnd(lec.duration)
    setCustomEndInput(formatSecondsToTimestampString(lec.duration))
  }, [])

  const handleStartInputChange = (val: string) => {
    setCustomStartInput(val)
    setCustomRangeStart(parseTimestampStringToSeconds(val))
  }
  const handleStartInputBlur = () => {
    const maxDur = selectedLecture?.duration ?? 0
    const clamped = Math.max(0, Math.min(parseTimestampStringToSeconds(customStartInput), maxDur))
    setCustomRangeStart(clamped)
    setCustomStartInput(formatSecondsToTimestampString(clamped))
  }
  const handleEndInputChange = (val: string) => {
    setCustomEndInput(val)
    setCustomRangeEnd(parseTimestampStringToSeconds(val))
  }
  const handleEndInputBlur = () => {
    const maxDur = selectedLecture?.duration ?? 0
    const clamped = Math.max(0, Math.min(parseTimestampStringToSeconds(customEndInput), maxDur))
    setCustomRangeEnd(clamped)
    setCustomEndInput(formatSecondsToTimestampString(clamped))
  }
  const handleStartDropdownChange = (secs: number) => {
    setCustomRangeStart(secs)
    setCustomStartInput(formatSecondsToTimestampString(secs))
  }
  const handleEndDropdownChange = (secs: number) => {
    setCustomRangeEnd(secs)
    setCustomEndInput(formatSecondsToTimestampString(secs))
  }

  // ── Data loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    initClockSync().then(() => setReliableNowMs(getReliableTime()))
    getSubjects(user.uid).then((subs) => {
      setSubjects(subs)
      setIsLoadingSubjects(false)
      // Auto-select first subject if available
      if (subs.length > 0 && !selectedSubject) {
        setSelectedSubject(subs[0])
      }
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !selectedSubject) return
    setIsLoadingLectures(true)
    setLectures([])
    setSelectedLecture(null)
    getLecturesBySubject(user.uid, selectedSubject.id).then((lecs) => {
      const available = lecs.filter((l) => {
        if (!l.lockedUntil) return true
        return l.lockedUntil.toMillis() <= getReliableTime()
      })
      setLectures(available)
      setIsLoadingLectures(false)
    })
  }, [user, selectedSubject])

  const filteredLectures = lectures.filter(
    (l) =>
      !searchQuery ||
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.chapterName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Computed values ───────────────────────────────────────────────────
  const scheduledDurationSeconds = selectedLecture
    ? isCustomRange
      ? Math.max(0, customRangeEnd - customRangeStart)
      : selectedLecture.duration
    : 0

  const scheduledDurationFormatted = formatDuration(scheduledDurationSeconds)
  const breakInfo = selectedLecture
    ? calculateScheduleBreakInfo(scheduledDurationSeconds, 0)
    : null
  const totalScheduledDurationSecs = getTotalScheduledDuration(scheduledDurationSeconds)
  const startTimestamp = selectedLecture
    ? scheduledDateTimeToTimestamp(scheduledDate, scheduledStartTime)
    : null
  const computedEndTimestamp =
    selectedLecture && startTimestamp
      ? Timestamp.fromMillis(startTimestamp.toMillis() + totalScheduledDurationSecs * 1000)
      : null

  // ── Validation ────────────────────────────────────────────────────────
  const validateStep2 = useCallback((): string | null => {
    if (!selectedLecture) return 'কোনো লেকচার নির্বাচন করা হয়নি।'
    if (!scheduledDate || !scheduledStartTime) return 'তারিখ ও সময় দিন।'
    if (!startTimestamp) return 'সময় নির্ধারণে সমস্যা।'
    if (startTimestamp.toMillis() <= getReliableTime())
      return 'ক্লাসের শুরুর সময় ভবিষ্যতে হতে হবে।'
    if (isCustomRange) {
      if (customRangeStart < 0 || customRangeStart >= selectedLecture.duration)
        return 'শুরুর টাইমস্ট্যাম্প মূল ভিডিওর সময়সীমার মধ্যে হতে হবে।'
      if (customRangeEnd <= customRangeStart)
        return 'শেষ টাইমস্ট্যাম্প অবশ্যই শুরুর টাইমস্ট্যাম্পের চেয়ে বেশি হতে হবে।'
      if (customRangeEnd > selectedLecture.duration)
        return 'শেষ টাইমস্ট্যাম্প মূল ভিডিওর দৈর্ঘ্যের চেয়ে বেশি হতে পারবে না।'
      if (customRangeEnd - customRangeStart < 60)
        return 'ক্লাসের নির্ধারিত সময়কাল কমপক্ষে ১ মিনিট হতে হবে।'
    }
    return null
  }, [selectedLecture, scheduledDate, scheduledStartTime, startTimestamp, isCustomRange, customRangeStart, customRangeEnd])

  const handleStep2Continue = useCallback(() => {
    const err = validateStep2()
    if (err) { setError(err); return }
    setError(null)
    setStep(3)
  }, [validateStep2])

  // ── Lock Routine ──────────────────────────────────────────────────────
  const handleLockRoutine = useCallback(async () => {
    if (!user || !selectedLecture) return
    setIsLocking(true)
    setLockError(null)
    try {
      const draftInput: ScheduledClassDraftInput = {
        lectureId: selectedLecture.id,
        title: selectedLecture.title,
        subjectId: selectedLecture.subjectId,
        subjectName: selectedLecture.subjectName,
        chapterId: selectedLecture.chapterId,
        chapterName: selectedLecture.chapterName,
        youtubeVideoId: selectedLecture.youtubeVideoId,
        thumbnailUrl:
          selectedLecture.thumbnailUrl ||
          getThumbnailUrl(selectedLecture.youtubeVideoId, 'medium'),
        durationSeconds: scheduledDurationSeconds,
        durationFormatted: scheduledDurationFormatted,
        scheduledDate,
        scheduledStartTime,
        isCustomRange,
        rangeStartSeconds: isCustomRange ? customRangeStart : 0,
        rangeEndSeconds: isCustomRange ? customRangeEnd : selectedLecture.duration,
        originalVideoDuration: selectedLecture.duration,
      }
      const scheduleId = await createDraftSchedule(user.uid, draftInput)
      await lockSchedule(user.uid, scheduleId, getReliableTime())
      setLockSuccess(true)
      setShowLockConfirm(false)
      setTimeout(() => navigate(ROUTES.SCHEDULE), 1500)
    } catch (err: unknown) {
      setLockError(
        err instanceof Error ? err.message : 'Lock করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      )
    } finally {
      setIsLocking(false)
    }
  }, [
    user, selectedLecture, scheduledDate, scheduledStartTime,
    isCustomRange, customRangeStart, customRangeEnd,
    scheduledDurationSeconds, scheduledDurationFormatted, navigate,
  ])

  // ── Success screen ────────────────────────────────────────────────────
  if (lockSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5 animate-fade-in max-w-lg mx-auto p-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#22C55E]/15 border-2 border-[#22C55E]/40 flex items-center justify-center shadow-lg">
          <CheckCircle2 size={44} className="text-[#22C55E]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-[#F8FAFC]">Schedule Lock সম্পন্ন!</h2>
          <p className="text-sm sm:text-base text-[#94A3B8]">
            <span className="font-semibold text-white">"{selectedLecture?.title}"</span> নির্ধারিত সময়ে সফলভাবে Locked হয়েছে।
          </p>
        </div>
        <p className="text-xs text-[#64748B]">Schedule Page-এ নিয়ে যাওয়া হচ্ছে…</p>
      </div>
    )
  }

  // ── Main Render: Full Responsive Container ───────────────────────────
  return (
    <div className="animate-fade-in max-w-5xl mx-auto w-full px-2 sm:px-6 space-y-6 sm:space-y-8 pb-12">

      {/* ── Top Header & Step Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2A36]/80">
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.SCHEDULE}
            className="p-2 sm:p-2.5 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] border border-[#1E2A36] transition-colors shrink-0"
            title="ফিরে যান"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
              নতুন Live Schedule তৈরি
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
              {step === 1
                ? 'যে লেকচারটি লাইভ শিডিউল করতে চান তা নির্বাচন করুন'
                : step === 2
                ? 'লাইভ ক্লাস শুরুর তারিখ, সময় ও সেগমেন্ট রেঞ্জ নির্ধারণ করুন'
                : 'সকল তথ্য যাচাই করে ফাইনাল LOCK ROUTINE কার্যকর করুন'}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="self-start sm:self-center">
          <StepBar step={step} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STEP 1: Lecture Selection                                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-6 sm:space-y-8">

          {/* 1. Subject selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">১</span>
              <p className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                Subject নির্বাচন করুন
              </p>
            </div>

            {isLoadingSubjects ? (
              <div className="h-12 skeleton rounded-2xl w-full" />
            ) : subjects.length === 0 ? (
              <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-6 text-center">
                <p className="text-sm sm:text-base text-[#64748B]">কোনো Subject পাওয়া যায়নি।</p>
                <Link to={ROUTES.SUBJECTS} className="text-xs sm:text-sm text-[#818CF8] hover:underline mt-2 inline-block">
                  নতুন Subject তৈরি করুন →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {subjects.map((s) => {
                  const isSelected = selectedSubject?.id === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s)}
                      className={`flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#6366F1]/20 border-[#6366F1] text-white shadow-md ring-2 ring-[#6366F1]/30'
                          : 'bg-[#111820] border-[#1E2A36] text-[#94A3B8] hover:border-[#334155] hover:text-[#F8FAFC] hover:bg-[#15202B]'
                      }`}
                    >
                      <span className="text-base sm:text-lg">{s.icon}</span>
                      <span>{s.name}</span>
                      {isSelected && (
                        <Check size={14} className="text-[#818CF8] ml-1 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 2. Lecture selection list */}
          {selectedSubject && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-xs font-bold flex items-center justify-center">২</span>
                  <p className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                    Lecture নির্বাচন করুন ({filteredLectures.length}টি উপলব্ধ)
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="লেকচার বা অধ্যায় খুঁজুন…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {isLoadingLectures ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
                </div>
              ) : filteredLectures.length === 0 ? (
                <div className="text-center py-16 text-[#64748B] text-sm sm:text-base border border-dashed border-[#1E2A36] rounded-2xl bg-[#0D1117]">
                  {lectures.length === 0
                    ? 'এই Subject-এ কোনো Available বা আনলকড Lecture নেই।'
                    : 'আপনার অনুসন্ধানের সাথে কোনো লেকচার মেলেনি।'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredLectures.map((l) => {
                    const isSelected = selectedLecture?.id === l.id
                    return (
                      <button
                        key={l.id}
                        onClick={() => handleSelectLecture(l)}
                        className={`w-full flex items-center gap-3.5 sm:gap-5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer group ${
                          isSelected
                            ? 'bg-[#6366F1]/12 border-[#6366F1] shadow-lg ring-1 ring-[#6366F1]/50'
                            : 'bg-[#111820] border-[#1E2A36] hover:border-[#38485C] hover:bg-[#131D28]'
                        }`}
                      >
                        {/* Thumbnail with duration badge */}
                        <div className="relative shrink-0 w-28 h-18 sm:w-44 sm:h-24 rounded-xl overflow-hidden bg-[#17202A] shadow-md">
                          <img
                            src={getThumbnailUrl(l.youtubeVideoId, 'medium')}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-mono font-bold text-white shadow">
                            {l.durationFormatted}
                          </div>
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#6366F1]/40 backdrop-blur-[1px] flex items-center justify-center">
                              <CheckCircle2 size={24} className="text-white drop-shadow" />
                            </div>
                          )}
                        </div>

                        {/* Title and metadata */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className={`text-sm sm:text-base font-bold leading-snug line-clamp-2 transition-colors ${
                            isSelected ? 'text-[#A5B4FC]' : 'text-[#F8FAFC] group-hover:text-white'
                          }`}>
                            {l.title}
                          </p>
                          <p className="text-xs sm:text-sm text-[#94A3B8] truncate">
                            {l.chapterName}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="text-[11px] text-[#64748B] font-mono">
                              মূল ভিডিও: {l.durationFormatted}
                            </span>
                            {l.timestamps && l.timestamps.length > 0 && (
                              <span className="text-[10px] sm:text-[11px] font-semibold text-[#818CF8] bg-[#6366F1]/10 px-2 py-0.5 rounded-full border border-[#6366F1]/20">
                                {l.timestamps.length}টি টপিক টাইমস্ট্যাম্প
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selection check on right */}
                        <div className="shrink-0 hidden sm:flex items-center">
                          {isSelected ? (
                            <div className="flex items-center gap-1.5 bg-[#6366F1] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-md">
                              <Check size={14} />
                              <span>নির্বাচিত</span>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-[#64748B] group-hover:text-white border border-transparent group-hover:border-[#2A3B4D] group-hover:bg-[#1E2A36] px-3.5 py-2 rounded-xl transition-all">
                              নির্বাচন করুন
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sticky/Floating Selected Lecture Action Bar */}
          {selectedLecture && (
            <div className="bg-[#111820] border-2 border-[#6366F1]/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={getThumbnailUrl(selectedLecture.youtubeVideoId, 'medium')}
                  alt=""
                  className="w-18 h-12 sm:w-24 sm:h-16 object-cover rounded-xl bg-[#17202A] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#818CF8]">
                    নির্বাচিত লেকচার
                  </span>
                  <p className="text-sm sm:text-base font-bold text-white truncate">
                    {selectedLecture.title}
                  </p>
                  <p className="text-xs sm:text-sm text-[#94A3B8]">
                    {selectedLecture.subjectName} · {fmtSecs(selectedLecture.duration)}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => { setError(null); setStep(2) }}
                size="lg"
                className="w-full sm:w-auto justify-center px-8 py-3 text-sm sm:text-base font-bold shrink-0 shadow-lg"
                rightIcon={<ChevronRight size={18} />}
              >
                পরবর্তী ধাপ — সময় নির্ধারণ
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STEP 2: Date, Time & Range Scope                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 2 && selectedLecture && (
        <div className="space-y-6 sm:space-y-8">

          {/* Selected Lecture Top Banner */}
          <div className="flex items-center justify-between gap-4 bg-[#111820] border border-[#1E2A36] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={getThumbnailUrl(selectedLecture.youtubeVideoId, 'medium')}
                alt=""
                className="w-20 h-13 sm:w-28 sm:h-18 object-cover rounded-xl bg-[#17202A] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs font-bold text-[#818CF8] uppercase tracking-wider">
                  লেকচার
                </span>
                <p className="text-sm sm:text-lg font-bold text-white truncate leading-snug">
                  {selectedLecture.title}
                </p>
                <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                  {selectedLecture.subjectName} · মূল ভিডিও ব্যাপ্তি: <span className="font-mono font-semibold text-white">{fmtSecs(selectedLecture.duration)}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs sm:text-sm font-semibold text-[#818CF8] hover:text-white hover:bg-[#1E2A36] border border-[#1E2A36] px-3.5 py-2 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              পরিবর্তন
            </button>
          </div>

          {/* ── Scheduling Scope Options ── */}
          <div className="space-y-3">
            <p className="text-sm sm:text-base font-bold text-[#F8FAFC] flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-[#818CF8]" />
              ক্লাস স্কোপ নির্বাচন (Scheduling Scope)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Full Video */}
              <button
                type="button"
                onClick={() => setIsCustomRange(false)}
                className={`p-5 sm:p-6 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  !isCustomRange
                    ? 'bg-[#6366F1]/12 border-[#6366F1] shadow-lg ring-2 ring-[#6366F1]/30'
                    : 'bg-[#111820] border-[#1E2A36] hover:border-[#38485C] hover:bg-[#131D28]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/15 flex items-center justify-center text-[#818CF8]">
                    <Play size={22} className="fill-[#818CF8]" />
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      !isCustomRange ? 'border-[#6366F1] bg-[#6366F1]' : 'border-[#475569]'
                    }`}
                  >
                    {!isCustomRange && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-white mb-1">
                  সম্পূর্ণ ভিডিও (ডিফল্ট)
                </p>
                <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                  পুরো লেকচারটি ({fmtSecs(selectedLecture.duration)}) শুরু থেকে শেষ পর্যন্ত লাইভ হিসেবে চলবে।
                </p>
              </button>

              {/* Option B: Custom Timestamp Range */}
              <button
                type="button"
                onClick={() => setIsCustomRange(true)}
                className={`p-5 sm:p-6 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  isCustomRange
                    ? 'bg-[#6366F1]/12 border-[#6366F1] shadow-lg ring-2 ring-[#6366F1]/30'
                    : 'bg-[#111820] border-[#1E2A36] hover:border-[#38485C] hover:bg-[#131D28]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/15 flex items-center justify-center text-[#818CF8]">
                    <Zap size={22} className="fill-[#818CF8]" />
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isCustomRange ? 'border-[#6366F1] bg-[#6366F1]' : 'border-[#475569]'
                    }`}
                  >
                    {isCustomRange && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-white mb-1">
                  কাস্টম টাইমস্ট্যাম্প রেঞ্জ
                </p>
                <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                  একটিমাত্র নির্দিষ্ট Start ও End সময় নির্বাচন করে নির্দিষ্ট অংশ লাইভ করুন।
                </p>
              </button>
            </div>
          </div>

          {/* ── Option B: Custom Timestamp Selectors Panel ── */}
          {isCustomRange && (
            <div className="bg-[#0D1520] border border-[#1E2A36] rounded-2xl p-5 sm:p-6 space-y-5 animate-fade-in shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E2A36]">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#818CF8]" />
                  <span className="text-sm sm:text-base font-bold text-white">
                    কাস্টম রেঞ্জ নির্বাচন (Start & End)
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-[#94A3B8] font-mono">
                  মূল ভিডিও দৈর্ঘ্য: {fmtSecs(selectedLecture.duration)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                {/* 1. Start Timestamp */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-[#CBD5E1]">
                      ১. শুরুর সময় (Start Timestamp)
                    </label>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#818CF8]">
                      {formatSecondsToTimestampString(customRangeStart)}
                    </span>
                  </div>

                  {/* Dropdown if lecture has topic timestamps */}
                  {selectedLecture.timestamps && selectedLecture.timestamps.length > 0 && (
                    <select
                      value={customRangeStart}
                      onChange={(e) => handleStartDropdownChange(Number(e.target.value))}
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#CBD5E1] focus:outline-none focus:border-[#6366F1] cursor-pointer"
                    >
                      <option value={0}>00:00:00 — ভিডিওর শুরু</option>
                      {[...(selectedLecture.timestamps)]
                        .sort((a, b) => a.time - b.time)
                        .map((t, idx) => (
                          <option key={idx} value={t.time}>
                            {formatSecondsToTimestampString(t.time)} — {t.label}
                          </option>
                        ))}
                    </select>
                  )}

                  {/* Manual Input */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={customStartInput}
                      onChange={(e) => handleStartInputChange(e.target.value)}
                      onBlur={handleStartInputBlur}
                      placeholder="00:00:00 (HH:MM:SS বা MM:SS)"
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-mono text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
                    />
                    <p className="text-[11px] text-[#64748B]">ম্যানুয়াল ইনপুট (যেমন 00:45:00)</p>
                  </div>
                </div>

                {/* 2. End Timestamp */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-[#CBD5E1]">
                      ২. শেষ সময় (End Timestamp)
                    </label>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#818CF8]">
                      {formatSecondsToTimestampString(customRangeEnd)}
                    </span>
                  </div>

                  {/* Dropdown if lecture has topic timestamps */}
                  {selectedLecture.timestamps && selectedLecture.timestamps.length > 0 && (
                    <select
                      value={customRangeEnd}
                      onChange={(e) => handleEndDropdownChange(Number(e.target.value))}
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#CBD5E1] focus:outline-none focus:border-[#6366F1] cursor-pointer"
                    >
                      {[...(selectedLecture.timestamps)]
                        .sort((a, b) => a.time - b.time)
                        .map((t, idx) => (
                          <option key={idx} value={t.time}>
                            {formatSecondsToTimestampString(t.time)} — {t.label}
                          </option>
                        ))}
                      <option value={selectedLecture.duration}>
                        {formatSecondsToTimestampString(selectedLecture.duration)} — ভিডিওর শেষ
                      </option>
                    </select>
                  )}

                  {/* Manual Input */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={customEndInput}
                      onChange={(e) => handleEndInputChange(e.target.value)}
                      onBlur={handleEndInputBlur}
                      placeholder="HH:MM:SS বা MM:SS"
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-mono text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
                    />
                    <p className="text-[11px] text-[#64748B]">ম্যানুয়াল ইনপুট (যেমন 01:30:00)</p>
                  </div>
                </div>
              </div>

              {/* Calculated Range Summary Box */}
              <div
                className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border text-xs sm:text-sm ${
                  customRangeEnd > customRangeStart
                    ? 'bg-[#052E16]/70 border-[#22C55E]/30 text-[#4ADE80]'
                    : 'bg-[#1A0A0A] border-[#EF4444]/30 text-[#F87171]'
                }`}
              >
                <div>
                  নির্বাচিত সেগমেন্ট:{' '}
                  <span className="font-mono font-bold text-white">
                    {formatSecondsToTimestampString(customRangeStart)}
                  </span>
                  {' '}➔{' '}
                  <span className="font-mono font-bold text-white">
                    {formatSecondsToTimestampString(customRangeEnd)}
                  </span>
                </div>
                <div>
                  নির্ধারিত লাইভ ব্যাপ্তি:{' '}
                  <span className="font-bold font-mono text-base">
                    {customRangeEnd > customRangeStart
                      ? fmtSecs(customRangeEnd - customRangeStart)
                      : 'অকার্যকর রেঞ্জ'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Date and Start Time Inputs ── */}
          <div className="space-y-3">
            <p className="text-sm sm:text-base font-bold text-[#F8FAFC]">
              লাইভ শুরুর তারিখ ও সময় (Asia/Dhaka)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-[#818CF8]" />
                  তারিখ
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-4 py-3 text-sm sm:text-base text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-[#94A3B8] flex items-center gap-1.5">
                  <Clock size={14} className="text-[#818CF8]" />
                  শুরুর সময় (24-hour)
                </label>
                <input
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-4 py-3 text-sm sm:text-base text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ── Schedule Preview Card ── */}
          {startTimestamp && computedEndTimestamp && (
            <div className="bg-[#0B1628] border-2 border-[#1E3A5F] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E3A5F]">
                <p className="text-xs sm:text-sm font-bold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} />
                  Schedule Summary Preview
                </p>
                <span className="text-xs text-[#94A3B8]">Asia/Dhaka</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#080E18] rounded-xl p-3 border border-[#1E3A5F]/50">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-0.5">তারিখ</p>
                  <p className="text-sm sm:text-base font-bold text-white">{formatScheduleDate(startTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-xl p-3 border border-[#1E3A5F]/50">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-0.5">শুরু</p>
                  <p className="text-sm sm:text-base font-bold text-[#22C55E]">{formatScheduleTime(startTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-xl p-3 border border-[#1E3A5F]/50">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-0.5">স্বয়ংক্রিয় শেষ</p>
                  <p className="text-sm sm:text-base font-bold text-[#38BDF8]">{formatScheduleTime(computedEndTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-xl p-3 border border-[#1E3A5F]/50">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-0.5">মোট ব্যাপ্তি</p>
                  <p className="text-sm sm:text-base font-mono font-bold text-[#818CF8]">
                    {fmtSecs(scheduledDurationSeconds)}
                  </p>
                </div>
              </div>

              {breakInfo?.hasBreaks && (
                <div className="flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#FBBF24]">
                  <Coffee size={16} className="shrink-0 text-[#F59E0B]" />
                  <span>
                    দীর্ঘ ক্লাসের জন্য {breakInfo.totalBreaks}টি বাধ্যতামূলক স্টাডি বিরতি (+{breakInfo.totalBreaks * 10} মিনিট) স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।
                  </span>
                </div>
              )}

              <p className="text-[11px] sm:text-xs text-[#64748B] pt-1">
                ⚠️ ক্লাসের শেষ সময় ভিডিও ব্যাপ্তি অনুযায়ী স্বয়ংক্রিয়ভাবে হিসাব করা। Lock করার পর এটি অপরিবর্তনযোগ্য।
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 bg-[#1A0D0D] border border-[#EF4444]/40 rounded-xl p-4 text-xs sm:text-sm text-[#F87171]">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444]" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setStep(1)}
              leftIcon={<ChevronLeft size={16} />}
              size="lg"
              className="px-6"
            >
              পেছনে
            </Button>
            <Button
              onClick={handleStep2Continue}
              className="flex-1 justify-center py-3.5 text-sm sm:text-base font-bold shadow-lg"
              size="lg"
              rightIcon={<ChevronRight size={18} />}
            >
              Preview ও Lock করুন
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STEP 3: Final Lock Routine Confirmation                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 3 && selectedLecture && startTimestamp && computedEndTimestamp && (
        <div className="space-y-6 sm:space-y-8">

          {/* Hero Final Preview Card */}
          <div className="rounded-3xl overflow-hidden border-2 border-[#1E3A5F] bg-[#0B1628] shadow-2xl">
            <div className="relative w-full h-48 sm:h-72 bg-[#17202A] overflow-hidden">
              <img
                src={selectedLecture.thumbnailUrl || getThumbnailUrl(selectedLecture.youtubeVideoId, 'high')}
                alt={selectedLecture.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1628] via-[#0B1628]/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-[#6366F1] text-white px-2.5 py-1 rounded-md shadow-md">
                  {selectedLecture.subjectName}
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-white mt-2 leading-snug drop-shadow">
                  {selectedLecture.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#CBD5E1] drop-shadow">
                  {selectedLecture.chapterName}
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#080C10] rounded-xl p-3.5 border border-[#1E2A36]">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-1">তারিখ</p>
                  <p className="text-sm sm:text-base font-bold text-white">{formatScheduleDate(startTimestamp)}</p>
                </div>

                <div className="bg-[#080C10] rounded-xl p-3.5 border border-[#1E2A36]">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-1">ক্লাসের সময়</p>
                  <p className="text-sm sm:text-base font-bold text-white">
                    {formatScheduleTimeRange(startTimestamp, computedEndTimestamp)}
                  </p>
                </div>

                <div className="bg-[#080C10] rounded-xl p-3.5 border border-[#1E2A36]">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-1">
                    {isCustomRange ? 'কাস্টম সেগমেন্ট' : 'সময়কাল'}
                  </p>
                  <p className="text-sm sm:text-base font-bold font-mono text-[#818CF8]">
                    {fmtSecs(scheduledDurationSeconds)}
                  </p>
                  {isCustomRange && (
                    <p className="text-[10px] text-[#38BDF8] mt-0.5 font-mono">
                      {formatSecondsToTimestampString(customRangeStart)} ➔ {formatSecondsToTimestampString(customRangeEnd)}
                    </p>
                  )}
                </div>

                <div className="bg-[#080C10] rounded-xl p-3.5 border border-[#1E2A36]">
                  <p className="text-[11px] text-[#64748B] uppercase tracking-wider mb-1">স্কোপ মোড</p>
                  <p className="text-sm sm:text-base font-bold text-white">
                    {isCustomRange ? 'কাস্টম রেঞ্জ' : 'সম্পূর্ণ লেকচার'}
                  </p>
                  {breakInfo?.hasBreaks && (
                    <p className="text-[10px] text-[#FBBF24] mt-0.5">
                      +{breakInfo.totalBreaks * 10} মিনিট বিরতি সহ
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Warning Block */}
          <div className="bg-[#1A0F00] border-2 border-[#F59E0B]/30 rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-[#F59E0B] shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-[#FBBF24]">Lock করার আগে নিশ্চিত হন</h3>
            </div>
            <ul className="text-xs sm:text-sm text-[#CBD5E1] space-y-2 pl-5 list-disc marker:text-[#F59E0B]">
              <li>একবার Lock সম্পন্ন হলে এই শিডিউল আর Edit, Delete বা Reschedule করা যাবে না।</li>
              <li>পড়ার শৃঙ্খলার স্বার্থে এই লেকচারটি লাইভ শেষ না হওয়া পর্যন্ত সাধারণ Recorded Library-তে অ্যাক্সেস লক থাকবে।</li>
              <li>ক্লাস শেষ হওয়ার মুহূর্তেই রেকর্ডেড প্লেয়ারের সম্পূর্ণ অংশ (সব টাইমস্ট্যাম্প, নোটস ও ফুল কন্ট্রোল সহ) স্বয়ংক্রিয়ভাবে Restore হয়ে যাবে।</li>
            </ul>
          </div>

          {lockError && (
            <div className="flex items-center gap-3 bg-[#1A0D0D] border border-[#EF4444]/40 rounded-xl p-4 text-xs sm:text-sm text-[#F87171]">
              <AlertTriangle size={18} className="shrink-0 text-[#EF4444]" />
              <span>{lockError}</span>
            </div>
          )}

          {/* Final Routine Activation Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setStep(2)}
              leftIcon={<ChevronLeft size={16} />}
              size="lg"
              className="px-6"
            >
              পেছনে
            </Button>
            <button
              onClick={() => { setLockError(null); setShowLockConfirm(true) }}
              className="flex-1 flex items-center justify-center gap-2.5 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold py-4 rounded-xl transition-all text-sm sm:text-base cursor-pointer shadow-xl"
            >
              <Lock size={18} />
              LOCK ROUTINE চালু করুন
            </button>
          </div>
        </div>
      )}

      {/* ── Lock Confirmation Modal ── */}
      <Modal
        isOpen={showLockConfirm}
        onClose={() => !isLocking && setShowLockConfirm(false)}
        title="⚠️ সর্বশেষ নিশ্চিতকরণ"
      >
        <div className="space-y-4">
          <p className="text-sm sm:text-base text-[#E2E8F0] leading-relaxed">
            আপনি কি নিশ্চিত যে{' '}
            <span className="font-bold text-white">"{selectedLecture?.title}"</span>-এর
            শিডিউল স্থায়ীভাবে Lock করতে চান?
          </p>

          <div className="text-xs sm:text-sm text-[#94A3B8] bg-[#0D1117] border border-[#1E2A36] rounded-xl p-4 space-y-2">
            <p>
              এই কাজটি <span className="text-[#EF4444] font-bold">স্থায়ী এবং অপরিবর্তনীয়।</span> Lock কার্যকর হলে নির্ধারিত সময় পর্যন্ত ক্লাস লাইভ থাকবে।
            </p>
            {isCustomRange && (
              <p className="text-[#38BDF8] font-mono">
                সেগমেন্ট: {formatSecondsToTimestampString(customRangeStart)} হতে {formatSecondsToTimestampString(customRangeEnd)} পর্যন্ত।
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowLockConfirm(false)}
              disabled={isLocking}
              className="flex-1 py-3"
            >
              বাতিল
            </Button>
            <button
              onClick={handleLockRoutine}
              disabled={isLocking}
              className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm sm:text-base cursor-pointer shadow-lg"
            >
              {isLocking ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  লক হচ্ছে…
                </>
              ) : (
                <>
                  <Lock size={16} />
                  হ্যাঁ, Lock করুন
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
