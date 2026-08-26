import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FileText, Bookmark, BarChart3 } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

const navItems = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.SUBJECTS, icon: BookOpen, label: 'Subjects' },
  { to: ROUTES.NOTES, icon: FileText, label: 'Notes' },
  { to: ROUTES.BOOKMARKS, icon: Bookmark, label: 'Bookmarks' },
  { to: ROUTES.ANALYTICS, icon: BarChart3, label: 'Analytics' },
]

export default function BottomNav() {
  return (
    <div className="flex items-center justify-around bg-[#111820] border-t border-[#1E2A36] px-2 py-2 safe-area-bottom">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === ROUTES.DASHBOARD}
          className={({ isActive }) =>
            [
              'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors duration-150 text-xs font-medium',
              isActive ? 'text-[#818CF8]' : 'text-[#64748B]',
            ].join(' ')
          }
        >
          <Icon size={21} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}
