import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center text-center p-4">
      <p className="text-7xl font-black text-[#17202A] mb-4">404</p>
      <h1 className="text-xl font-bold text-[#F8FAFC] mb-2">Page Not Found</h1>
      <p className="text-sm text-[#64748B] mb-8">The page you're looking for doesn't exist.</p>
      <Link to={ROUTES.DASHBOARD}>
        <Button leftIcon={<Home size={16} />}>Back to Dashboard</Button>
      </Link>
    </div>
  )
}
