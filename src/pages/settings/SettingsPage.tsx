import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { updateUserDocument } from '@/services/users.service'
import Button from '@/components/ui/Button'
import { DEFAULT_SEEK_INTERVAL } from '@/constants/firebase'

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
    <div className="max-w-lg space-y-6 animate-fade-in">
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

      <Button onClick={handleSave} isLoading={isSaving} className="w-full">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </Button>
    </div>
  )
}
