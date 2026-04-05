/** Turns Supabase PostgREST / Auth errors (and Error) into a user-visible string. */
export function supabaseErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error) return error.message || fallback;

  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    const msg = o.message;
    const code = o.code;
    const hint = o.hint;
    const details = o.details;

    const parts: string[] = [];
    if (typeof msg === "string" && msg.trim()) parts.push(msg.trim());
    if (typeof details === "string" && details.trim()) parts.push(details.trim());
    if (typeof hint === "string" && hint.trim()) parts.push(`Hint: ${hint.trim()}`);
    if (typeof code === "string" && code.trim()) parts.push(`Code: ${code.trim()}`);

    if (parts.length > 0) return parts.join(" — ");
  }

  return fallback;
}
