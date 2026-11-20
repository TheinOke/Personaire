import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './AppLayout'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'

/** Load each page only when it's first opened (smaller first download on the phone). */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const Component = lazy<ComponentType>(async () => ({ default: (await load())[name] }))
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}>
      <Component />
    </Suspense>
  )
}

const routes: { path?: string; index?: boolean; element: ReactNode }[] = [
  { index: true, element: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage') },
  { path: 'goals', element: page(() => import('@/features/goals/GoalsPage'), 'GoalsPage') },
  { path: 'goals/:goalId', element: page(() => import('@/features/goals/GoalDetailPage'), 'GoalDetailPage') },
  { path: 'tasks', element: page(() => import('@/features/tasks/TasksPage'), 'TasksPage') },
  { path: 'planner', element: page(() => import('@/features/planner/PlannerPage'), 'PlannerPage') },
  { path: 'habits', element: page(() => import('@/features/habits/HabitsPage'), 'HabitsPage') },
  { path: 'progress', element: page(() => import('@/features/progress/ProgressPage'), 'ProgressPage') },
  { path: 'categories', element: page(() => import('@/features/categories/CategoriesPage'), 'CategoriesPage') },
  { path: 'settings', element: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage') },
  { path: 'more', element: page(() => import('./MorePage'), 'MorePage') },
]

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: routes,
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
