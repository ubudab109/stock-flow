import { NavLink, Outlet } from 'react-router-dom'
import { useCurrentUser, useLogout } from '../auth/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/products', label: 'Products', end: false },
]

export function Layout() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-gray-900">StockFlow</span>
            <nav className="flex gap-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-500">{user.email}</span>}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {logout.isPending ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
