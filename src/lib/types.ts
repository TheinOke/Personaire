// Row types for the Supabase tables (see supabase/migrations).

export type TimeFormat = '12h' | '24h'
export type Priority = 'low' | 'medium' | 'high'

export interface Settings {
  user_id: string
  display_name: string | null
  timezone: string
  time_format: TimeFormat
  date_format: string
  week_start: 0 | 1
  default_reminder_minutes: number
  notifications_enabled: boolean
  habit_reminders_enabled: boolean
  daily_summary_enabled: boolean
  daily_summary_time: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  sort_order: number
  archived: boolean
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  category_id: string | null
  title: string
  description: string | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  priority: Priority
  start_date: string | null
  target_date: string | null
  progress_mode: 'tasks' | 'manual'
  manual_progress: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  goal_id: string | null
  parent_task_id: string | null
  category_id: string | null
  title: string
  notes: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: Priority
  due_date: string | null
  due_time: string | null
  scheduled_date: string | null
  estimated_minutes: number | null
  reminder_at: string | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface PlannerBlock {
  id: string
  user_id: string
  block_date: string
  start_time: string
  end_time: string
  title: string
  notes: string | null
  task_id: string | null
  category_id: string | null
  done: boolean
  created_at: string
  updated_at: string
}

export interface Habit {
  id: string
  user_id: string
  category_id: string | null
  name: string
  description: string | null
  /** ISO weekdays: 1 = Monday … 7 = Sunday */
  days_of_week: number[]
  reminder_time: string | null
  start_date: string
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  log_date: string
  note: string | null
  created_at: string
}
