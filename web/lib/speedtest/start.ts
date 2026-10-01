import "server-only";
import { distanceMeters } from "@/lib/distance";
import { classifyAsn } from "./asn";
import type { Deps } from "./deps";
import { checkGeofence } from "./geofence";
import { lookupAsn } from "./ipinfo";
import { clientIp, deviceHash, ipPrefix, prefixHash } from "./ip";
import { isPrivateRelayIp } from "./private-relay";
import { rejection, type RejectReason } from "./reasons";
import { signSession, TOKEN_TTL_MS } from "./token";
import { verifyTurnstile } from "./turnstile";

export const MAX_STARTS_PER_CAFE_PREFIX_PER_HOUR = 10;
export const MAX_STARTS_PER_DEVICE_PER_DAY = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StartInput {
  cafe_id: string;
  turnstile_token: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  device_id: string;
}

function parseInput(raw: unknown): StartInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { cafe_id, turnstile_token, lat, lng, accuracy_m, device_id } = r;
  if (typeof cafe_id !== "string" || !UUID.test(cafe_id)) return null;
  if (typeof turnstile_token !== "string" || !turnstile_token || turnstile_token.length > 2048) return null;
  if (typeof device_id !== "string" || device_id.length < 8 || device_id.length > 64) return null;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (typeof accuracy_m !== "number" || !Number.isFinite(accuracy_m) || accuracy_m < 0) return null;
  return { cafe_id, turnstile_token, lat, lng, accuracy_m, device_id };
}

/**
 * POST /api/speedtest/start. Order: input, Turnstile, cafe, Private Relay, geofence, ASN, rate limits.
 * Coordinates are used for the distance and dropped; only distance_m and accuracy_m are stored.
 */
export async function handleStart(request: Request, deps: Deps): Promise<Response> {
  const body = await request.json().catch(() => null);
  const input = parseInput(body);
  if (!input) return rejection("bad_request");

  const ip = clientIp(request.headers, { dev: deps.dev });
  const prefix = ip ? ipPrefix(ip) : null;
  if (!ip || !prefix) return rejection("no_client_ip");

  if (!(await verifyTurnstile(input.turnstile_token, ip, deps.env.turnstileSecret, deps.fetch))) {
    return rejection("turnstile_failed"); // not stored: a bot could otherwise fill the table
  }

  const cafe = await deps.db.getCafe(input.cafe_id);
  if (!cafe) return rejection("cafe_not_found");

  const ip_prefix_hash = prefixHash(deps.env.ipSalt, prefix);
  const device_id_hash = deviceHash(deps.env.ipSalt, input.device_id);
  const distance_m = distanceMeters({ lat: input.lat, lng: input.lng }, cafe);
  const accuracy_m = input.accuracy_m;
  let asn: number | null = null;

  const reject = async (reason: RejectReason) => {
    await deps.db.insertStart({
      cafe_id: input.cafe_id, ip_prefix_hash, device_id_hash, asn, distance_m, accuracy_m,
      status: "rejected", reject_reason: reason, nonce: null,
    });
    return rejection(reason);
  };

  if (isPrivateRelayIp(ip)) return reject("private_relay");

  const geo = checkGeofence(distance_m, accuracy_m);
  if (geo !== "ok") return reject(geo);

  const info = await lookupAsn(ip, deps.env.ipinfoToken, deps.fetch);
  if (!info) return reject("asn_lookup_failed");
  asn = info.asn;
  const cls = classifyAsn(info.asn);
  if (cls !== "ok") return reject(cls);

  const hourAgo = new Date(deps.now() - 3_600_000);
  const dayAgo = new Date(deps.now() - 86_400_000);
  if ((await deps.db.countIssuedStarts({ cafe_id: input.cafe_id, ip_prefix_hash, since: hourAgo })) >= MAX_STARTS_PER_CAFE_PREFIX_PER_HOUR) {
    return reject("rate_limited_cafe");
  }
  if ((await deps.db.countIssuedStarts({ device_id_hash, since: dayAgo })) >= MAX_STARTS_PER_DEVICE_PER_DAY) {
    return reject("rate_limited_device");
  }

  const nonce = deps.nonce();
  const issued_at = deps.now();
  await deps.db.insertStart({
    cafe_id: input.cafe_id, ip_prefix_hash, device_id_hash, asn, distance_m, accuracy_m,
    status: "issued", reject_reason: null, nonce,
  });
  const session_token = signSession(
    { cafe_id: input.cafe_id, ip_prefix_hash, asn: info.asn, asn_org: info.asn_org, issued_at, nonce, device_id_hash, distance_m, accuracy_m },
    deps.env.tokenSecret,
  );
  return Response.json({ status: "ok", session_token, expires_at: issued_at + TOKEN_TTL_MS });
}
