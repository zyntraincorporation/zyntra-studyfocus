import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { updateUserDocument } from '@/services/users.service'
import Button from '@/components/ui/Button'
import type { Theme } from '@/types/user.types'

export default function SettingsPage() {
  const { userDoc, refreshUserDoc } = useAuth()
  const { theme, setTheme } = useTheme()
  const [dailyGoal, setDailyGoal] = useState(userDoc?.dailyGoalMinutes ?? 360)
  const [speed, setSpeed] = useState(userDoc?.preferredSpeed ?? 1)
  const [breakReminder, setBreakReminder] = useState(userDoc?.breakReminderMinutes ?? 50)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!userDoc) return null

  const handleSave = async () => {
    setIsSaving(true)
    await updateUserDocument(userDoc.uid, {
      dailyGoalMinutes: dailyGoal,
      preferredSpeed: speed,
      breakReminderMinutes: breakReminder,
      theme,
    })
    await refreshUserDoc()
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'dark', label: '🌙 Dark' },
    { value: 'light', label: '☀️ Light' },
    { value: 'system', label: '🖥️ System' },
  ]

  return (
    <div className="max-w-lg space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#F8FAFC]">Settings</h1>

      {/* Account info */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-lg font-bold">
            {userDoc.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-[#F8FAFC]">{userDoc.displayName}</p>
            <p className="text-sm text-[#64748B]">{userDoc.email}</p>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Appearance</h2>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                theme === value
                  ? 'bg-[#6366F1]/10 border-[#6366F1] text-[#818CF8]'
                  : 'bg-transparent border-[#1E2A36] text-[#94A3B8] hover:border-[#6366F1]/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Study Preferences */}
      <section className="bg-[#111820] border border-[#1E2A36] rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[#94A3B8]">Study Preferences</h2>

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

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F8FAFC]">
            Default Speed: <span className="text-[#818CF8]">{speed}x</span>
          </label>
          <div className="flex gap-2">
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
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

      <Button onClick={handleSave} isLoading={isSaving} className="w-full">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </Button>
    </div>
  )
}
