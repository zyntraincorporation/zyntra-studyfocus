import { useState, type FormEvent } from 'react'
import { Mail, Lock, Zap, Eye, EyeOff } from 'lucide-react'
import { signIn } from '@/services/auth.service'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Incorrect email or password. Please try again.')
      } else if (code === 'auth/user-not-found') {
        setError('No account found with this email.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait and try again.')
      } else {
        setError('Login failed. Please check your connection and try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#6366F1] flex items-center justify-center mb-4 shadow-lg">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">ZyntraFocus</h1>
          <p className="text-sm text-[#64748B] mt-1">Your distraction-free study space</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#111820] border border-[#1E2A36] rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F8FAFC] text-center mb-5">Sign In</h2>

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            autoComplete="email"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#F8FAFC]">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                <Lock size={16} />
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-10 rounded-lg border border-[#1E2A36] bg-[#17202A] text-[#F8FAFC] placeholder-[#64748B] text-sm pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent hover:border-[#2D3B4D] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8] cursor-pointer"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-2" isLoading={isLoading} size="lg">
            Sign In
          </Button>
        </form>

        <p className="text-xs text-[#64748B] text-center mt-6">
          Access is restricted. Contact admin if you need an account.
        </p>
      </div>
    </div>
  )
}
