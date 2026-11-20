// Personaire — send-reminders (Supabase Edge Function, Deno)
//
// Two ways in:
//  1. The scheduler (pg_cron, every minute) with header `x-cron-secret`:
//     sends due task reminders, habit reminders and the daily summary.
//  2. The signed-in app with { test: true }: sends a test push to that user.
//
// Secrets (set with `npx supabase secrets set --env-file supabase/.env.secrets.local`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Provided automatically by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('PERSONAIRE_SECRET_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------------------
// Time helpers (all "local" values are in the user's timezone)
// ---------------------------------------------------------------------------
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

function localParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WEEKDAY[p.weekday] ?? 1,
  }
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Wall-clock `day` + `time` in `tz` → the real instant. */
function instantFor(day: string, time: string, tz: string): Date {
  const [y, mo, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, mo - 1, d, 0, toMin(time))
  const lp = localParts(new Date(guess), tz)
  const [ly, lmo, ld] = lp.day.split('-').map(Number)
  const observed = Date.UTC(ly, lmo - 1, ld, 0, lp.minutes)
  return new Date(guess - (observed - guess))
}

function clock(time: string, format: string) {
  const m = toMin(time)
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  if (format === '12h') return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
  return `${String(h).padStart(2, '0')}:${mm}`
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
interface Payload {
  title: string
  body?: string
  url?: string
  tag?: string
}

async function sendToUser(userId: string, payload: Payload): Promise<number> {
  const { data: subs, error } = await db.from('push_subscriptions').select('*').eq('user_id', userId)
  if (error) throw error
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60, urgency: 'high' },
      )
      sent++
      await db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // The device unsubscribed or the subscription expired → forget it.
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', status, (err as Error).message)
    }
  }
  return sent
}

/** Record a notification once. Returns false if it was already sent. */
async function claim(userId: string, kind: string, refId: string, scheduledFor: Date) {
  const { data, error } = await db
    .from('notification_log')
    .upsert(
      { user_id: userId, kind, ref_id: refId, scheduled_for: scheduledFor.toISOString() },
      { onConflict: 'kind,ref_id,scheduled_for', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// The scheduled run
// ---------------------------------------------------------------------------
const WINDOW_MIN = 60 // catch up on anything missed in the last hour

/**
 * Pomodoro sessions whose planned end has passed: close them (so the log is
 * right even if the app was closed) and send a "session finished" push.
 */
async function finishTimers(now: Date) {
  let sent = 0
  const { data: due } = await db
    .from('time_entries')
    .select('id, user_id, kind, planned_end_at')
    .is('ended_at', null)
    .not('planned_end_at', 'is', null)
    .lte('planned_end_at', now.toISOString())
    .throwOnError()

  for (const e of due ?? []) {
    // Close it at its planned end (no-op if the app already did).
    await db.from('time_entries').update({ ended_at: e.planned_end_at }).eq('id', e.id).is('ended_at', null).throwOnError()

    // Only notify for sessions that ended recently.
    const end = new Date(e.planned_end_at)
    if (now.getTime() - end.getTime() > WINDOW_MIN * 60000) continue
    if (!(await claim(e.user_id, 'timer_end', e.id, end))) continue

    let body = 'Ready for the next focus session?'
    if (e.kind === 'focus') {
      const { data: s } = await db
        .from('settings')
        .select('pomodoro_short_break_min')
        .eq('user_id', e.user_id)
        .maybeSingle()
      body = `Nice work. Take a ${s?.pomodoro_short_break_min ?? 5} minute break.`
    }
    sent += await sendToUser(e.user_id, {
      title: e.kind === 'focus' ? '✅ Focus session done' : '⏰ Break is over',
      body,
      url: '/focus',
      tag: 'timer',
    })
  }
  return sent
}

async function runReminders() {
  const now = new Date()
  const counts = { task: 0, habit: 0, summary: 0, timer: 0 }

  counts.timer = await finishTimers(now)

  const { data: subs } = await db.from('push_subscriptions').select('user_id').throwOnError()
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))]
  if (userIds.length === 0) return counts

  const { data: settingsRows, error: sErr } = await db.from('settings').select('*').in('user_id', userIds)
  if (sErr) throw sErr

  for (const s of settingsRows ?? []) {
    const tz: string = s.timezone || 'UTC'
    const local = localParts(now, tz)

    // 1. Task reminders whose time has come (within the window).
    const { data: tasks } = await db
      .from('tasks')
      .select('id, title, due_time, reminder_at')
      .eq('user_id', s.user_id)
      .neq('status', 'done')
      .not('reminder_at', 'is', null)
      .lte('reminder_at', now.toISOString())
      .gte('reminder_at', new Date(now.getTime() - WINDOW_MIN * 60000).toISOString())
      .throwOnError()
    for (const t of tasks ?? []) {
      if (!(await claim(s.user_id, 'task_reminder', t.id, new Date(t.reminder_at)))) continue
      counts.task += await sendToUser(s.user_id, {
        title: t.due_time ? `⏰ Due at ${clock(t.due_time, s.time_format)}` : '⏰ Task reminder',
        body: t.title,
        url: '/tasks',
        tag: `task-${t.id}`,
      })
    }

    // 2. Habit reminders for habits due today and not yet done.
    if (s.habit_reminders_enabled) {
      const { data: habits } = await db
        .from('habits')
        .select('id, name, reminder_time, days_of_week, start_date')
        .eq('user_id', s.user_id)
        .eq('archived', false)
        .not('reminder_time', 'is', null)
        .throwOnError()
      const dueNow = (habits ?? []).filter((h) => {
        const diff = local.minutes - toMin(h.reminder_time)
        return h.start_date <= local.day && h.days_of_week.includes(local.weekday) && diff >= 0 && diff < WINDOW_MIN
      })
      if (dueNow.length) {
        const { data: logs } = await db
          .from('habit_logs')
          .select('habit_id')
          .eq('log_date', local.day)
          .in('habit_id', dueNow.map((h) => h.id))
          .throwOnError()
        const doneIds = new Set((logs ?? []).map((l) => l.habit_id))
        for (const h of dueNow) {
          if (doneIds.has(h.id)) continue
          if (!(await claim(s.user_id, 'habit_reminder', h.id, instantFor(local.day, h.reminder_time, tz)))) continue
          counts.habit += await sendToUser(s.user_id, {
            title: '🔁 Habit reminder',
            body: h.name,
            url: '/habits',
            tag: `habit-${h.id}`,
          })
        }
      }
    }

    // 2b. Review reminder on the last day of the week and/or month.
    if (s.review_reminders_enabled && s.review_reminder_time) {
      const diff = local.minutes - toMin(s.review_reminder_time)
      if (diff >= 0 && diff < WINDOW_MIN) {
        const weekEndDay = s.week_start === 0 ? 6 : 7 // Saturday if weeks start Sunday, else Sunday
        const isWeekEnd = local.weekday === weekEndDay
        const [y, mo, d] = local.day.split('-').map(Number)
        const isMonthEnd = new Date(Date.UTC(y, mo - 1, d + 1)).getUTCDate() === 1
        if (isWeekEnd || isMonthEnd) {
          const when = instantFor(local.day, s.review_reminder_time, tz)
          if (await claim(s.user_id, 'review_reminder', s.user_id, when)) {
            const what = isWeekEnd && isMonthEnd ? 'week and month' : isMonthEnd ? 'month' : 'week'
            counts.summary += await sendToUser(s.user_id, {
              title: `📝 Time to review your ${what}`,
              body: 'See what you got done and plan what comes next.',
              url: `/review?type=${isMonthEnd && !isWeekEnd ? 'month' : 'week'}`,
              tag: 'review',
            })
          }
        }
      }
    }

    // 3. Daily summary of today's tasks and habits.
    if (s.daily_summary_enabled && s.daily_summary_time) {
      const diff = local.minutes - toMin(s.daily_summary_time)
      if (diff >= 0 && diff < WINDOW_MIN) {
        const when = instantFor(local.day, s.daily_summary_time, tz)
        if (await claim(s.user_id, 'daily_summary', s.user_id, when)) {
          const { data: open } = await db
            .from('tasks')
            .select('due_date, scheduled_date')
            .eq('user_id', s.user_id)
            .neq('status', 'done')
            .throwOnError()
          const overdue = (open ?? []).filter((t) => t.due_date && t.due_date < local.day).length
          const today = (open ?? []).filter((t) => {
            if (t.due_date && t.due_date < local.day) return false
            const d = t.scheduled_date ?? t.due_date
            return d && d <= local.day
          }).length
          const { data: hs } = await db
            .from('habits')
            .select('days_of_week, start_date')
            .eq('user_id', s.user_id)
            .eq('archived', false)
            .throwOnError()
          const habitsDue = (hs ?? []).filter((h) => h.start_date <= local.day && h.days_of_week.includes(local.weekday)).length

          const parts = [
            today && `${today} task${today > 1 ? 's' : ''} today`,
            overdue && `${overdue} overdue`,
            habitsDue && `${habitsDue} habit${habitsDue > 1 ? 's' : ''}`,
          ].filter(Boolean)
          if (parts.length) {
            counts.summary += await sendToUser(s.user_id, {
              title: s.display_name ? `Good morning, ${s.display_name}` : 'Your day',
              body: parts.join(' · '),
              url: '/',
              tag: 'daily-summary',
            })
          }
        }
      }
    }
  }
  return counts
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!SERVICE_KEY) return json({ error: 'Missing service role key in function environment' }, 500)

    // Scheduler
    if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
      return json({ ok: true, sent: await runReminders() })
    }

    // Signed-in user: test notification
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return json({ error: 'Unauthorized' }, 401)

    const sent = await sendToUser(data.user.id, {
      title: 'Personaire',
      body: 'Test notification — push is working ✅',
      url: '/settings',
      tag: 'test',
    })
    return json({ ok: true, sent })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message ?? String(err) }, 500)
  }
})
