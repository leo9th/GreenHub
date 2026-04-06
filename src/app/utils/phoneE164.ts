/** Normalize common Nigerian inputs to E.164 (+234...) for Supabase phone OTP. */
export function toE164Ng(raw: string): { e164: string } | { error: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) {
    return { error: "Enter a valid mobile number (e.g. 0803 123 4567)." };
  }

  if (digits.startsWith("234")) {
    if (digits.length < 12) {
      return { error: "Incomplete number after country code 234." };
    }
    return { e164: `+${digits}` };
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return { e164: `+234${digits.slice(1)}` };
  }

  if (digits.length === 10) {
    return { e164: `+234${digits}` };
  }

  return { error: "Use a Nigerian number (10 digits after 0, or +234)." };
}

export function maskPhoneE164(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 4) return e164;
  const last4 = d.slice(-4);
  if (d.startsWith("234") && d.length >= 12) {
    return `+234 ••• ••• ${last4}`;
  }
  return `••• ••• ${last4}`;
}
