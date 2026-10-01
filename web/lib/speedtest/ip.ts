import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Client IP from the platform's headers. On Vercel, x-real-ip / x-forwarded-for are set by the
 * edge, not the client. cf-connecting-ip (set by a Cloudflare tunnel) is read only in development,
 * so phone testing works through `cloudflared tunnel`; in production it is ignored.
 */
export function clientIp(headers: Headers, opts: { dev?: boolean } = {}): string | null {
  const candidates = [
    opts.dev ? headers.get("cf-connecting-ip") : null,
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && isIP(ip)) return ip;
  }
  return null;
}

function expandV6(ip: string): number[] {
  let addr = ip.split("%")[0].toLowerCase();
  const dotted = addr.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/); // ::ffff:1.2.3.4
  if (dotted) {
    const o = dotted[2].split(".").map(Number);
    addr = dotted[1] + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const [head, tail] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16));
}

/** IPv4 as a number, IPv6 as a bigint; both for range lookups. */
export function parseIp(ip: string): { version: 4 | 6; value: bigint } | null {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b, c, d] = ip.split(".").map(Number);
    return { version: 4, value: BigInt(((a << 24) | (b << 16) | (c << 8) | d) >>> 0) };
  }
  if (kind === 6) {
    const g = expandV6(ip);
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
      return { version: 4, value: BigInt(((g[6] << 16) | g[7]) >>> 0) }; // v4-mapped
    }
    return { version: 6, value: g.reduce((acc, x) => (acc << BigInt(16)) | BigInt(x), BigInt(0)) };
  }
  return null;
}

/** /24 for IPv4, /48 for IPv6 (v4-mapped IPv6 counts as IPv4). Null if not an IP. */
export function ipPrefix(ip: string): string | null {
  const parsed = parseIp(ip);
  if (!parsed) return null;
  if (parsed.version === 4) {
    const v = Number(parsed.value);
    return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.0/24`;
  }
  const top = parsed.value >> BigInt(80); // first 48 bits
  const hex = (n: bigint) => n.toString(16);
  return `${hex((top >> BigInt(32)) & BigInt(0xffff))}:${hex((top >> BigInt(16)) & BigInt(0xffff))}:${hex(top & BigInt(0xffff))}::/48`;
}

export function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Salted hash of the prefix. The raw IP is never stored or logged. */
export const prefixHash = (salt: string, prefix: string) => hmacHex(salt, `prefix:${prefix}`);
export const deviceHash = (salt: string, deviceId: string) => hmacHex(salt, `device:${deviceId}`);
