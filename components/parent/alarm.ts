// Sound, vibration and phone notifications for the parent page.
// Browsers only allow sound after the user taps once, so unlockAudio() is called from a button tap.
// Everything here is plain browser APIs: Web Audio (beeps), navigator.vibrate, Notification.

let ctx: AudioContext | null = null; // one shared AudioContext for the whole page
let ringTimer: ReturnType<typeof setInterval> | null = null;
let vibTimer: ReturnType<typeof setInterval> | null = null;

// Create (or wake up) the shared AudioContext. Call this from a tap.
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    /* sound is optional, ignore */
  }
}

// Play one tone: frequency in Hz, start time, length in seconds.
function tone(freq: number, start: number, len: number, volume = 0.18) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + len);
  osc.start(start);
  osc.stop(start + len);
}

// Short beep pattern per colour (same idea as the reference demo's buzz()).
const BEEPS: Record<string, [number, number][]> = {
  blue: [[660, 0.12]],
  amber: [[740, 0.12], [740, 0.12]],
  green: [[523, 0.12], [784, 0.2]],
  red: [[880, 0.15], [880, 0.15], [880, 0.15]],
};

// Used for "info" takeovers: a short beep plus a short buzz.
export function beep(color: string) {
  try {
    navigator.vibrate?.(color === "red" ? [200, 100, 200, 100, 200] : [120, 80, 120]);
  } catch {}
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  let t = ctx.currentTime;
  for (const [f, d] of BEEPS[color] ?? BEEPS.blue) {
    tone(f, t, d);
    t += d + 0.06;
  }
}

// ---- Alarm mode: ring like an incoming call until stopRing() ----
function ringOnce() {
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime;
  // two-tone ring: high-low-high-low, then silence until the next repeat
  tone(1000, t, 0.18, 0.25);
  tone(780, t + 0.2, 0.18, 0.25);
  tone(1000, t + 0.4, 0.18, 0.25);
  tone(780, t + 0.6, 0.18, 0.25);
}

function buzzOnce() {
  try {
    navigator.vibrate?.([600, 300, 600, 300]);
  } catch {}
}

// Safe to call many times: it only starts once.
export function startRing() {
  if (!ringTimer) {
    ringOnce();
    ringTimer = setInterval(ringOnce, 1200); // repeat every 1.2 s
  }
  if (!vibTimer) {
    buzzOnce();
    vibTimer = setInterval(buzzOnce, 1800); // the pattern is 1.8 s long, so re-trigger
  }
}

export function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  if (vibTimer) clearInterval(vibTimer);
  ringTimer = null;
  vibTimer = null;
  try {
    navigator.vibrate?.(0); // cancel any buzz in progress
  } catch {}
}

// ---- Phone notifications (shown when the page is in the background) ----
export async function askNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function showSystemNotification(title: string, body: string, tag: string, urgent: boolean) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: any = {
    body,
    icon: "/icon.svg",
    tag,
    requireInteraction: urgent,
    vibrate: urgent ? [600, 300, 600, 300, 600] : [150, 80, 150],
  };
  try {
    // Prefer the service worker (works on Android Chrome); fall back to a plain Notification.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    try {
      new Notification(title, options);
    } catch {}
  }
}
