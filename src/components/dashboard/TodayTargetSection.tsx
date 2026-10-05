import { useState, useEffect } from 'react'
import {
  Target, CheckCircle2, Circle, Plus, Trash2
} from 'lucide-react'
import ProgressBar from '@/components/ui/ProgressBar'
import Button from '@/components/ui/Button'
import { formatDurationHuman, formatMinutesHuman } from '@/utils/time.utils'
import { getLocalDateKey } from '@/utils/date.utils'
import type { Lecture } from '@/types/curriculum.types'

interface DailyTask {
  id: string
  text: string
  completed: boolean
}

interface TodayTargetSectionProps {
  todaySeconds: number
  goalMinutes: number
  lastWatchedLecture?: Lecture | null
}

export default function TodayTargetSection({
  todaySeconds,
  goalMinutes,
}: TodayTargetSectionProps) {
  const todayKey = getLocalDateKey()
  const storageKey = `zyntra_daily_tasks_${todayKey}`

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

  // Save tasks to localStorage per date
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(tasks))
    } catch {
      // ignore
    }
  }, [tasks, storageKey])

  const goalProgress = Math.min(Math.round((todaySeconds / (goalMinutes * 60)) * 100), 100)

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = newTaskInput.trim()
    if (!text) return

    setTasks((prev) => [
      ...prev,
      { id: Date.now().toString(), text, completed: false }
    ])
    setNewTaskInput('')
    setIsAddingTask(false)
  }

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-4 space-y-3">
      {/* Compact Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-[#818CF8]" />
          <span className="text-sm font-semibold text-[#F8FAFC]">আজকের টাস্ক ও টার্গেট</span>
          <span className="text-xs text-[#64748B] tabular-nums">
            {formatDurationHuman(todaySeconds)} / {formatMinutesHuman(goalMinutes)} ({goalProgress}%)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Small compact progress bar */}
          <div className="w-24 sm:w-32">
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
              className="text-xs text-[#818CF8] hover:text-[#A5B4FC] inline-flex items-center gap-1 transition-colors cursor-pointer font-medium"
            >
              <Plus size={13} /> টাস্ক লিখো
            </button>
          )}
        </div>
      </div>

      {/* Task input field */}
      {isAddingTask && (
        <form onSubmit={handleAddTask} className="flex gap-2 pt-1">
          <input
            type="text"
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            placeholder="যেমন: Physics Ch 2 Lecture 1 শেষ করব..."
            autoFocus
            className="flex-1 bg-[#0B0F14] border border-[#2A3B4D] rounded-xl px-3 py-1.5 text-xs text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:border-[#6366F1]"
          />
          <Button size="sm" type="submit">যোগ</Button>
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

      {/* Simple Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                task.completed
                  ? 'bg-[#0B0F14]/50 border-[#1E2A36]/50 opacity-70'
                  : 'bg-[#0B0F14] border-[#1E2A36] hover:border-[#2A3B4D]'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
              >
                {task.completed ? (
                  <CheckCircle2 size={15} className="text-[#22C55E] shrink-0" />
                ) : (
                  <Circle size={15} className="text-[#475569] hover:text-[#818CF8] shrink-0" />
                )}
                <span
                  className={`text-xs font-medium truncate ${
                    task.completed ? 'line-through text-[#64748B]' : 'text-[#E2E8F0]'
                  }`}
                >
                  {task.text}
                </span>
              </button>

              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                className="text-[#475569] hover:text-[#EF4444] p-1 transition-colors cursor-pointer"
                title="মুছে ফেলো"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !isAddingTask && (
          <div className="text-center py-2 border border-dashed border-[#1E2A36] rounded-xl text-xs text-[#475569]">
            আজকের কোনো নির্দিষ্ট টাস্ক নেই।{' '}
            <button
              onClick={() => setIsAddingTask(true)}
              className="text-[#818CF8] hover:underline cursor-pointer"
            >
              + টাস্ক যোগ করো
            </button>
          </div>
        )
      )}
    </div>
  )
}
