import { describe, expect, it } from "vitest";
import { clientIp, deviceHash, ipPrefix, parseIp, prefixHash } from "./ip";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });
  it("ignores values that are not IPs, and returns null with no header", () => {
    expect(clientIp(h({ "x-real-ip": "not-an-ip" }))).toBeNull();
    expect(clientIp(h({}))).toBeNull();
  });
  it("reads cf-connecting-ip only in development", () => {
    const headers = h({ "cf-connecting-ip": "198.51.100.9", "x-real-ip": "203.0.113.7" });
    expect(clientIp(headers, { dev: true })).toBe("198.51.100.9");
    expect(clientIp(headers, { dev: false })).toBe("203.0.113.7");
    expect(clientIp(headers)).toBe("203.0.113.7");
    expect(clientIp(h({ "cf-connecting-ip": "198.51.100.9" }))).toBeNull();
  });
});

describe("ipPrefix", () => {
  it("is /24 for IPv4", () => expect(ipPrefix("203.0.113.77")).toBe("203.0.113.0/24"));
  it("is /48 for IPv6, with :: expanded", () => {
    expect(ipPrefix("2001:db8:abcd:1234:5678::1")).toBe("2001:db8:abcd::/48");
    expect(ipPrefix("2001:db8::1")).toBe("2001:db8:0::/48");
  });
  it("treats v4-mapped IPv6 as IPv4", () => expect(ipPrefix("::ffff:203.0.113.77")).toBe("203.0.113.0/24"));
  it("returns null for junk", () => expect(ipPrefix("nope")).toBeNull());
});

describe("parseIp", () => {
  it("parses v4 and v6 to comparable values", () => {
    expect(parseIp("0.0.1.0")).toEqual({ version: 4, value: BigInt(256) });
    expect(parseIp("::1")).toEqual({ version: 6, value: BigInt(1) });
  });
});

describe("hashes", () => {
  it("are salted, deterministic, and never contain the input", () => {
    const a = prefixHash("salt", "203.0.113.0/24");
    expect(a).toBe(prefixHash("salt", "203.0.113.0/24"));
    expect(a).not.toBe(prefixHash("other-salt", "203.0.113.0/24"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(deviceHash("salt", "abc")).not.toBe(prefixHash("salt", "abc")); // domain-separated
  });
});
