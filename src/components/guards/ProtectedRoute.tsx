import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/constants/routes'
import LoadingScreen from '@/components/ui/LoadingScreen'

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  return user ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />
}
