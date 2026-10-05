import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, Plus, TrendingUp, ChevronRight,
  Calendar, Clock, Flame, BookOpen
} from 'lucide-react'
import { getSubjects, getLecture } from '@/services/curriculum.service'
import { getSessionsByDateRange, sumSessionSeconds } from '@/services/sessions.service'
import { calculateStreak, syncStreakWithFirestore } from '@/utils/streak.utils'
import { getLocalDateKey } from '@/utils/date.utils'
import type { Subject, Lecture } from '@/types/curriculum.types'
import type { StudySession } from '@/types/progress.types'
import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { formatDurationHuman, formatMinutesHuman } from '@/utils/time.utils'
import { SkeletonCard } from '@/components/ui/Skeleton'
import ProgressBar from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import { useProgressStats } from '@/hooks/useProgressStats'
import TodayTargetSection from '@/components/dashboard/TodayTargetSection'

const DEFAULT_HSC = '2026-04-02'

function getDaysLeft(hscDate?: string): number {
  const target = new Date(`${hscDate ?? DEFAULT_HSC}T00:00:00`)
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}



export default function DashboardPage() {
  const { user, userDoc, progressMap } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [lastWatchedLecture, setLastWatchedLecture] = useState<Lecture | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { getSubjectProgress } = useProgressStats()

  useEffect(() => {
    if (!user) return
    Promise.all([
      getSubjects(user.uid),
      getSessionsByDateRange(user.uid, 60),
    ]).then(([subs, sessList]) => {
      setSubjects(subs)
      setSessions(sessList)
      syncStreakWithFirestore(user.uid, userDoc, sessList)
    }).finally(() => setIsLoading(false))
  }, [user, userDoc])

  const todayKey = getLocalDateKey()
  const todaySessions = sessions.filter((s) => s.dateKey === todayKey)
  const todaySeconds = sumSessionSeconds(todaySessions)
  const goalMinutes = userDoc?.dailyGoalMinutes ?? 60
  const goalProgress = Math.min(Math.round((todaySeconds / 60 / goalMinutes) * 100), 100)
  const hscDate = userDoc?.hscDate ?? DEFAULT_HSC
  const daysLeft = useMemo(() => getDaysLeft(hscDate), [hscDate])
  const formattedHscDate = useMemo(() => {
    try {
      const d = new Date(`${hscDate}T00:00:00`)
      if (isNaN(d.getTime())) return hscDate
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return hscDate
    }
  }, [hscDate])

  const streakStats = calculateStreak(userDoc, sessions)

  const totalLectures = Object.keys(progressMap).length
  const completedLectures = Object.values(progressMap).filter((p) => p.completed).length

  // Last in-progress lecture
  const lastWatched = Object.values(progressMap)
    .filter((p) => !p.completed && p.currentPosition > 30)
    .sort((a, b) => {
      const aT = (a as any).lastWatchedAt?.toMillis?.() ?? 0
      const bT = (b as any).lastWatchedAt?.toMillis?.() ?? 0
      return bT - aT
    })[0]

  useEffect(() => {
    if (!user || !lastWatched?.lectureId) {
      setLastWatchedLecture(null)
      return
    }
    getLecture(user.uid, lastWatched.lectureId).then(setLastWatchedLecture)
  }, [user, lastWatched?.lectureId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-64 rounded" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Quick action if no subjects */}
      {subjects.length === 0 && (
        <div className="border border-[#1E2A36] rounded-xl p-6 text-center space-y-3">
          <p className="text-sm font-medium text-[#F8FAFC]">No subjects yet</p>
          <p className="text-xs text-[#64748B]">Add your subjects and chapters to start organizing your study plan.</p>
          <Link to={ROUTES.SUBJECTS}>
            <Button leftIcon={<Plus size={14} />}>Create First Subject</Button>
          </Link>
        </div>
      )}

      {/* Stat row */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatBox
            label="Days to HSC"
            icon={<Calendar size={13} className="text-[#F59E0B]" />}
            value={`${daysLeft}`}
            badge={
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                daysLeft <= 60
                  ? 'bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30'
                  : 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20'
              }`}>
                {daysLeft <= 60 ? 'ক্রিটিক্যাল' : 'কাউন্টডাউন'}
              </span>
            }
            sub={`লক্ষ্য: ${formattedHscDate}`}
            urgent={daysLeft < 30}
          />
          <StatBox
            label="Today's Study"
            icon={<Clock size={13} className="text-[#818CF8]" />}
            value={formatDurationHuman(todaySeconds)}
            badge={
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                goalProgress >= 100
                  ? 'bg-[#22C55E]/15 text-[#4ADE80] border border-[#22C55E]/30'
                  : todaySeconds === 0
                  ? 'bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30'
                  : 'bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30'
              }`}>
                {goalProgress >= 100 ? 'সম্পন্ন ✓' : todaySeconds === 0 ? '০%' : `${goalProgress}%`}
              </span>
            }
            sub={`টার্গেট: ${formatMinutesHuman(goalMinutes)} (${Math.max(0, goalMinutes - Math.floor(todaySeconds / 60))}m বাকি)`}
            accent={goalProgress >= 100 ? '#22C55E' : '#F8FAFC'}
          />
          <StatBox
            label="Study Streak"
            icon={<Flame size={13} className="text-[#F97316]" />}
            value={`${streakStats.currentStreak} দিন`}
            badge={
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                {streakStats.currentStreak > 0 ? '🔥 রানিং' : '০ দিন'}
              </span>
            }
            sub={`সর্বোচ্চ রেকর্ড: ${streakStats.longestStreak} দিন`}
            accent={streakStats.currentStreak > 0 ? '#FB923C' : '#F8FAFC'}
          />
          <StatBox
            label="Lectures"
            icon={<BookOpen size={13} className="text-[#38BDF8]" />}
            value={`${completedLectures} / ${totalLectures}`}
            badge={
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
                {totalLectures > 0 ? `${Math.round((completedLectures / totalLectures) * 100)}%` : '0%'}
              </span>
            }
            sub={`${totalLectures - completedLectures} লেকচার বাকি`}
            accent="#38BDF8"
          />
        </div>
      )}

      {/* Dedicated Today's Target Module */}
      {subjects.length > 0 && (
        <TodayTargetSection
          todaySeconds={todaySeconds}
          goalMinutes={goalMinutes}
          lastWatchedLecture={lastWatchedLecture}
        />
      )}

      {/* Continue learning */}
      {lastWatched && (
        <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-[#64748B] mb-3 font-medium">
            Resume
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#F8FAFC] truncate">
                {lastWatchedLecture?.title || lastWatched.lectureTitle || 'Continue Lecture'}
              </p>
              {(lastWatchedLecture?.subjectName || lastWatched.subjectName) && (
                <p className="text-xs text-[#64748B] mt-0.5 truncate">
                  {lastWatchedLecture?.subjectName || lastWatched.subjectName}
                  {(lastWatchedLecture?.chapterName || lastWatched.chapterName)
                    ? ` · ${lastWatchedLecture?.chapterName || lastWatched.chapterName}`
                    : ''}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <ProgressBar
                  value={lastWatched.percentage}
                  max={100}
                  size="xs"
                  color="#6366F1"
                  className="flex-1 max-w-48"
                />
                <span className="text-xs text-[#64748B]">{lastWatched.percentage}%</span>
              </div>
            </div>
            <Link to={buildRoute(ROUTES.WATCH, { lectureId: lastWatched.lectureId })}>
              <Button size="sm" leftIcon={<Play size={14} />}>Resume</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Subjects */}
      {subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">My Subjects</p>
            <Link
              to={ROUTES.SUBJECTS}
              className="text-xs text-[#64748B] hover:text-[#F8FAFC] flex items-center gap-0.5 transition-colors"
            >
              Manage <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.slice(0, 6).map((s) => {
              const progress = getSubjectProgress(s.id)
              return (
                <Link
                  key={s.id}
                  to={buildRoute(ROUTES.SUBJECT, { subjectId: s.id })}
                  className="flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-3 hover:border-[#6366F1]/30 transition-all group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${s.color}18` }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F8FAFC] truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ProgressBar value={progress} max={100} size="xs" color={s.color} className="flex-1" />
                      <span className="text-xs text-[#64748B] shrink-0">{progress}%</span>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-[#475569] group-hover:text-[#818CF8] shrink-0 transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-2 flex-wrap">
        <Link to={ROUTES.TIMER}>
          <Button variant="secondary" size="sm">Focus Timer</Button>
        </Link>
        <Link to={ROUTES.ANALYTICS}>
          <Button variant="ghost" size="sm" leftIcon={<TrendingUp size={14} />}>Analytics</Button>
        </Link>
        {subjects.length === 0 && (
          <Link to={ROUTES.SUBJECTS}>
            <Button size="sm" leftIcon={<Plus size={14} />}>Add Subject</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

function StatBox({
  label,
  value,
  sub,
  icon,
  badge,
  accent,
  urgent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  accent?: string
  urgent?: boolean
}) {
  return (
    <div
      className={`relative bg-[#111820] border rounded-2xl p-4 transition-all duration-200 hover:border-[#2A3B4D] ${
        urgent
          ? 'border-[#EF4444]/40 bg-[#160D0D]'
          : 'border-[#1E2A36]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">
            {label}
          </span>
        </div>
        {badge}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span
          className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight"
          style={{ color: urgent ? '#EF4444' : accent ?? '#F8FAFC' }}
        >
          {value}
        </span>
      </div>

      {sub && (
        <div className="text-xs text-[#64748B] font-medium flex items-center gap-1 mt-1 truncate">
          {sub}
        </div>
      )}
    </div>
  )
}
