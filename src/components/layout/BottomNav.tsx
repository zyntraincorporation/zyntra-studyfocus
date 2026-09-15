import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, FileText, Bookmark, Timer } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

const navItems = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.SUBJECTS, icon: BookOpen, label: 'Subjects' },
  { to: ROUTES.TIMER, icon: Timer, label: 'Timer' },
  { to: ROUTES.NOTES, icon: FileText, label: 'Notes' },
  { to: ROUTES.BOOKMARKS, icon: Bookmark, label: 'Marks' },
]

export default function BottomNav() {
  return (
    <div className="flex items-center justify-around bg-[#111820] border-t border-[#1E2A36] px-1 py-2 safe-area-bottom">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === ROUTES.DASHBOARD}
          className={({ isActive }) =>
            [
              'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors duration-150 text-[11px] font-medium min-w-0 flex-1',
              isActive ? 'text-[#818CF8]' : 'text-[#64748B]',
            ].join(' ')
          }
        >
          <Icon size={20} />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </div>
  )
}
