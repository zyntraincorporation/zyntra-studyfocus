import { useState, useEffect, useRef } from 'react'
import {
  Target, CheckCircle2, Circle, Plus, Trash2, CloudCheck, Loader2
} from 'lucide-react'
import ProgressBar from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import { formatDurationHuman, formatMinutesHuman } from '@/utils/time.utils'
import { getLocalDateKey } from '@/utils/date.utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  subscribeToDailyTasks,
  saveDailyTasks,
  type DailyTask,
} from '@/services/dailyTasks.service'
import type { Lecture } from '@/types/curriculum.types'

interface TodayTargetSectionProps {
  todaySeconds: number
  goalMinutes: number
  lastWatchedLecture?: Lecture | null
}

export default function TodayTargetSection({
  todaySeconds,
  goalMinutes,
}: TodayTargetSectionProps) {
  const { user } = useAuth()
  const todayKey = getLocalDateKey()
  const storageKey = `zyntra_daily_tasks_${todayKey}`

  // Optimistic initial state from localStorage for zero-flicker startup
  const [tasks, setTasks] = useState<DailyTask[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [newTaskInput, setNewTaskInput] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const initialLocalTasksRef = useRef<DailyTask[]>(tasks)

  // ── Multi-Device Realtime Cloud Synchronization ────────────────────────
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToDailyTasks(user.uid, todayKey, (cloudTasks, existsInCloud) => {
      setIsSynced(true)
      if (existsInCloud) {
        setTasks(cloudTasks)
        try {
          localStorage.setItem(storageKey, JSON.stringify(cloudTasks))
        } catch {
          // ignore
        }
      } else {
        // Brand new day or first device login:
        // If this device already had local tasks created today, upload them to cloud
        if (initialLocalTasksRef.current.length > 0) {
          saveDailyTasks(user.uid, todayKey, initialLocalTasksRef.current)
        } else {
          // Daily auto-reset for new day
          setTasks([])
          try {
            localStorage.setItem(storageKey, JSON.stringify([]))
          } catch {
            // ignore
          }
        }
      }
    })

    return () => unsubscribe()
  }, [user, todayKey, storageKey])

  // Helper to persist changes locally and to Firestore
  const persistTasks = (updatedTasks: DailyTask[]) => {
    setTasks(updatedTasks)
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedTasks))
    } catch {
      // ignore
    }
    if (user) {
      saveDailyTasks(user.uid, todayKey, updatedTasks)
    }
  }

  const goalProgress = Math.min(Math.round((todaySeconds / (goalMinutes * 60)) * 100), 100)

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = newTaskInput.trim()
    if (!text) return

    const newTask: DailyTask = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      completed: false,
    }

    persistTasks([...tasks, newTask])
    setNewTaskInput('')
    setIsAddingTask(false)
  }

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    persistTasks(updated)
  }

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id)
    persistTasks(updated)
  }

  return (
    <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
      {/* Header with Title, Progress, and Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Target size={16} className="text-[#818CF8] shrink-0" />
          <div>
            <span className="text-sm sm:text-base font-bold text-[#F8FAFC]">
              আজকের টাস্ক ও টার্গেট
            </span>
            <span className="text-xs text-[#94A3B8] ml-2 tabular-nums">
              {formatDurationHuman(todaySeconds)} / {formatMinutesHuman(goalMinutes)} ({goalProgress}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 sm:w-36">
            <ProgressBar
              value={goalProgress}
              max={100}
              size="xs"
              color={goalProgress >= 100 ? '#22C55E' : '#6366F1'}
            />
          </div>

          {!isAddingTask && (
            <button
              onClick={() => setIsAddingTask(true)}
              className="text-xs sm:text-sm text-[#818CF8] hover:text-white bg-[#6366F1]/10 hover:bg-[#6366F1] px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-semibold inline-flex items-center gap-1 border border-[#6366F1]/25"
            >
              <Plus size={14} /> টাস্ক লিখো
            </button>
          )}
        </div>
      </div>

      {/* Task input field */}
      {isAddingTask && (
        <form onSubmit={handleAddTask} className="flex gap-2 pt-1 animate-fade-in">
          <input
            type="text"
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            placeholder="যেমন: Physics Ch 2 Lecture 1 শেষ করব..."
            autoFocus
            className="flex-1 bg-[#0B0F14] border border-[#2A3B4D] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
          />
          <Button size="sm" type="submit" className="font-bold">যোগ</Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setIsAddingTask(false)
              setNewTaskInput('')
            }}
          >
            বাতিল
          </Button>
        </form>
      )}

      {/* Simple Clean Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-2 pt-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                task.completed
                  ? 'bg-[#0B0F14]/50 border-[#1E2A36]/60 opacity-65'
                  : 'bg-[#0B0F14] border-[#1E2A36] hover:border-[#2A3B4D] hover:bg-[#0E141B]'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
              >
                {task.completed ? (
                  <CheckCircle2 size={16} className="text-[#22C55E] shrink-0" />
                ) : (
                  <Circle size={16} className="text-[#64748B] hover:text-[#818CF8] shrink-0 transition-colors" />
                )}
                <span
                  className={`text-xs sm:text-sm font-medium truncate ${
                    task.completed ? 'line-through text-[#64748B]' : 'text-[#F1F5F9]'
                  }`}
                >
                  {task.text}
                </span>
              </button>

              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                className="text-[#64748B] hover:text-[#EF4444] p-1.5 transition-colors cursor-pointer rounded-lg hover:bg-[#1E2A36]"
                title="মুছে ফেলো"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !isAddingTask && (
          <div className="text-center py-3 border border-dashed border-[#1E2A36] rounded-xl text-xs sm:text-sm text-[#64748B]">
            আজকের কোনো নির্দিষ্ট টাস্ক নেই।{' '}
            <button
              onClick={() => setIsAddingTask(true)}
              className="text-[#818CF8] hover:text-[#A5B4FC] hover:underline cursor-pointer font-semibold"
            >
              + নতুন টাস্ক যোগ করো
            </button>
          </div>
        )
      )}
    </div>
  )
}
