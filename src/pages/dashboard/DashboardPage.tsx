import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Plus, TrendingUp, Flame, Target, BookOpen, ChevronRight } from 'lucide-react'
import { getSubjects, getLecture } from '@/services/curriculum.service'
import { getTodaySessions, sumSessionSeconds } from '@/services/sessions.service'
import type { Subject, Lecture } from '@/types/curriculum.types'
import type { StudySession } from '@/types/progress.types'
import { useAuth } from '@/contexts/AuthContext'
import { buildRoute, ROUTES } from '@/constants/routes'
import { getGreeting } from '@/utils/time.utils'
import { formatDurationHuman } from '@/utils/time.utils'
import { SkeletonCard } from '@/components/ui/Skeleton'
import ProgressBar from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import { useProgressStats } from '@/hooks/useProgressStats'

export default function DashboardPage() {
  const { user, userDoc, progressMap } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [todaySessions, setTodaySessions] = useState<StudySession[]>([])
  const [lastWatchedLecture, setLastWatchedLecture] = useState<Lecture | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { getSubjectProgress } = useProgressStats()

  useEffect(() => {
    if (!user) return
    Promise.all([
      getSubjects(user.uid),
      getTodaySessions(user.uid),
    ]).then(([subs, sessions]) => {
      setSubjects(subs)
      setTodaySessions(sessions)
    }).finally(() => setIsLoading(false))
  }, [user])

  const todaySeconds = sumSessionSeconds(todaySessions)
  const goalMinutes = userDoc?.dailyGoalMinutes ?? 60
  const goalProgress = Math.min(Math.round((todaySeconds / 60 / goalMinutes) * 100), 100)

  // Last watched lecture from progressMap
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
    getLecture(user.uid, lastWatched.lectureId).then((lec) => {
      setLastWatchedLecture(lec)
    })
  }, [user, lastWatched?.lectureId])

  const totalLectures = Object.keys(progressMap).length
  const completedLectures = Object.values(progressMap).filter((p) => p.completed).length
  const overallProgress = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">
          {getGreeting()}, {userDoc?.displayName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          {subjects.length === 0
            ? 'Create your first subject to get started.'
            : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''} · ${completedLectures} lectures completed`}
        </p>
      </div>

      {/* Quick action if no subjects */}
      {subjects.length === 0 && (
        <div className="bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl p-6 text-center space-y-3">
          <p className="text-3xl">📚</p>
          <p className="text-sm font-medium text-[#F8FAFC]">Your personal study workspace is ready</p>
          <p className="text-xs text-[#64748B]">Start by creating a subject, then add chapters and YouTube lectures.</p>
          <Link to={ROUTES.SUBJECTS}>
            <Button leftIcon={<Plus size={14} />}>Create First Subject</Button>
          </Link>
        </div>
      )}

      {/* Stats row */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Target size={18} className="text-[#6366F1]" />}
            label="Today's Goal"
            value={`${goalProgress}%`}
            sub={`${formatDurationHuman(todaySeconds)} / ${goalMinutes}min`}
            accent="#6366F1"
          />
          <StatCard
            icon={<Flame size={18} className="text-[#F59E0B]" />}
            label="Streak"
            value={`${userDoc?.streak ?? 0}d`}
            sub={`Best: ${userDoc?.longestStreak ?? 0}d`}
            accent="#F59E0B"
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-[#22C55E]" />}
            label="Completed"
            value={`${completedLectures}`}
            sub={`${totalLectures} tracked`}
            accent="#22C55E"
          />
          <StatCard
            icon={<BookOpen size={18} className="text-[#3B82F6]" />}
            label="Subjects"
            value={`${subjects.length}`}
            sub="active"
            accent="#3B82F6"
          />
        </div>
      )}

      {/* Today's goal progress bar */}
      {subjects.length > 0 && (
        <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#F8FAFC]">Daily Study Goal</p>
            <span className="text-xs text-[#64748B]">{formatDurationHuman(todaySeconds)} of {goalMinutes} min</span>
          </div>
          <ProgressBar value={goalProgress} max={100} size="md" color="#6366F1" />
        </div>
      )}

      {/* Continue learning */}
      {lastWatched && (
        <div className="bg-[#111820] border border-[#6366F1]/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#818CF8] uppercase tracking-wide mb-3">Continue Learning</p>
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
                <ProgressBar value={lastWatched.percentage} max={100} size="xs" color="#6366F1" className="flex-1 max-w-48" />
                <span className="text-xs text-[#64748B]">{lastWatched.percentage}% watched</span>
              </div>
            </div>
            <Link to={buildRoute(ROUTES.WATCH, { lectureId: lastWatched.lectureId })}>
              <Button size="sm" leftIcon={<Play size={14} />}>Resume</Button>
            </Link>
          </div>
        </div>
      )}

      {/* My Subjects */}
      {subjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide">My Subjects</p>
            <Link to={ROUTES.SUBJECTS} className="text-xs text-[#818CF8] hover:text-[#6366F1] flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.slice(0, 6).map((s) => {
              const progress = getSubjectProgress(s.id)
              return (
                <Link
                  key={s.id}
                  to={buildRoute(ROUTES.SUBJECT, { subjectId: s.id })}
                  className="flex items-center gap-3 bg-[#111820] border border-[#1E2A36] rounded-xl p-3 hover:border-[#6366F1]/40 transition-all group"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${s.color}20` }}
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
                  <ChevronRight size={14} className="text-[#475569] group-hover:text-[#818CF8] shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Link to={ROUTES.SUBJECTS}>
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />}>
            Add Subject
          </Button>
        </Link>
        <Link to={ROUTES.ANALYTICS}>
          <Button variant="ghost" size="sm" leftIcon={<TrendingUp size={14} />}>
            View Analytics
          </Button>
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string
}) {
  return (
    <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-[#64748B]">{label}</p></div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-xs text-[#64748B] mt-0.5">{sub}</p>
    </div>
  )
}
