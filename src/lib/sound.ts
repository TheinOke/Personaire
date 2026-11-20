// Short chime for when a timer finishes. Browsers (especially iOS) only allow
// audio after a user tap, so call unlockSound() from a click handler first.

let ctx: AudioContext | null = null

function getContext() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

export function unlockSound() {
  const c = getContext()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function playChime() {
  const c = getContext()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const notes = [880, 1108.7, 1318.5] // A5, C#6, E6
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.18
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.5)
  })
  navigator.vibrate?.([200, 100, 200])
}
