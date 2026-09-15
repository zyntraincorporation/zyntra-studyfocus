import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import ProtectedRoute from '@/components/guards/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoadingScreen from '@/components/ui/LoadingScreen'

// Auth
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))

// Main app pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const SubjectsPage = lazy(() => import('@/pages/subjects/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/subjects/SubjectDetailPage'))
const ChapterDetailPage = lazy(() => import('@/pages/chapters/ChapterDetailPage'))
const WatchPage = lazy(() => import('@/pages/lectures/WatchPage'))

// Personal features
const NotesPage = lazy(() => import('@/pages/notes/NotesPage'))
const BookmarksPage = lazy(() => import('@/pages/bookmarks/BookmarksPage'))
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const TimerPage = lazy(() => import('@/pages/timer/TimerPage'))

// Error
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'))

const fallback = <LoadingScreen />

export default function App() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        {/* Public */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected — requires auth */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Redirect / → /dashboard */}
            <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.SUBJECTS} element={<SubjectsPage />} />
            <Route path={ROUTES.SUBJECT} element={<SubjectDetailPage />} />
            <Route path={ROUTES.CHAPTER} element={<ChapterDetailPage />} />
            <Route path={ROUTES.NOTES} element={<NotesPage />} />
            <Route path={ROUTES.BOOKMARKS} element={<BookmarksPage />} />
            <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path={ROUTES.TIMER} element={<TimerPage />} />
          </Route>

          {/* Watch page — full screen, no AppLayout chrome */}
          <Route path={ROUTES.WATCH} element={<WatchPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
