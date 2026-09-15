import { useEffect, useState } from 'react'
import { getSessionsByDateRange, sumSessionSeconds } from '@/services/sessions.service'
import type { StudySession } from '@/types/progress.types'
import { useAuth } from '@/contexts/AuthContext'
import { formatDurationHuman } from '@/utils/time.utils'
import { getLastNDateKeys, getLocalDateKey, formatDateKey } from '@/utils/date.utils'
import { SkeletonList } from '@/components/ui/Skeleton'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const SUBJECT_COLORS = ['#6366F1','#22C55E','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#EC4899']

// Custom tooltip — shows real date + correct minutes
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{ background: '#17202A', border: '1px solid #1E2A36' }}>
      <p className="text-[#94A3B8] mb-0.5">{d?.fullDate}</p>
      <p className="text-[#F8FAFC] font-bold">{d?.mins} min</p>
    </div>
  )
}

// X-axis tick formatter — only show label every 5 days to avoid clutter
function tickFormatter(_: string, index: number) {
  return index % 5 === 0 ? '' + index : ''
}

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
  const last30Keys = getLastNDateKeys(30)  // oldest → newest
  const last7Keys  = getLastNDateKeys(7)

  const totalSecs = sumSessionSeconds(sessions)
  const weekSecs  = sumSessionSeconds(sessions.filter(s => last7Keys.includes(s.dateKey)))
  const todaySecs = sumSessionSeconds(sessions.filter(s => s.dateKey === today))

  // Build chart data — one entry per day, using index as X key (no duplicate weekday bug)
  const chartData = last30Keys.map((dateKey, idx) => {
    const daySessions = sessions.filter(s => s.dateKey === dateKey)
    const mins = Math.round(sumSessionSeconds(daySessions) / 60)
    const isToday = dateKey === today
    // Show tick label every 5 positions
    const showLabel = idx === 0 || idx % 5 === 4 || isToday
    return {
      idx,
      dateKey,
      fullDate: formatDateKey(dateKey),
      mins,
      tickLabel: showLabel ? formatDateKey(dateKey).replace(/\s/g, '\n') : '',
    }
  })

  // Subject breakdown — combined video + timer
  const subjectMap: Record<string, { name: string; secs: number }> = {}
  sessions.forEach(s => {
    const k = s.subjectId
    if (!subjectMap[k]) subjectMap[k] = { name: s.subjectName, secs: 0 }
    subjectMap[k].secs += s.duration
  })
  const subjects = Object.values(subjectMap).sort((a, b) => b.secs - a.secs)
  const maxSecs = subjects[0]?.secs ?? 1

  const hasAnyData = sessions.length > 0

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header + Stats */}
      <div>
        <h1 className="text-xl font-bold text-[#F8FAFC] mb-4">Analytics</h1>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Today',     value: formatDurationHuman(todaySecs) },
            { label: 'This Week', value: formatDurationHuman(weekSecs)  },
            { label: '30 Days',   value: formatDurationHuman(totalSecs) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 text-center">
              <p className="text-xs text-[#64748B] mb-1">{label}</p>
              <p className="text-base font-bold text-[#F8FAFC]">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day area chart */}
      <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#94A3B8] mb-4">Last 30 Days</p>
        {!hasAnyData ? (
          <div className="h-36 flex items-center justify-center text-sm text-[#64748B]">
            No sessions yet — start studying!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#1E2A36"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="idx"
                type="number"
                domain={[0, 29]}
                ticks={[0, 5, 10, 15, 20, 25, 29]}
                tickFormatter={(idx) => {
                  const entry = chartData[idx as number]
                  return entry ? formatDateKey(entry.dateKey).slice(0, 6) : ''
                }}
                tick={{ fill: '#64748B', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#64748B', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}m`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="mins"
                stroke="#6366F1"
                strokeWidth={2}
                fill="url(#studyGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#6366F1', stroke: '#818CF8', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subject breakdown */}
      {subjects.length > 0 && (
        <div className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4">
          <p className="text-sm font-semibold text-[#94A3B8] mb-4">By Subject</p>
          <div className="space-y-3">
            {subjects.map((s, i) => {
              const pct = Math.round((s.secs / maxSecs) * 100)
              const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-[#F8FAFC] font-medium truncate pr-3">{s.name}</span>
                    <span className="text-xs text-[#64748B] shrink-0 tabular-nums">{formatDurationHuman(s.secs)}</span>
                  </div>
                  <div className="h-1.5 bg-[#17202A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!hasAnyData && (
        <p className="text-center text-sm text-[#475569] py-4">
          Watch lectures or use the Focus Timer to start tracking.
        </p>
      )}
    </div>
  )
}
