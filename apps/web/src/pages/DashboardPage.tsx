import { useCurrentUser } from '../auth/useAuth'

export function DashboardPage() {
  const { data: user } = useCurrentUser()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Welcome{user ? `, ${user.email}` : ''}</h1>
      <p className="mt-2 text-gray-500">
        Products and invoices are on their way — this dashboard will summarize your inventory once they land.
      </p>
    </div>
  )
}
