import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⌂', end: true },
  { to: '/products', label: 'Products', icon: '▤' },
  { to: '/conversion', label: 'Conversion', icon: '⇄' },
  { to: '/purchases', label: 'Purchases', icon: '↓' },
  { to: '/sales', label: 'Sales', icon: '↑' },
  { to: '/customers', label: 'Customers', icon: '☺' },
  { to: '/suppliers', label: 'Suppliers', icon: '⚑' },
  { to: '/expenses', label: 'Expenses', icon: '₹' },
  { to: '/adjustments', label: 'Adjustments', icon: '±' },
  { to: '/reports', label: 'Reports', icon: '≡' }
]

// Mobile bottom nav shows the 5 most-used items; rest live under "More"
const PRIMARY = ['/', '/products', '/sales', '/purchases']

export default function Layout() {
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="min-h-screen bg-paper flex">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-line bg-surface p-4 h-screen sticky top-0">
        <div className="mb-6 px-1">
          <p className="font-display font-bold text-lg text-primary leading-tight">AIYARAPPA</p>
          <p className="font-display font-bold text-sm text-accent tracking-wide -mt-1">TRADERS</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-card text-sm font-medium ${
                  isActive ? 'bg-primary text-white' : 'text-ink/70 hover:bg-paper'
                }`
              }
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="text-sm text-ink/50 hover:text-danger px-3 py-2 text-left"
        >
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-surface border-b border-line px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-primary leading-none">AIYARAPPA TRADERS</p>
          </div>
          <button onClick={signOut} className="text-xs text-ink/50">Sign out</button>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-5xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line safe-bottom">
          <div className="grid grid-cols-5">
            {PRIMARY.map((to) => {
              const item = NAV.find((n) => n.to === to)
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                      isActive ? 'text-primary' : 'text-ink/50'
                    }`
                  }
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-ink/50"
            >
              <span className="text-lg leading-none">⋯</span>
              More
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setMoreOpen(false)} />
            <div className="relative bg-surface w-full rounded-t-2xl p-4 safe-bottom">
              <div className="grid grid-cols-3 gap-2">
                {NAV.filter((n) => !PRIMARY.includes(n.to)).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1 py-4 rounded-card border border-line text-sm font-medium text-ink/70"
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
