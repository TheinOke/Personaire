import { NavLink, Outlet } from 'react-router'
import { LogOut } from 'lucide-react'
import { mainNav, mobileTabs } from './nav'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAutoTimezone } from '@/features/settings/useSettings'
import { TimerPill } from '@/features/focus/TimerPill'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { signOut, user } = useAuth()
  useAutoTimezone()

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-3">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">Personaire</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t px-3 pt-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="-ml-3" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>

      {/* Page content */}
      <main className="pt-safe min-w-0 flex-1 pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <TimerPill />

      {/* Phone bottom tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {mobileTabs.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground',
                    isActive && 'text-foreground',
                  )
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
