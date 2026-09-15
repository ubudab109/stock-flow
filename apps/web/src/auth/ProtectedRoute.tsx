import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from './useAuth'

export function ProtectedRoute() {
  const { data, isLoading, isError } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
