export type NotificationSoundKey =
  | "ding"
  | "ka_ching"
  | "chime_bell"
  | "notification_pop"
  | "success_tone"
  | "soft_prompt"
  | "celebration_chime";

let audioUnlocked = false;
let soundEnabledOverride: boolean | null = null;

function canUseAudioContext(): boolean {
  return typeof window !== "undefined" && typeof window.AudioContext !== "undefined";
}

function notificationsSoundEnabled(): boolean {
  if (soundEnabledOverride != null) return soundEnabledOverride;
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem("gh_sound_notifications_enabled");
  return value !== "false";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  soundEnabledOverride = enabled;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("gh_sound_notifications_enabled", enabled ? "true" : "false");
  }
}

function runToneSequence(steps: Array<{ frequency: number; durationMs: number; gain: number; delayMs?: number }>) {
  if (!canUseAudioContext()) return;
  const ctx = new window.AudioContext();
  for (const step of steps) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = step.frequency;
    gainNode.gain.value = step.gain;
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    const startAt = ctx.currentTime + (step.delayMs ?? 0) / 1000;
    const stopAt = startAt + step.durationMs / 1000;
    oscillator.start(startAt);
    oscillator.stop(stopAt);
  }

  const totalDuration = steps.reduce((max, step) => {
    const end = (step.delayMs ?? 0) + step.durationMs;
    return end > max ? end : max;
  }, 0);

  window.setTimeout(() => {
    void ctx.close();
  }, totalDuration + 150);
}

export function unlockNotificationAudio(): void {
  if (!canUseAudioContext() || audioUnlocked) return;
  const unlock = () => {
    audioUnlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function resolveNotificationSoundKey(type: string): NotificationSoundKey {
  switch (type) {
    case "message":
      return "ding";
    case "order_placed":
    case "order":
      return "ka_ching";
    case "delivery_status_changed":
    case "delivery":
      return "chime_bell";
    case "delivery_job_assigned":
      return "notification_pop";
    case "payment_received":
    case "payment":
      return "success_tone";
    case "birthday_greeting":
    case "birthday":
      return "celebration_chime";
    case "weekend_greeting":
    case "promotion":
      return "soft_prompt";
    default:
      return "ding";
  }
}

export function playNotificationSound(type: string): void {
  if (!notificationsSoundEnabled()) return;
  if (!audioUnlocked) return;

  const key = resolveNotificationSoundKey(type);
  try {
    switch (key) {
      case "ding":
        runToneSequence([{ frequency: 880, durationMs: 110, gain: 0.05 }]);
        break;
      case "ka_ching":
        runToneSequence([
          { frequency: 740, durationMs: 90, gain: 0.05 },
          { frequency: 1120, durationMs: 130, gain: 0.06, delayMs: 95 },
        ]);
        break;
      case "chime_bell":
        runToneSequence([
          { frequency: 660, durationMs: 100, gain: 0.05 },
          { frequency: 980, durationMs: 170, gain: 0.045, delayMs: 90 },
        ]);
        break;
      case "notification_pop":
        runToneSequence([
          { frequency: 520, durationMs: 70, gain: 0.045 },
          { frequency: 790, durationMs: 70, gain: 0.045, delayMs: 80 },
        ]);
        break;
      case "success_tone":
        runToneSequence([
          { frequency: 660, durationMs: 90, gain: 0.045 },
          { frequency: 880, durationMs: 110, gain: 0.05, delayMs: 80 },
          { frequency: 1320, durationMs: 130, gain: 0.05, delayMs: 180 },
        ]);
        break;
      case "soft_prompt":
        runToneSequence([{ frequency: 500, durationMs: 120, gain: 0.035 }]);
        break;
      case "celebration_chime":
        runToneSequence([
          { frequency: 880, durationMs: 90, gain: 0.045 },
          { frequency: 1175, durationMs: 90, gain: 0.045, delayMs: 90 },
          { frequency: 1568, durationMs: 130, gain: 0.05, delayMs: 180 },
        ]);
        break;
    }
  } catch {
    // Swallow runtime/permission errors so notifications never break UX.
  }
}
