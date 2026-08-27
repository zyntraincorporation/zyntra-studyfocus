import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getGreeting } from '@/utils/time.utils'
import appIcon from '@/assets/icon.jpg'

export default function Header() {
  const { userDoc } = useAuth()
  const location = useLocation()

  // Only show greeting on dashboard
  const isDashboard = location.pathname === '/dashboard'

  return (
    <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-[#1E2A36] bg-[#0B0F14] shrink-0">
      {/* Mobile logo */}
      <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
        <img
          src={appIcon}
          alt="ZyntraFocus"
          className="w-7 h-7 rounded-lg object-cover shadow-sm ring-1 ring-white/10"
        />
        <span className="text-sm font-bold text-[#F8FAFC]">ZyntraFocus</span>
      </Link>

      {/* Desktop greeting */}
      <div className="hidden md:block">
        {isDashboard && userDoc ? (
          <p className="text-sm text-[#94A3B8]">
            {getGreeting()},{' '}
            <span className="text-[#F8FAFC] font-medium">{userDoc.displayName}</span> 👋
          </p>
        ) : (
          <div />
        )}
      </div>

      {/* Right side — user avatar */}
      {userDoc && (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-semibold select-none">
            {userDoc.displayName?.charAt(0).toUpperCase() ?? '?'}
          </div>
        </div>
      )}
    </header>
  )
}
