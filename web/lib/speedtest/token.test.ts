import { describe, expect, it } from "vitest";
import { signSession, TOKEN_TTL_MS, verifySession, type SessionPayload } from "./token";

const payload: SessionPayload = {
  cafe_id: "c", ip_prefix_hash: "h", asn: 7018, asn_org: "AT&T", issued_at: 1_000_000, nonce: "n",
  device_id_hash: "d", distance_m: 12.5, accuracy_m: 20,
};
const SECRET = "secret-1";

describe("session token", () => {
  it("round-trips", () => {
    const r = verifySession(signSession(payload, SECRET), SECRET, payload.issued_at + 1000);
    expect(r).toEqual({ ok: true, payload });
  });
  it("is valid up to 5 minutes and expired after", () => {
    const t = signSession(payload, SECRET);
    expect(verifySession(t, SECRET, payload.issued_at + TOKEN_TTL_MS).ok).toBe(true);
    const late = verifySession(t, SECRET, payload.issued_at + TOKEN_TTL_MS + 1);
    expect(late).toMatchObject({ ok: false, reason: "token_expired", payload });
  });
  it("rejects a token dated in the future", () => {
    expect(verifySession(signSession(payload, SECRET), SECRET, payload.issued_at - 1)).toMatchObject({ reason: "token_expired" });
  });
  it("rejects the wrong secret", () => {
    expect(verifySession(signSession(payload, SECRET), "other", payload.issued_at)).toEqual({ ok: false, reason: "invalid_token" });
  });
  it("rejects a tampered payload", () => {
    const [, sig] = signSession(payload, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, cafe_id: "other" })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, payload.issued_at)).toEqual({ ok: false, reason: "invalid_token" });
  });
  it("rejects malformed tokens", () => {
    for (const t of ["", "abc", "a.b.c", "a.", ".b"]) expect(verifySession(t, SECRET, 0)).toEqual({ ok: false, reason: "invalid_token" });
  });
});
