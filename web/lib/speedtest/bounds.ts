export const MIN_ELAPSED_S = 5;
export const MAX_ELAPSED_S = 120;

export interface Results {
  down_mbps: number;
  up_mbps: number;
  latency_ms: number;
  jitter_ms: number;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

export function parseResults(raw: unknown): Results | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (![r.down_mbps, r.up_mbps, r.latency_ms, r.jitter_ms].every(finite)) return null;
  return { down_mbps: r.down_mbps as number, up_mbps: r.up_mbps as number, latency_ms: r.latency_ms as number, jitter_ms: r.jitter_ms as number };
}

/** Plausible bounds: down/up 0.1-2000 Mbps, latency 1-2000 ms, jitter >= 0. */
export function resultsPlausible(r: Results): boolean {
  return between(r.down_mbps, 0.1, 2000) && between(r.up_mbps, 0.1, 2000) && between(r.latency_ms, 1, 2000) && r.jitter_ms >= 0 && r.jitter_ms <= 2000;
}

export type ElapsedCheck = "ok" | "too_fast" | "too_slow";

/** Time between the token being issued and the results arriving: 5 to 120 s. */
export function checkElapsed(elapsed_s: number): ElapsedCheck {
  if (elapsed_s < MIN_ELAPSED_S) return "too_fast";
  if (elapsed_s > MAX_ELAPSED_S) return "too_slow";
  return "ok";
}
