import type { Results } from "./bounds";
import { REJECT_REASONS, type RejectReason } from "./reasons";

export const EXPECTED_DURATION_MS = 15_000;
/** Give up if the engine has not finished by now (the server rejects anything past 120 s anyway). */
export const RUN_TIMEOUT_MS = 60_000;

/** Reasons that never reach the server. */
const CLIENT_MESSAGES = {
  geo_denied: "Location is blocked. Allow location for this site to test the WiFi.",
  geo_unavailable: "We couldn't get your location. Check that location is on and try again.",
  captcha_failed: "We couldn't verify you're a person. Please try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  test_failed: "The speed test didn't finish. Please try again.",
} as const;
export type ClientReason = keyof typeof CLIENT_MESSAGES;
export const clientMessage = (reason: ClientReason) => CLIENT_MESSAGES[reason];

/** Progress bar position while running: time-based over ~15 s, held at 95% until the engine finishes. */
export function progressAt(elapsedMs: number): number {
  return Math.min(0.95, Math.max(0, elapsedMs / EXPECTED_DURATION_MS));
}

interface Summary {
  download?: number; // bps
  upload?: number; // bps
  latency?: number; // ms
  jitter?: number; // ms
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Library summary (bits per second) to the API's Mbps, or null if anything is missing. */
export function toResults(s: Summary): Results | null {
  if (!num(s.download) || !num(s.upload) || !num(s.latency) || !num(s.jitter)) return null;
  return { down_mbps: round2(s.download / 1e6), up_mbps: round2(s.upload / 1e6), latency_ms: round2(s.latency), jitter_ms: round2(s.jitter) };
}

export function formatMbps(mbps: number): string {
  return mbps >= 100 ? String(Math.round(mbps)) : mbps.toFixed(1);
}

export type ApiOutcome<T> = ({ ok: true } & T) | { ok: false; reason: RejectReason | ClientReason; message: string };

async function post<T>(path: string, body: unknown, pick: (json: Record<string, unknown>) => T): Promise<ApiOutcome<T>> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, reason: "network", message: clientMessage("network") };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && json?.status === "ok") return { ok: true, ...pick(json) };
  const reason = typeof json?.reason === "string" && json.reason in REJECT_REASONS ? (json.reason as RejectReason) : null;
  if (reason) return { ok: false, reason, message: REJECT_REASONS[reason].message };
  return { ok: false, reason: "network", message: clientMessage("network") };
}

export interface StartArgs {
  cafe_id: string;
  turnstile_token: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_id: string;
}

/** Location goes only to /start (geofence), once, and is not kept by the caller. */
export const startTest = (args: StartArgs) =>
  post("/api/speedtest/start", args, (j) => ({ session_token: String(j.session_token) }));

export const submitResult = (session_token: string, results: Results) =>
  post("/api/speedtest/submit", { session_token, results }, () => ({}));
