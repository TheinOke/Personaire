import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { DATE_FORMATS, formatDate, formatTime } from '@/lib/format'
import { trimSeconds } from '@/lib/dates'
import { PushControls } from '@/features/notifications/PushControls'
import { useAuth } from '@/features/auth/AuthProvider'
import { deviceTimezone, useSettings, useUpdateSettings } from './useSettings'

const REMINDER_OPTIONS = [
  { value: 0, label: 'At the time' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="sm:w-64 sm:shrink-0 sm:text-right">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings()
  const update = useUpdateSettings()
  const { user, signOut } = useAuth()

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return [deviceTimezone(), 'UTC']
    }
  }, [])

  const now = new Date()
  const device = deviceTimezone()

  return (
    <>
      <PageHeader
        title="Settings"
        description="Preferences, time format and notifications."
        actions={
          update.isPending ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : update.isError ? (
            <span className="text-xs text-muted-foreground">⚠ Not saved: {update.error.message}</span>
          ) : null
        }
      />

      <QueryState isLoading={isLoading} error={error}>
        {settings && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Row label="Display name" hint="Used in the dashboard greeting.">
                  <Input
                    key={settings.display_name ?? ''}
                    defaultValue={settings.display_name ?? ''}
                    placeholder="Your name"
                    maxLength={50}
                    onBlur={(e) => {
                      const value = e.target.value.trim() || null
                      if (value !== settings.display_name) update.mutate({ display_name: value })
                    }}
                  />
                </Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Date & time</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Row
                  label="Timezone"
                  hint={
                    settings.timezone !== device ? (
                      <button className="underline" onClick={() => update.mutate({ timezone: device })}>
                        Use this device's timezone ({device})
                      </button>
                    ) : (
                      'Matches this device.'
                    )
                  }
                >
                  <Select value={settings.timezone} onChange={(e) => update.mutate({ timezone: e.target.value })}>
                    {!timezones.includes(settings.timezone) && <option value={settings.timezone}>{settings.timezone}</option>}
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Time format" hint={`Now: ${formatTime(now, settings)}`}>
                  <Segmented
                    value={settings.time_format}
                    options={[
                      { value: '12h', label: '12-hour' },
                      { value: '24h', label: '24-hour' },
                    ]}
                    onChange={(time_format) => update.mutate({ time_format })}
                  />
                </Row>
                <Row label="Date format" hint={`Today: ${formatDate(now, settings)}`}>
                  <Select value={settings.date_format} onChange={(e) => update.mutate({ date_format: e.target.value })}>
                    {DATE_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Week starts on">
                  <Segmented
                    value={settings.week_start}
                    options={[
                      { value: 1 as const, label: 'Monday' },
                      { value: 0 as const, label: 'Sunday' },
                    ]}
                    onChange={(week_start) => update.mutate({ week_start })}
                  />
                </Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Reminders arrive as push notifications on devices where you turn them on.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <div className="py-3">
                  <p className="mb-2 text-sm font-medium">This device</p>
                  <PushControls />
                </div>
                <Row label="Default task reminder" hint="Used when you add a due time to a task.">
                  <Select
                    value={settings.default_reminder_minutes}
                    onChange={(e) => update.mutate({ default_reminder_minutes: Number(e.target.value) })}
                  >
                    {REMINDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Habit reminders" hint="Remind me at each habit's reminder time.">
                  <Switch
                    aria-label="Habit reminders"
                    checked={settings.habit_reminders_enabled}
                    onCheckedChange={(habit_reminders_enabled) => update.mutate({ habit_reminders_enabled })}
                  />
                </Row>
                <Row label="Daily summary" hint="Today’s tasks, overdue items and habits, each morning.">
                  <div className="flex items-center justify-end gap-3">
                    <Input
                      type="time"
                      aria-label="Daily summary time"
                      className="w-32"
                      disabled={!settings.daily_summary_enabled}
                      value={trimSeconds(settings.daily_summary_time) || '08:00'}
                      onChange={(e) => e.target.value && update.mutate({ daily_summary_time: e.target.value })}
                    />
                    <Switch
                      aria-label="Daily summary"
                      checked={!!settings.daily_summary_enabled}
                      onCheckedChange={(daily_summary_enabled) => update.mutate({ daily_summary_enabled })}
                    />
                  </div>
                </Row>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle>Account</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePassword />
                <Button variant="outline" className="mt-4 w-full sm:w-auto" onClick={signOut}>
                  <LogOut /> Sign out
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </QueryState>
    </>
  )
}

function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setMessage('Use at least 8 characters.')
    if (password !== confirm) return setMessage('Passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    setMessage(error ? error.message : 'Password updated.')
    if (!error) {
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 pt-4">
      <p className="text-sm font-medium">Change password</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={busy || !password}>
          {busy ? 'Updating…' : 'Update password'}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </form>
  )
}
