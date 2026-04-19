/** Basic RFC‑ish email check for inline UX (server still validates). */
export function isValidEmailFormat(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function passwordMeetsRequirements(password: string): boolean {
  return password.length >= 8 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password);
}

export type PasswordStrength = "weak" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!passwordMeetsRequirements(password)) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const len = password.length;
  if (len >= 12 && hasUpper && hasLower && /[0-9]/.test(password)) return "strong";
  if (len >= 10 && (hasUpper || hasLower)) return "medium";
  return "medium";
}

/** Prevent open redirects — only same‑origin paths. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

export function mapSignUpErrorToToast(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("user already")) {
    return "Email already registered";
  }
  if (m.includes("password")) {
    return "Weak password — use at least 8 characters with letters and numbers.";
  }
  return message;
}
