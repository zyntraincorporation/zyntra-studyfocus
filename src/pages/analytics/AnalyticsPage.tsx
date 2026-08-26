import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { getSessionsByDateRange, sumSessionSeconds } from '@/services/sessions.service'
import type { StudySession } from '@/types/progress.types'
import { useAuth } from '@/contexts/AuthContext'
import { formatDurationHuman } from '@/utils/time.utils'
import { getLastNDateKeys, getLocalDateKey, formatDateKey, getWeekdayShort } from '@/utils/date.utils'
import { SkeletonList } from '@/components/ui/Skeleton'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getSessionsByDateRange(user.uid, 30).then(setSessions).finally(() => setIsLoading(false))
  }, [user])

  if (isLoading) return <SkeletonList count={4} />

  const today = getLocalDateKey()
  const todaySeconds = sumSessionSeconds(sessions.filter((s) => s.dateKey === today))

  const thisWeekKeys = getLastNDateKeys(7)
  const weekSeconds = sumSessionSeconds(sessions.filter((s) => thisWeekKeys.includes(s.dateKey)))

  const monthSeconds = sumSessionSeconds(sessions)

  // Chart data — last 7 days
  const chartData = thisWeekKeys.map((key) => {
    const daySeconds = sumSessionSeconds(sessions.filter((s) => s.dateKey === key))
    return {
      day: getWeekdayShort(key),
      date: formatDateKey(key),
      minutes: Math.round(daySeconds / 60),
    }
  })

  // Subject distribution
  const subjectMap: Record<string, { name: string; seconds: number }> = {}
  sessions.forEach((s) => {
    if (!subjectMap[s.subjectId]) {
      subjectMap[s.subjectId] = { name: s.subjectName, seconds: 0 }
    }
    subjectMap[s.subjectId].seconds += s.duration
  })
  const subjects = Object.values(subjectMap).sort((a, b) => b.seconds - a.seconds)

  const COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6']

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#F8FAFC]">Analytics</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Today" value={formatDurationHuman(todaySeconds)} />
        <StatCard label="This Week" value={formatDurationHuman(weekSeconds)} />
        <StatCard label="This Month" value={formatDurationHuman(monthSeconds)} />
      </div>

      {/* Weekly bar chart */}
      <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#94A3B8] mb-4">Last 7 Days</h2>
        {chartData.every((d) => d.minutes === 0) ? (
          <div className="h-32 flex items-center justify-center text-sm text-[#64748B]">
            No study sessions recorded yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#17202A', border: '1px solid #1E2A36', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94A3B8' }}
                formatter={(v) => [`${v as number} min`, 'Study time']}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={chartData[i].day === getWeekdayShort(today) ? '#6366F1' : '#1E2A36'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subject breakdown */}
      {subjects.length > 0 && (
        <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] mb-4">By Subject (30 days)</h2>
          <div className="space-y-3">
            {subjects.map((s, i) => {
              const pct = Math.round((s.seconds / monthSeconds) * 100)
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#F8FAFC] font-medium">{s.name}</span>
                    <span className="text-[#64748B]">{formatDurationHuman(s.seconds)}</span>
                  </div>
                  <div className="h-1.5 bg-[#17202A] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 text-center">
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      <p className="text-lg font-bold text-[#F8FAFC]">{value}</p>
    </div>
  )
}
