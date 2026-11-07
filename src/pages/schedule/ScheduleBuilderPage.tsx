/**
 * ScheduleBuilderPage.tsx — /schedule/create
 *
 * Multi-step schedule creation interface.
 * Sleek, modern, and compact layout for mobile, tablet, and desktop screens.
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
  AlertTriangle, CheckCircle2, ChevronRight,
  Coffee, SlidersHorizontal, Play, Zap, Check, Sparkles, Gauge
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

// ── Playback Speed Options ──────────────────────────────────────────
const SPEED_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 1.75, label: '1.75x' },
  { value: 2, label: '2x' },
]

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

// ── Step Indicator Component (Compact & Modern) ───────────────────────
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                s.n < step
                  ? 'bg-[#22C55E] text-white shadow-sm'
                  : s.n === step
                  ? 'bg-[#6366F1] text-white ring-2 ring-[#6366F1]/30 shadow-sm'
                  : 'bg-[#1E2A36] text-[#64748B]'
              }`}
            >
              {s.n < step ? <CheckCircle2 size={15} /> : s.n}
            </div>
            <span
              className={`text-xs font-semibold ${
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
              className={`h-0.5 w-3 sm:w-8 mx-1.5 sm:mx-2.5 rounded-full transition-all ${
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
  const [, setReliableNowMs] = useState(Date.now())

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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)

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
  const effectiveWallDurationSecs = Math.round(scheduledDurationSeconds / playbackSpeed)
  const breakInfo = selectedLecture
    ? calculateScheduleBreakInfo(scheduledDurationSeconds, 0, playbackSpeed)
    : null
  const totalScheduledDurationSecs = getTotalScheduledDuration(scheduledDurationSeconds, playbackSpeed)
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
        return 'শেষ টাইমস্ট্যাম্প অবশ্যই শুরুর চেয়ে বেশি হতে হবে।'
      if (customRangeEnd > selectedLecture.duration)
        return 'শেষ টাইমস্ট্যাম্প মূল ভিডিওর দৈর্ঘ্যের চেয়ে বেশি হতে পারবে না।'
      if (customRangeEnd - customRangeStart < 60)
        return 'ক্লাস কমপক্ষে ১ মিনিট হতে হবে।'
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
        playbackSpeed,
      }
      const scheduleId = await createDraftSchedule(user.uid, draftInput)
      await lockSchedule(user.uid, scheduleId, getReliableTime())
      setLockSuccess(true)
      setShowLockConfirm(false)
      setTimeout(() => navigate(ROUTES.SCHEDULE), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('quota') || msg.includes('429') || msg.toLowerCase().includes('resource_exhausted')) {
        setLockError(
          'Firebase-এর আজকের দৈনিক রিড লিমিট সাময়িকভাবে শেষ হয়েছে (প্রতিদিন দুপুর ১:০০-২:০০ টার মধ্যে স্বয়ংক্রিয় রিসেট হয়)। কোটা রিসেট হওয়ার পর শিডিউল লক করুন।'
        )
      } else {
        setLockError(msg || 'Lock করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।')
      }
    } finally {
      setIsLocking(false)
    }
  }, [
    user, selectedLecture, scheduledDate, scheduledStartTime,
    isCustomRange, customRangeStart, customRangeEnd,
    scheduledDurationSeconds, scheduledDurationFormatted, playbackSpeed, navigate,
  ])

  // ── Success screen ────────────────────────────────────────────────────
  if (lockSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 animate-fade-in max-w-md mx-auto p-6">
        <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/40 flex items-center justify-center shadow-lg">
          <CheckCircle2 size={36} className="text-[#22C55E]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-[#F8FAFC]">Schedule Lock সম্পন্ন!</h2>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            <span className="font-semibold text-white">"{selectedLecture?.title}"</span> নির্ধারিত সময়ে সফলভাবে Locked হয়েছে।
          </p>
        </div>
        <p className="text-xs text-[#64748B]">Schedule Page-এ নিয়ে যাওয়া হচ্ছে…</p>
      </div>
    )
  }

  // ── Main Render: Compact & Proportioned ───────────────────────────────
  return (
    <div className="animate-fade-in max-w-4xl mx-auto w-full px-3 sm:px-6 space-y-4 sm:space-y-5 pb-16">

      {/* ── Top Header & Step Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2A36]">
        <div className="flex items-center gap-2.5">
          <Link
            to={ROUTES.SCHEDULE}
            className="p-1.5 sm:p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E2A36] border border-[#1E2A36] transition-colors shrink-0"
            title="ফিরে যান"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#F8FAFC] tracking-tight">
              Live Schedule তৈরি
            </h1>
            <p className="text-[11px] sm:text-xs text-[#94A3B8]">
              {step === 1
                ? 'লেকচার নির্বাচন'
                : step === 2
                ? 'তারিখ ও সময় নির্ধারণ'
                : 'যাচাই ও লক'}
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
        <div className="space-y-3.5 sm:space-y-4">

          {/* 1. Subject selector chips */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-[10px] font-bold flex items-center justify-center">১</span>
              <p className="text-xs sm:text-sm font-semibold text-[#CBD5E1]">
                বিষয়
              </p>
            </div>

            {isLoadingSubjects ? (
              <div className="h-9 skeleton rounded-xl w-full" />
            ) : subjects.length === 0 ? (
              <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 text-center">
                <p className="text-xs text-[#64748B]">কোনো বিষয় পাওয়া যায়নি।</p>
                <Link to={ROUTES.SUBJECTS} className="text-xs text-[#818CF8] hover:underline mt-1 inline-block">
                  নতুন বিষয় তৈরি করুন →
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {subjects.map((s) => {
                  const isSelected = selectedSubject?.id === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#6366F1]/20 border-[#6366F1] text-white shadow-sm ring-1 ring-[#6366F1]/40'
                          : 'bg-[#111820] border-[#1E2A36] text-[#94A3B8] hover:border-[#334155] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span className="text-sm">{s.icon}</span>
                      <span>{s.name}</span>
                      {isSelected && (
                        <Check size={13} className="text-[#818CF8] ml-0.5 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 2. Lecture selection list */}
          {selectedSubject && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#6366F1]/20 text-[#818CF8] text-[10px] font-bold flex items-center justify-center">২</span>
                  <p className="text-xs sm:text-sm font-semibold text-[#CBD5E1]">
                    লেকচার ({filteredLectures.length})
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder="খুঁজুন…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl pl-8 pr-3 py-1.5 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#6366F1] transition-all"
                  />
                </div>
              </div>

              {isLoadingLectures ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
                </div>
              ) : filteredLectures.length === 0 ? (
                <div className="text-center py-10 text-[#64748B] text-xs sm:text-sm border border-dashed border-[#1E2A36] rounded-xl bg-[#0D1117]">
                  {lectures.length === 0
                    ? 'এই বিষয়ে কোনো লেকচার নেই।'
                    : 'আপনার অনুসন্ধানের সাথে কোনো লেকচার মেলেনি।'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {filteredLectures.map((l) => {
                    const isSelected = selectedLecture?.id === l.id
                    return (
                      <div
                        key={l.id}
                        onClick={() => {
                          if (selectedLecture?.id === l.id) {
                            setError(null)
                            setStep(2)
                          } else {
                            handleSelectLecture(l)
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer group ${
                          isSelected
                            ? 'bg-[#6366F1]/10 border-[#6366F1] shadow-md ring-1 ring-[#6366F1]/40'
                            : 'bg-[#111820] border-[#1E2A36] hover:border-[#334155] hover:bg-[#131D28]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                          {/* Compact Thumbnail (16:9) */}
                          <div className="relative shrink-0 w-20 h-13 sm:w-28 sm:h-18 rounded-lg overflow-hidden bg-[#17202A] shadow-sm">
                            <img
                              src={getThumbnailUrl(l.youtubeVideoId, 'medium')}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.2 rounded text-[9px] font-mono font-bold text-white shadow">
                              {l.durationFormatted}
                            </div>
                            {isSelected && (
                              <div className="absolute inset-0 bg-[#6366F1]/30 backdrop-blur-[1px] flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-white drop-shadow" />
                              </div>
                            )}
                          </div>

                          {/* Title and metadata */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className={`text-xs sm:text-sm font-semibold leading-tight line-clamp-1 transition-colors ${
                              isSelected ? 'text-[#A5B4FC]' : 'text-[#F8FAFC] group-hover:text-white'
                            }`}>
                              {l.title}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] truncate">
                              <span className="truncate">{l.chapterName}</span>
                              {l.timestamps && l.timestamps.length > 0 && (
                                <>
                                  <span className="text-[#334155] shrink-0">·</span>
                                  <span className="text-[#818CF8] shrink-0">
                                    {l.timestamps.length} টপিক
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Selection Action Button (Instant advance on click) */}
                        <div className="shrink-0 flex items-center pl-2">
                          {isSelected ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setError(null)
                                setStep(2)
                              }}
                              className="flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg shadow-sm transition-all cursor-pointer"
                              title="সময় নির্ধারণ ধাপে এগিয়ে যান"
                            >
                              <Check size={13} />
                              <span>নির্বাচিত</span>
                              <span className="hidden sm:inline-flex items-center text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">
                                এগিয়ে যান →
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectLecture(l)
                              }}
                              className="text-xs font-medium text-[#94A3B8] hover:text-white bg-[#1E2A36]/80 hover:bg-[#2A3B4D] border border-[#2A3B4D] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                            >
                              নির্বাচন করুন
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Docked Sticky Bottom Bar when Lecture is Selected */}
          {selectedLecture && (
            <div className="sticky bottom-4 z-20 bg-[#111820]/95 backdrop-blur-md border border-[#6366F1]/40 rounded-xl p-2.5 sm:p-3 shadow-xl flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={getThumbnailUrl(selectedLecture.youtubeVideoId, 'medium')}
                  alt=""
                  className="w-14 h-9 sm:w-16 sm:h-10 object-cover rounded-lg bg-[#17202A] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">
                    {selectedLecture.title}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {selectedLecture.subjectName} · {fmtSecs(selectedLecture.duration)}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => { setError(null); setStep(2) }}
                size="sm"
                className="px-3.5 py-1.5 text-xs sm:text-sm font-bold shrink-0 shadow-md"
                rightIcon={<ChevronRight size={14} />}
              >
                সময় নির্ধারণ →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STEP 2: Date, Time & Range Scope                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 2 && selectedLecture && (
        <div className="space-y-3.5 sm:space-y-4">

          {/* Selected Lecture Top Banner (Compact & Clean) */}
          <div className="flex items-center justify-between gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={getThumbnailUrl(selectedLecture.youtubeVideoId, 'medium')}
                alt=""
                className="w-16 h-10 sm:w-20 sm:h-12 object-cover rounded-lg bg-[#17202A] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-white truncate leading-snug">
                  {selectedLecture.title}
                </p>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  {selectedLecture.subjectName} · {selectedLecture.chapterName} · <span className="font-mono text-white">{fmtSecs(selectedLecture.duration)}</span>
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-[#818CF8] hover:text-white hover:bg-[#1E2A36] border border-[#1E2A36] px-2.5 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              পরিবর্তন
            </button>
          </div>

          {/* ── Scheduling Scope Options ── */}
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-bold text-[#F8FAFC] flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-[#818CF8]" />
              ক্লাস স্কোপ
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option A: Full Video */}
              <button
                type="button"
                onClick={() => setIsCustomRange(false)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  !isCustomRange
                    ? 'bg-[#6366F1]/10 border-[#6366F1] shadow-sm ring-1 ring-[#6366F1]/30'
                    : 'bg-[#111820] border-[#1E2A36] hover:border-[#334155] hover:bg-[#131D28]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#6366F1]/15 flex items-center justify-center text-[#818CF8]">
                      <Play size={12} className="fill-[#818CF8]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">সম্পূর্ণ ভিডিও</span>
                  </div>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      !isCustomRange ? 'border-[#6366F1] bg-[#6366F1]' : 'border-[#475569]'
                    }`}
                  >
                    {!isCustomRange && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  পুরো লেকচার লাইভ হিসেবে চলবে
                </p>
              </button>

              {/* Option B: Custom Timestamp Range */}
              <button
                type="button"
                onClick={() => setIsCustomRange(true)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isCustomRange
                    ? 'bg-[#6366F1]/10 border-[#6366F1] shadow-sm ring-1 ring-[#6366F1]/30'
                    : 'bg-[#111820] border-[#1E2A36] hover:border-[#334155] hover:bg-[#131D28]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#6366F1]/15 flex items-center justify-center text-[#818CF8]">
                      <Zap size={12} className="fill-[#818CF8]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">কাস্টম রেঞ্জ</span>
                  </div>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isCustomRange ? 'border-[#6366F1] bg-[#6366F1]' : 'border-[#475569]'
                    }`}
                  >
                    {isCustomRange && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  নির্দিষ্ট অংশ লাইভ হিসেবে চলবে
                </p>
              </button>
            </div>
          </div>

          {/* ── Option B: Custom Timestamp Selectors Panel ── */}
          {isCustomRange && (
            <div className="bg-[#0D1520] border border-[#1E2A36] rounded-xl p-3 space-y-3 animate-fade-in shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {/* 1. Start Timestamp */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#CBD5E1]">
                      শুরুর সময়
                    </label>
                    <span className="font-mono font-bold text-[#818CF8]">
                      {formatSecondsToTimestampString(customRangeStart)}
                    </span>
                  </div>

                  {selectedLecture.timestamps && selectedLecture.timestamps.length > 0 && (
                    <select
                      value={customRangeStart}
                      onChange={(e) => handleStartDropdownChange(Number(e.target.value))}
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-lg px-2.5 py-1.5 text-xs text-[#CBD5E1] focus:outline-none focus:border-[#6366F1] cursor-pointer"
                    >
                      <option value={0}>00:00:00 — শুরু</option>
                      {[...(selectedLecture.timestamps)]
                        .sort((a, b) => a.time - b.time)
                        .map((t, idx) => (
                          <option key={idx} value={t.time}>
                            {formatSecondsToTimestampString(t.time)} — {t.label}
                          </option>
                        ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={customStartInput}
                    onChange={(e) => handleStartInputChange(e.target.value)}
                    onBlur={handleStartInputBlur}
                    placeholder="00:00:00"
                    className="w-full bg-[#080C10] border border-[#1E2A36] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                {/* 2. End Timestamp */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-[#CBD5E1]">
                      শেষ সময়
                    </label>
                    <span className="font-mono font-bold text-[#818CF8]">
                      {formatSecondsToTimestampString(customRangeEnd)}
                    </span>
                  </div>

                  {selectedLecture.timestamps && selectedLecture.timestamps.length > 0 && (
                    <select
                      value={customRangeEnd}
                      onChange={(e) => handleEndDropdownChange(Number(e.target.value))}
                      className="w-full bg-[#080C10] border border-[#1E2A36] rounded-lg px-2.5 py-1.5 text-xs text-[#CBD5E1] focus:outline-none focus:border-[#6366F1] cursor-pointer"
                    >
                      {[...(selectedLecture.timestamps)]
                        .sort((a, b) => a.time - b.time)
                        .map((t, idx) => (
                          <option key={idx} value={t.time}>
                            {formatSecondsToTimestampString(t.time)} — {t.label}
                          </option>
                        ))}
                      <option value={selectedLecture.duration}>
                        {formatSecondsToTimestampString(selectedLecture.duration)} — শেষ
                      </option>
                    </select>
                  )}

                  <input
                    type="text"
                    value={customEndInput}
                    onChange={(e) => handleEndInputChange(e.target.value)}
                    onBlur={handleEndInputBlur}
                    placeholder="01:30:00"
                    className="w-full bg-[#080C10] border border-[#1E2A36] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>
              </div>

              {/* Calculated Range Summary Box */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                  customRangeEnd > customRangeStart
                    ? 'bg-[#052E16]/70 border-[#22C55E]/30 text-[#4ADE80]'
                    : 'bg-[#1A0A0A] border-[#EF4444]/30 text-[#F87171]'
                }`}
              >
                <div>
                  সেগমেন্ট:{' '}
                  <span className="font-mono font-bold text-white">
                    {formatSecondsToTimestampString(customRangeStart)} ➔ {formatSecondsToTimestampString(customRangeEnd)}
                  </span>
                </div>
                <div>
                  ব্যাপ্তি:{' '}
                  <span className="font-bold font-mono text-white">
                    {customRangeEnd > customRangeStart
                      ? fmtSecs(customRangeEnd - customRangeStart)
                      : 'অকার্যকর রেঞ্জ'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Playback Speed Selector (Compact 1-row) ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Gauge size={13} className="text-[#818CF8]" />
                প্লেব্যাক স্পিড
              </p>
              {playbackSpeed !== 1 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30">
                  ⚡ {playbackSpeed}x
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {SPEED_OPTIONS.map((opt) => {
                const isSelected = playbackSpeed === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlaybackSpeed(opt.value)}
                    className={`py-1.5 sm:py-2 px-1 rounded-lg border text-center transition-all cursor-pointer font-mono font-bold text-xs sm:text-sm ${
                      isSelected
                        ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#A5B4FC] shadow-sm ring-1 ring-[#6366F1]/40'
                        : 'bg-[#111820] border-[#1E2A36] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#334155]'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Date and Start Time Inputs ── */}
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm font-bold text-[#F8FAFC]">
              তারিখ ও সময়
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1">
                  <CalendarDays size={13} className="text-[#818CF8]" />
                  তারিখ
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1">
                  <Clock size={13} className="text-[#818CF8]" />
                  শুরুর সময়
                </label>
                <input
                  type="time"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  className="w-full bg-[#111820] border border-[#1E2A36] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* ── Schedule Preview Card (Compact) ── */}
          {startTimestamp && computedEndTimestamp && (
            <div className="bg-[#0B1628] border border-[#1E3A5F] rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between pb-1 border-b border-[#1E3A5F]/70">
                <p className="text-xs font-bold text-[#38BDF8] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} />
                  শিডিউল প্রিভিউ
                </p>
                <span className="text-[10px] text-[#94A3B8]">Asia/Dhaka</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#080E18] rounded-lg p-2 border border-[#1E3A5F]/40">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">তারিখ</p>
                  <p className="text-xs sm:text-sm font-bold text-white">{formatScheduleDate(startTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-lg p-2 border border-[#1E3A5F]/40">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">শুরু</p>
                  <p className="text-xs sm:text-sm font-bold text-[#22C55E]">{formatScheduleTime(startTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-lg p-2 border border-[#1E3A5F]/40">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">শেষ</p>
                  <p className="text-xs sm:text-sm font-bold text-[#38BDF8]">{formatScheduleTime(computedEndTimestamp)}</p>
                </div>

                <div className="bg-[#080E18] rounded-lg p-2 border border-[#1E3A5F]/40">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">ব্যাপ্তি</p>
                  <p className="text-xs sm:text-sm font-mono font-bold text-[#818CF8]">
                    {fmtSecs(effectiveWallDurationSecs)}
                  </p>
                </div>
              </div>

              {breakInfo?.hasBreaks && (
                <div className="flex items-center gap-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded-lg px-2.5 py-1.5 text-xs text-[#FBBF24]">
                  <Coffee size={13} className="shrink-0 text-[#F59E0B]" />
                  <span>
                    {breakInfo.totalBreaks}টি বিরতি (+{breakInfo.totalBreaks * 10} মিনিট) যুক্ত হয়েছে।
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 bg-[#1A0D0D] border border-[#EF4444]/40 rounded-xl p-3 text-xs text-[#F87171]">
              <AlertTriangle size={15} className="shrink-0 text-[#EF4444]" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <Button
              variant="secondary"
              onClick={() => setStep(1)}
              leftIcon={<ChevronLeft size={15} />}
              size="sm"
              className="px-4"
            >
              পেছনে
            </Button>
            <Button
              onClick={handleStep2Continue}
              className="flex-1 justify-center py-2.5 text-xs sm:text-sm font-bold shadow-md"
              size="sm"
              rightIcon={<ChevronRight size={15} />}
            >
              পরবর্তী ধাপ →
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* STEP 3: Final Lock Routine Confirmation                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {step === 3 && selectedLecture && startTimestamp && computedEndTimestamp && (
        <div className="space-y-4">

          {/* Hero Final Preview Card (Compact) */}
          <div className="rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#0B1628] shadow-xl">
            <div className="relative w-full h-32 sm:h-40 bg-[#17202A] overflow-hidden">
              <img
                src={selectedLecture.thumbnailUrl || getThumbnailUrl(selectedLecture.youtubeVideoId, 'high')}
                alt={selectedLecture.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1628] via-[#0B1628]/50 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#6366F1] text-white px-2 py-0.5 rounded shadow">
                  {selectedLecture.subjectName}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug drop-shadow line-clamp-1">
                  {selectedLecture.title}
                </h2>
                <p className="text-xs text-[#CBD5E1] drop-shadow">
                  {selectedLecture.chapterName}
                </p>
              </div>
            </div>

            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#080C10] rounded-lg p-2 border border-[#1E2A36]">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">তারিখ</p>
                  <p className="text-xs sm:text-sm font-bold text-white">{formatScheduleDate(startTimestamp)}</p>
                </div>

                <div className="bg-[#080C10] rounded-lg p-2 border border-[#1E2A36]">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">সময়</p>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {formatScheduleTimeRange(startTimestamp, computedEndTimestamp)}
                  </p>
                </div>

                <div className="bg-[#080C10] rounded-lg p-2 border border-[#1E2A36]">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">ব্যাপ্তি</p>
                  <p className="text-xs sm:text-sm font-bold font-mono text-[#818CF8]">
                    {fmtSecs(effectiveWallDurationSecs)}
                    {playbackSpeed !== 1 && (
                      <span className="text-[10px] text-[#38BDF8] ml-1 font-normal font-sans">
                        ({playbackSpeed}x)
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-[#080C10] rounded-lg p-2 border border-[#1E2A36]">
                  <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">মোড</p>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {isCustomRange ? 'কাস্টম রেঞ্জ' : 'সম্পূর্ণ লেকচার'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Warning Block */}
          <div className="flex items-start gap-2.5 bg-[#1A0F00] border border-[#F59E0B]/30 rounded-xl p-3 text-xs text-[#CBD5E1]">
            <AlertTriangle size={15} className="text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-bold text-[#FBBF24]">সতর্কতা:</span> একবার Lock সম্পন্ন হলে এই শিডিউল পরিবর্তন বা বাতিল করা যাবে না। ক্লাস শেষ না হওয়া পর্যন্ত এটি লাইব্রেরিতে লক থাকবে।
            </p>
          </div>

          {lockError && (
            <div className="flex items-center gap-2 bg-[#1A0D0D] border border-[#EF4444]/40 rounded-xl p-3 text-xs text-[#F87171]">
              <AlertTriangle size={15} className="shrink-0 text-[#EF4444]" />
              <span>{lockError}</span>
            </div>
          )}

          {/* Final Routine Activation Buttons */}
          <div className="flex items-center gap-2.5 pt-1">
            <Button
              variant="secondary"
              onClick={() => setStep(2)}
              leftIcon={<ChevronLeft size={15} />}
              size="sm"
              className="px-4"
            >
              পেছনে
            </Button>
            <button
              onClick={() => { setLockError(null); setShowLockConfirm(true) }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold py-2.5 sm:py-3 rounded-xl transition-all text-xs sm:text-sm cursor-pointer shadow-lg"
            >
              <Lock size={15} />
              LOCK ROUTINE চালু করুন
            </button>
          </div>
        </div>
      )}

      {/* ── Lock Confirmation Modal ── */}
      <Modal
        isOpen={showLockConfirm}
        onClose={() => !isLocking && setShowLockConfirm(false)}
        title="⚠️ শিডিউল লক নিশ্চিতকরণ"
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-[#E2E8F0] leading-relaxed">
            <span className="font-bold text-white">"{selectedLecture?.title}"</span>-এর
            শিডিউল কি স্থায়ীভাবে Lock করতে চান?
          </p>

          <div className="text-xs text-[#94A3B8] bg-[#0D1117] border border-[#1E2A36] rounded-xl p-2.5 space-y-1">
            <p>
              লক কার্যকর হলে নির্ধারিত সময় পর্যন্ত ক্লাস লাইভ থাকবে এবং এটি পরিবর্তনযোগ্য নয়।
            </p>
            {isCustomRange && (
              <p className="text-[#38BDF8] font-mono">
                সেগমেন্ট: {formatSecondsToTimestampString(customRangeStart)} ➔ {formatSecondsToTimestampString(customRangeEnd)}
              </p>
            )}
            {playbackSpeed !== 1 && (
              <p className="text-[#A5B4FC]">
                স্পিড: <span className="font-mono font-bold text-white">{playbackSpeed}x</span> ({fmtSecs(effectiveWallDurationSecs)})
              </p>
            )}
          </div>

          <div className="flex gap-2.5 pt-1">
            <Button
              variant="secondary"
              onClick={() => setShowLockConfirm(false)}
              disabled={isLocking}
              size="sm"
              className="flex-1 py-2"
            >
              বাতিল
            </Button>
            <button
              onClick={handleLockRoutine}
              disabled={isLocking}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded-xl transition-colors text-xs sm:text-sm cursor-pointer shadow-md"
            >
              {isLocking ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  লক হচ্ছে…
                </>
              ) : (
                <>
                  <Lock size={14} />
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
