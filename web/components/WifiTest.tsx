"use client";

import { useEffect, useRef, useState } from "react";
import { getDeviceId } from "@/lib/deviceId";
import type { Results } from "@/lib/speedtest/bounds";
import { clientMessage, formatMbps, progressAt, RUN_TIMEOUT_MS, startTest, submitResult, toResults, type ClientReason } from "@/lib/speedtest/client";
import { SPEEDTEST_CONFIG } from "@/lib/speedtest/client-config";
import { getTurnstileToken } from "@/lib/speedtest/turnstile-client";
import { MONO_LABEL, OUTLINE_BUTTON } from "./bits";

type Phase =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "prechecking" }
  | { kind: "running"; progress: number; down: number | null }
  | { kind: "result"; results: Results; token: string }
  | { kind: "submitting" }
  | { kind: "thanks" }
  | { kind: "error"; message: string };

const DISCLOSURE =
  "We store the speeds, the distance from the cafe, and your network provider. Your location and IP address are not stored.";

class ClientError extends Error {
  constructor(public reason: ClientReason) {
    super(reason);
  }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new ClientError("geo_unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new ClientError(err.code === err.PERMISSION_DENIED ? "geo_denied" : "geo_unavailable")), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  });
}

type Engine = InstanceType<typeof import("@cloudflare/speedtest").default>;

export function WifiTest({ cafeId }: { cafeId: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const alive = useRef(true);
  const engine = useRef<Engine | null>(null);
  const captcha = useRef<HTMLDivElement>(null);

  // Closing the drawer unmounts this: stop the engine and ignore anything still in flight.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      engine.current?.pause();
    };
  }, []);

  if (!siteKey) return null; // not configured: no button that cannot work

  const show = (next: Phase) => alive.current && setPhase(next);
  const fail = (message: string) => show({ kind: "error", message });

  async function measure(): Promise<Results> {
    const { default: SpeedTest } = await import("@cloudflare/speedtest");
    const st = new SpeedTest(SPEEDTEST_CONFIG);
    engine.current = st;
    const began = Date.now();
    show({ kind: "running", progress: 0, down: null });
    const tick = setInterval(() => {
      const down = st.results.getSummary().download;
      show({ kind: "running", progress: progressAt(Date.now() - began), down: typeof down === "number" ? down / 1e6 : null });
    }, 250);
    try {
      return await new Promise<Results>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new ClientError("test_failed")), RUN_TIMEOUT_MS);
        st.onFinish = (r) => {
          clearTimeout(timeout);
          if (process.env.NODE_ENV === "development") console.log(`[speedtest] ran ${((r.getTotalDurationMs() ?? 0) / 1000).toFixed(1)} s`);
          const results = toResults(r.getSummary());
          return results ? resolve(results) : reject(new ClientError("test_failed"));
        };
        st.play();
      });
    } finally {
      clearInterval(tick);
      st.pause();
    }
  }

  async function run() {
    try {
      show({ kind: "locating" });
      const pos = await getPosition();

      show({ kind: "prechecking" });
      const turnstile_token = await getTurnstileToken(captcha.current!, siteKey!).catch(() => {
        throw new ClientError("captcha_failed");
      });
      // Coordinates exist only in this call: sent to /start for the geofence, then dropped.
      const started = await startTest({
        cafe_id: cafeId,
        turnstile_token,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        device_id: getDeviceId(),
      });
      if (!started.ok) return fail(started.message);

      const results = await measure();
      show({ kind: "result", results, token: started.session_token });
    } catch (e) {
      fail(clientMessage(e instanceof ClientError ? e.reason : "test_failed"));
    }
  }

  async function submit(token: string, results: Results) {
    show({ kind: "submitting" });
    const out = await submitResult(token, results);
    if (out.ok) show({ kind: "thanks" });
    else fail(out.message);
  }

  const busy = phase.kind === "locating" || phase.kind === "prechecking" || phase.kind === "running" || phase.kind === "submitting";

  return (
    <section className="mt-5" aria-labelledby="wifi-title">
      <h3 id="wifi-title" className={`${MONO_LABEL} text-muted`}>
        WiFi
      </h3>

      <div className="mt-2" aria-live="polite">
        {phase.kind === "idle" && (
          <button type="button" onClick={run} className={OUTLINE_BUTTON}>
            Test this cafe&apos;s WiFi
          </button>
        )}
        {phase.kind === "locating" && <p className="text-sm">Checking your location… allow it if your browser asks.</p>}
        {phase.kind === "prechecking" && <p className="text-sm">Checking your network…</p>}
        {phase.kind === "running" && (
          <div>
            <div
              role="progressbar"
              aria-label="WiFi test progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(phase.progress * 100)}
              className="h-2 w-full border border-line bg-surface-2"
            >
              <div className="h-full bg-accent transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${phase.progress * 100}%` }} />
            </div>
            <p className="mt-2 font-mono text-sm tabular-nums">
              {phase.down === null ? "Testing…" : <>↓ {formatMbps(phase.down)} Mbps</>}
            </p>
          </div>
        )}
        {phase.kind === "result" && (
          <div>
            <p className="font-mono text-sm tabular-nums">
              ↓ {formatMbps(phase.results.down_mbps)} · ↑ {formatMbps(phase.results.up_mbps)} Mbps · {Math.round(phase.results.latency_ms)} ms
            </p>
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => submit(phase.token, phase.results)} className={OUTLINE_BUTTON}>
                Submit result
              </button>
              <button type="button" onClick={() => setPhase({ kind: "idle" })} className={OUTLINE_BUTTON}>
                Discard
              </button>
            </div>
          </div>
        )}
        {phase.kind === "submitting" && <p className="text-sm">Sending…</p>}
        {phase.kind === "thanks" && <p className="text-sm">Thanks! Your result helps the next person.</p>}
        {phase.kind === "error" && (
          <div>
            <p role="alert" className="text-sm">
              {phase.message}
            </p>
            <button type="button" onClick={() => setPhase({ kind: "idle" })} className={`${OUTLINE_BUTTON} mt-2`}>
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Cloudflare's widget shows here only if it needs the visitor to do something. */}
      <div ref={captcha} className={busy ? "mt-2" : "hidden"} />

      <p className="mt-2 text-[11px] leading-snug text-muted">{DISCLOSURE}</p>
    </section>
  );
}
