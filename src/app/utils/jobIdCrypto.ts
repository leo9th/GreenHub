/**
 * Browser-side AES-GCM for ID numbers. Same VITE_JOB_CRYPTO_KEY must be available in admin UI to decrypt.
 * Prefer server-side encryption (Edge Function) in production; this is better than storing plaintext when keyed.
 */
function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret: string): Promise<CryptoKey | null> {
  if (!secret || secret.length < 16) return null;
  const raw = await crypto.subtle.digest("SHA-256", utf8ToBytes(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJobIdNumber(plaintext: string): Promise<{ ciphertextB64: string; ivB64: string } | null> {
  const secret = import.meta.env.VITE_JOB_CRYPTO_KEY as string | undefined;
  const key = secret ? await deriveKey(secret) : null;
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, utf8ToBytes(plaintext));
  return {
    ivB64: bytesToB64(iv),
    ciphertextB64: bytesToB64(new Uint8Array(ct)),
  };
}

export async function decryptJobIdNumber(ciphertextB64: string, ivB64: string): Promise<string | null> {
  const secret = import.meta.env.VITE_JOB_CRYPTO_KEY as string | undefined;
  const key = secret ? await deriveKey(secret) : null;
  if (!key) return null;
  try {
    const iv = b64ToBytes(ivB64);
    const ct = b64ToBytes(ciphertextB64);
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}
