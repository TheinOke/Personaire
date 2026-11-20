import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

// The VAPID *public* key is meant to be public (every subscribing browser gets it),
// so it is safe to ship in the code. The env var, if set, overrides it.
// The matching private key lives only in the Supabase function secrets.
const DEFAULT_VAPID_PUBLIC_KEY = 'BCS3Nco_S6q2GJXMXgXMegIU_lft9NY4rFfrxCPawoITU96HvkAxflqgmJMjnd7O7gNYv_GhS1Ec5pEPYx5shsY'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || DEFAULT_VAPID_PUBLIC_KEY

export type PushStatus =
  | 'loading'
  | 'unsupported' // browser can't do web push
  | 'needs-install' // iPhone/iPad: only works from the Home Screen app
  | 'no-worker' // service worker not running (e.g. `npm run dev`)
  | 'not-configured' // VITE_VAPID_PUBLIC_KEY missing
  | 'denied' // user blocked notifications
  | 'off'
  | 'on'

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Incomplete push subscription')
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Push notification state for THIS device, plus actions. */
export function usePush() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (isIOS() && !isStandalone()) return setStatus('needs-install')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return setStatus('unsupported')
    }
    if (!VAPID_PUBLIC_KEY) return setStatus('not-configured')
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return setStatus('no-worker')
    if (Notification.permission === 'denied') return setStatus('denied')
    const sub = await reg.pushManager.getSubscription()
    if (sub && user) {
      // Make sure the server knows about this device (e.g. after a reinstall).
      saveSubscription(sub).catch(() => {})
    }
    setStatus(sub ? 'on' : 'off')
  }, [user])

  useEffect(() => {
    refresh().catch((e) => {
      setStatus('unsupported')
      setMessage(String(e))
    })
  }, [refresh])

  /** Must be called from a tap/click (iOS requires a user gesture). */
  const enable = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) throw new Error('Service worker is not running.')
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!) }))
      await saveSubscription(sub)
      setStatus('on')
      setMessage('Notifications are on for this device.')
    } catch (e) {
      setMessage((e as Error).message ?? 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus('off')
    } catch (e) {
      setMessage((e as Error).message ?? 'Could not turn off notifications.')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke<{ sent?: number; error?: string }>('send-reminders', {
        body: { test: true },
      })
      if (error) {
        // Surface the function's own error text when there is one.
        const ctx = (error as { context?: Response }).context
        const detail = ctx ? await ctx.json().catch(() => null) : null
        throw new Error(detail?.error ?? error.message)
      }
      setMessage(data?.sent ? 'Test sent — it should arrive in a few seconds.' : 'No devices received it. Try turning notifications off and on.')
    } catch (e) {
      setMessage(`Test failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return { status, busy, message, enable, disable, sendTest }
}
