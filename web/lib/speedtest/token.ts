import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const TOKEN_TTL_MS = 5 * 60_000;

export interface SessionPayload {
  cafe_id: string;
  ip_prefix_hash: string;
  asn: number;
  asn_org: string | null;
  issued_at: number; // ms
  nonce: string;
  // Signed along so /submit can store them without another DB read.
  device_id_hash: string;
  distance_m: number;
  accuracy_m: number;
}

const b64 = (b: Buffer) => b.toString("base64url");
const mac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest();

export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${b64(mac(secret, body))}`;
}

export type VerifyResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; reason: "invalid_token" }
  // Signature was valid but the token is past its 5 minutes; payload lets the caller store the attempt.
  | { ok: false; reason: "token_expired"; payload: SessionPayload };

export function verifySession(token: string, secret: string, now: number): VerifyResult {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "invalid_token" };
  const given = Buffer.from(sig, "base64url");
  const expected = mac(secret, body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid_token" };
  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
  if (now - payload.issued_at > TOKEN_TTL_MS || now < payload.issued_at) return { ok: false, reason: "token_expired", payload };
  return { ok: true, payload };
}
