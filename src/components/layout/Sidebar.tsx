import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Bookmark,
  BarChart3,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/constants/routes'

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.SUBJECTS, icon: BookOpen, label: 'My Subjects' },
  { to: ROUTES.NOTES, icon: FileText, label: 'Notes' },
  { to: ROUTES.BOOKMARKS, icon: Bookmark, label: 'Bookmarks' },
  { to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const { userDoc, signOut } = useAuth()

  return (
    <aside className="h-full flex flex-col bg-[#0B0F14] border-r border-[#1E2A36] w-56">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1E2A36] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-[#F8FAFC] tracking-tight">ZyntraFocus</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#6366F1]/15 text-[#818CF8]'
                  : 'text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#111820]'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Sign out */}
      <div className="px-3 py-4 border-t border-[#1E2A36] shrink-0 space-y-2">
        {userDoc && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userDoc.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F8FAFC] truncate">{userDoc.displayName}</p>
              <p className="text-[10px] text-[#64748B] truncate">{userDoc.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
