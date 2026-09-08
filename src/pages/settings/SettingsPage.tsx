import { useState, useEffect } from 'react'
import {
  Trash2, RotateCcw, BookOpen, FileText, Link2, Check, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { updateUserDocument } from '@/services/users.service'
import {
  getTrashedItems,
  restoreTrashedItem,
  permanentlyDeleteTrashedItem,
  emptyAllTrash,
} from '@/services/trash.service'
import type { TrashedItem } from '@/types/trash.types'
import Button from '@/components/ui/Button'
import { DEFAULT_SEEK_INTERVAL } from '@/constants/firebase'

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  note: { icon: <BookOpen size={13} />, color: '#34D399', label: 'Note' },
  pdf:  { icon: <FileText size={13} />, color: '#EF4444', label: 'PDF' },
  link: { icon: <Link2 size={13} />,    color: '#38BDF8', label: 'Link' },
}

function formatDeletedDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SettingsPage() {
  const { userDoc, refreshUserDoc } = useAuth()
  const [displayName, setDisplayName] = useState(userDoc?.displayName || 'Saiful')
  const [dailyGoal, setDailyGoal] = useState(userDoc?.dailyGoalMinutes ?? 360)
  const [speed, setSpeed] = useState(userDoc?.preferredSpeed ?? 1)
  const [breakReminder, setBreakReminder] = useState(userDoc?.breakReminderMinutes ?? 50)
  const [seekInterval, setSeekInterval] = useState<5 | 10>(
    userDoc?.seekInterval ?? (DEFAULT_SEEK_INTERVAL as 5 | 10)
  )
  const [showClock, setShowClock] = useState(userDoc?.showClock ?? true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Trash state
  const [trashedItems, setTrashedItems] = useState<TrashedItem[]>([])
  const [isTrashLoading, setIsTrashLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [trashNotice, setTrashNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!userDoc) return
    loadTrash()
  }, [userDoc?.uid])

  const loadTrash = async () => {
    if (!userDoc) return
    setIsTrashLoading(true)
    try {
      const items = await getTrashedItems(userDoc.uid)
      setTrashedItems(items)
    } catch (err) {
      console.error('Failed to load trash:', err)
    } finally {
      setIsTrashLoading(false)
    }
  }

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setTrashNotice({ text, type })
    setTimeout(() => setTrashNotice(null), 3500)
  }

  const handleRestore = async (item: TrashedItem) => {
    if (!userDoc) return
    setActionInProgress(item.id)
    const result = await restoreTrashedItem(userDoc.uid, item)
    if (result.success) {
      setTrashedItems((prev) => prev.filter((t) => t.id !== item.id))
      showNotice(`"${item.title}" অধ্যায়ে পুনরুদ্ধার করা হয়েছে!`, 'success')
    } else {
      showNotice(result.error || 'পুনরুদ্ধার ব্যর্থ হয়েছে।', 'error')
    }
    setActionInProgress(null)
  }

  const handleDeleteForever = async (item: TrashedItem) => {
    if (!userDoc) return
    if (!window.confirm(`"${item.title}" স্থায়ীভাবে মুছে ফেলবেন? এটি আর কখনো ফিরিয়ে আনা যাবে না।`)) {
      return
    }
    setActionInProgress(item.id)
    try {
      await permanentlyDeleteTrashedItem(userDoc.uid, item.id)
      setTrashedItems((prev) => prev.filter((t) => t.id !== item.id))
      showNotice(`"${item.title}" স্থায়ীভাবে মুছে ফেলা হয়েছে।`, 'success')
    } catch {
      showNotice('মুছে ফেলা ব্যর্থ হয়েছে।', 'error')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleEmptyAllTrash = async () => {
    if (!userDoc || trashedItems.length === 0) return
    if (!window.confirm('ট্র্যাশের সব আইটেম স্থায়ীভাবে মুছে ফেলবেন? এই কাজটি আর পূর্বাবস্থায় ফিরিয়ে আনা যাবে না।')) {
      return
    }
    setActionInProgress('empty-all')
    try {
      await emptyAllTrash(userDoc.uid)
      setTrashedItems([])
      showNotice('ট্র্যাশ সম্পূর্ণ খালি করা হয়েছে।', 'success')
    } catch {
      showNotice('ট্র্যাশ খালি করা ব্যর্থ হয়েছে।', 'error')
    } finally {
      setActionInProgress(null)
    }
  }

  if (!userDoc) return null

  const handleSave = async () => {
    setIsSaving(true)
    await updateUserDocument(userDoc.uid, {
      displayName: displayName.trim() || 'Saiful',
      dailyGoalMinutes: dailyGoal,
      preferredSpeed: speed,
      breakReminderMinutes: breakReminder,
      seekInterval,
      showClock,
    })
    await refreshUserDoc()
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
  <div className="max-w-xl space-y-6 animate-fade-in">
    <h1 className="text-xl font-bold text-[#F8FAFC]">Settings</h1>

      {/* Account info */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-lg font-bold">
            {(displayName || 'Saiful').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[#F8FAFC]">{displayName || 'Saiful'}</p>
            <p className="text-xs text-[#64748B]">{userDoc.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F8FAFC]">Your Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full h-10 rounded-lg border border-[#1E2A36] bg-[#17202A] text-[#F8FAFC] placeholder-[#64748B] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-colors"
          />
        </div>
      </section>

      {/* Study Preferences */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-5">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Study Preferences</h2>

        {/* Daily goal */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F8FAFC]">
            Daily Goal: <span className="text-[#818CF8]">{dailyGoal} min ({Math.round(dailyGoal / 60)}h)</span>
          </label>
          <input
            type="range" min={30} max={720} step={30}
            value={dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            className="w-full accent-[#6366F1]"
          />
          <div className="flex justify-between text-xs text-[#64748B]">
            <span>30 min</span><span>12 hours</span>
          </div>
        </div>

        {/* Break reminder */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F8FAFC]">
            Break Reminder: <span className="text-[#818CF8]">every {breakReminder} min</span>
          </label>
          <input
            type="range" min={15} max={120} step={5}
            value={breakReminder}
            onChange={(e) => setBreakReminder(Number(e.target.value))}
            className="w-full accent-[#6366F1]"
          />
          <div className="flex justify-between text-xs text-[#64748B]">
            <span>15 min</span><span>2 hours</span>
          </div>
        </div>
      </section>

      {/* Playback */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-5">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Playback</h2>

        {/* Default speed */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F8FAFC]">
            Default Speed: <span className="text-[#818CF8]">{speed}x</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-[#6366F1] border-[#6366F1] text-white'
                    : 'border-[#1E2A36] text-[#94A3B8] hover:border-[#6366F1]/40'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Skip interval */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#F8FAFC]">Skip / Seek Interval</label>
          <p className="text-xs text-[#64748B]">
            How far the rewind and forward buttons jump when pressed.
          </p>
          <div className="flex flex-col gap-2">
            {([5, 10] as const).map((val) => (
              <label
                key={val}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="radio"
                  name="seekInterval"
                  value={val}
                  checked={seekInterval === val}
                  onChange={() => setSeekInterval(val)}
                  className="accent-[#6366F1] w-4 h-4 cursor-pointer"
                />
                <span
                  className={`text-sm transition-colors ${
                    seekInterval === val ? 'text-[#F8FAFC] font-medium' : 'text-[#94A3B8] group-hover:text-[#F8FAFC]'
                  }`}
                >
                  {val} seconds
                  {val === 10 && <span className="ml-2 text-xs text-[#475569]">(default)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Bangladesh Live Clock Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1E2A36]">
          <div>
            <label className="text-sm font-medium text-[#F8FAFC]">Bangladesh Time (BST Clock)</label>
            <p className="text-xs text-[#64748B]">
              Show real-time distraction-free clock below the video progress bar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowClock(!showClock)}
            className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 shrink-0 ${
              showClock ? 'bg-[#6366F1]' : 'bg-[#1E2A36]'
            }`}
            aria-label="Toggle Bangladesh clock"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                showClock ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Trash Section */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-[#EF4444]" />
            <h2 className="text-sm font-semibold text-[#F8FAFC]">Trash (রিসাইকেল বিন)</h2>
            {trashedItems.length > 0 && (
              <span className="text-xs bg-[#EF4444]/15 text-[#EF4444] px-2 py-0.5 rounded-full font-semibold">
                {trashedItems.length}
              </span>
            )}
          </div>
          {trashedItems.length > 0 && (
            <button
              onClick={handleEmptyAllTrash}
              disabled={actionInProgress === 'empty-all'}
              className="text-xs text-[#EF4444] hover:text-[#F87171] hover:bg-[#EF4444]/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-medium"
            >
              {actionInProgress === 'empty-all' ? 'Emptying...' : 'Empty All Trash'}
            </button>
          )}
        </div>

        <p className="text-xs text-[#64748B]">
          অধ্যায় থেকে মুছে ফেলা নোট ও রিসোর্সগুলো এখানে জমা থাকে। আপনি চাইলে সেগুলো পূর্বের অধ্যায়ে পুনরুদ্ধার (Restore) করতে পারেন অথবা স্থায়ীভাবে মুছে ফেলতে পারেন।
        </p>

        {trashNotice && (
          <div
            className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${
              trashNotice.type === 'success'
                ? 'text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/20'
                : 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20'
            }`}
          >
            {trashNotice.type === 'success' ? <Check size={13} className="shrink-0" /> : <AlertCircle size={13} className="shrink-0" />}
            <span>{trashNotice.text}</span>
          </div>
        )}

        {isTrashLoading ? (
          <div className="text-center py-6 text-xs text-[#64748B]">
            লোডিং হচ্ছে...
          </div>
        ) : trashedItems.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-[#1E2A36] rounded-xl">
            <Trash2 size={24} className="mx-auto text-[#1E2A36] mb-1.5" />
            <p className="text-xs text-[#64748B]">Trash is empty</p>
            <p className="text-[11px] text-[#475569] mt-0.5">মুছে ফেলা নোটগুলো এখানে দেখতে পাবেন।</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {trashedItems.map((item) => {
              const cfg = TYPE_CONFIG[item.resourceType] || TYPE_CONFIG.note
              const isWorking = actionInProgress === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 bg-[#17202A] border border-[#1E2A36] hover:border-[#2D3A4A] rounded-xl transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: `${cfg.color}18`, color: cfg.color }}
                    >
                      {cfg.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#F8FAFC] truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] mt-0.5 truncate">
                        {item.subjectName && (
                          <span className="text-[#818CF8] truncate">
                            {item.subjectName} {item.chapterName ? `• ${item.chapterName}` : ''}
                          </span>
                        )}
                        <span>•</span>
                        <span>{formatDeletedDate(item.deletedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={isWorking}
                      className="flex items-center gap-1 text-xs text-[#818CF8] hover:text-[#A5B4FC] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 font-medium"
                      title="Restore back to chapter"
                    >
                      <RotateCcw size={12} className={isWorking ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                    <button
                      onClick={() => handleDeleteForever(item)}
                      disabled={isWorking}
                      className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete Permanently"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Button onClick={handleSave} isLoading={isSaving} className="w-full">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </Button>
    </div>
  )
}
