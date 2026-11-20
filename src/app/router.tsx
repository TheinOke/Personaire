import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from './AppLayout'
import { MorePage } from './MorePage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { GoalsPage } from '@/features/goals/GoalsPage'
import { GoalDetailPage } from '@/features/goals/GoalDetailPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { PlannerPage } from '@/features/planner/PlannerPage'
import { HabitsPage } from '@/features/habits/HabitsPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: 'goals/:goalId', element: <GoalDetailPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'planner', element: <PlannerPage /> },
      { path: 'habits', element: <HabitsPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'more', element: <MorePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
