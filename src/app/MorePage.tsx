import { Link } from 'react-router'
import { ChevronRight, LogOut } from 'lucide-react'
import { moreNav } from './nav'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'

export function MorePage() {
  const { signOut, user } = useAuth()
  return (
    <>
      <PageHeader title="More" description={user?.email} />
      <ul className="divide-y rounded-lg border">
        {moreNav.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 px-4 py-3.5">
              <Icon className="size-5 text-muted-foreground" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          <button onClick={signOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <LogOut className="size-5 text-muted-foreground" />
            <span className="flex-1">Sign out</span>
          </button>
        </li>
      </ul>
    </>
  )
}
