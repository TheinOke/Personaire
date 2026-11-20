import { BellOff, BellRing, Send, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePush, type PushStatus } from './usePush'

const HELP: Partial<Record<PushStatus, string>> = {
  'needs-install':
    'On iPhone, notifications only work from the installed app: open this site in Safari → Share → Add to Home Screen, then open Personaire from your Home Screen.',
  unsupported: 'This browser does not support push notifications.',
  'no-worker': 'The app’s service worker isn’t running here (it only runs in the deployed / built app).',
  'not-configured': 'Push key missing: add VITE_VAPID_PUBLIC_KEY to the environment and redeploy.',
  denied:
    'Notifications are blocked for Personaire. On iPhone: Settings → Notifications → Personaire → Allow Notifications. Then come back here.',
}

/** Turn push on/off for this device and send a test. */
export function PushControls() {
  const { status, busy, message, enable, disable, sendTest } = usePush()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'loading' && <span className="text-sm text-muted-foreground">Checking…</span>}
        {status === 'off' && (
          <Button onClick={enable} disabled={busy}>
            <BellRing /> {busy ? 'Enabling…' : 'Enable notifications'}
          </Button>
        )}
        {status === 'on' && (
          <>
            <span className="mr-1 inline-flex items-center gap-1.5 text-sm">
              <span className="size-2 rounded-full bg-foreground" /> On for this device
            </span>
            <Button variant="outline" size="sm" onClick={sendTest} disabled={busy}>
              <Send /> Send test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
              <BellOff /> Turn off
            </Button>
          </>
        )}
        {status === 'needs-install' && <Share className="size-4 text-muted-foreground" />}
      </div>
      {HELP[status] && <p className="text-xs text-muted-foreground">{HELP[status]}</p>}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
