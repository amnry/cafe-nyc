const KEY = "cafe-nyc:device-id";
let memory: string | null = null; // used when storage is blocked, so one visit still has one id

/**
 * Random UUID kept in localStorage; the server stores only a salted hash of it, for the per-device
 * rate limit. Not an account or a fingerprint: clearing site data gives a new one.
 */
export function getDeviceId(): string {
  try {
    const existing = globalThis.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    globalThis.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memory ??= crypto.randomUUID());
  }
}
