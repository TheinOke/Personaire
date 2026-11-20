import {
  CalendarDays,
  ChartLine,
  CheckSquare,
  Ellipsis,
  House,
  Repeat,
  Settings,
  Tags,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Full navigation — shown in the desktop sidebar. */
export const mainNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/habits', label: 'Habits', icon: Repeat },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/progress', label: 'Progress', icon: ChartLine },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Bottom tab bar on phones — the rest live under "More". */
export const mobileTabs: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/habits', label: 'Habits', icon: Repeat },
  { to: '/more', label: 'More', icon: Ellipsis },
]

export const moreNav: NavItem[] = mainNav.filter((i) =>
  ['/goals', '/focus', '/progress', '/categories', '/settings'].includes(i.to),
)
