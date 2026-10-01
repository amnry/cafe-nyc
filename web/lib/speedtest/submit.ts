import "server-only";
import { checkElapsed, parseResults, resultsPlausible, type Results } from "./bounds";
import type { TestRow } from "./db";
import type { Deps } from "./deps";
import { clientIp, ipPrefix, prefixHash } from "./ip";
import { lookupAsn } from "./ipinfo";
import { rejection, type RejectReason } from "./reasons";
import { verifySession, type SessionPayload } from "./token";

/**
 * POST /api/speedtest/submit. Status: accepted (no known network yet, or the ASN matches it),
 * flagged (checks pass but the ASN differs from the known network), rejected (any check fails; stored
 * with the reason once the token signature is valid). The client sees only ok / rejected.
 */
export async function handleSubmit(request: Request, deps: Deps): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { session_token?: unknown; results?: unknown } | null;
  if (!body || typeof body.session_token !== "string") return rejection("bad_request");

  const now = deps.now();
  const verified = verifySession(body.session_token, deps.env.tokenSecret, now);
  if (!verified.ok && verified.reason === "invalid_token") return rejection("invalid_token"); // unattributable: not stored
  const payload: SessionPayload = verified.payload;

  const ip = clientIp(request.headers, { dev: deps.dev });
  const prefix = ip ? ipPrefix(ip) : null;
  const currentHash = prefix ? prefixHash(deps.env.ipSalt, prefix) : payload.ip_prefix_hash;

  const results = parseResults(body.results);
  const base = (): Omit<TestRow, "status" | "reject_reason" | "nonce"> => ({
    cafe_id: payload.cafe_id,
    down_mbps: results?.down_mbps ?? null,
    up_mbps: results?.up_mbps ?? null,
    latency_ms: results?.latency_ms ?? null,
    jitter_ms: results?.jitter_ms ?? null,
    ip_prefix_hash: currentHash,
    asn: payload.asn,
    asn_org: payload.asn_org,
    distance_m: payload.distance_m,
    accuracy_m: payload.accuracy_m,
    device_id_hash: payload.device_id_hash,
  });

  const reject = async (reason: RejectReason, nonce: string | null = payload.nonce) => {
    await deps.db.insertTest({ ...base(), status: "rejected", reject_reason: reason, nonce });
    return rejection(reason);
  };

  if (!verified.ok) return reject("token_expired");

  // IP prefix matches the token's, or (dual-stack: v6 at start, v4 at submit) the ASN does.
  if (currentHash !== payload.ip_prefix_hash) {
    const info = ip ? await lookupAsn(ip, deps.env.ipinfoToken, deps.fetch) : null;
    if (info?.asn !== payload.asn) return reject("ip_changed");
  }

  const elapsed = checkElapsed((now - payload.issued_at) / 1000);
  if (elapsed !== "ok") return reject(elapsed);

  if (!results || !resultsPlausible(results)) return reject("implausible_results");

  const known = await deps.db.knownAsn(payload.cafe_id);
  const status = known === null || known === payload.asn ? "accepted" : "flagged";
  const saved = await deps.db.insertTest({ ...base(), status, reject_reason: null, nonce: payload.nonce });
  if (saved === "nonce_conflict") return reject("nonce_reused", null); // replay: the column is unique, so store without it

  if (status === "accepted") deps.onAccepted();
  return Response.json({ status: "ok" });
}

export type { Results };
