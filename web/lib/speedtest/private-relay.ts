import ranges from "./data/private-relay-ranges.json";
import { parseIp } from "./ip";

// Apple's published egress ranges for iCloud Private Relay, collapsed to CIDRs by
// scripts/update-relay-ranges.mjs. Relay users share an IP with strangers anywhere in the country,
// so their location can't be tied to the cafe network.

type Span = [start: bigint, end: bigint];

function spans(cidrs: readonly string[], version: 4 | 6): Span[] {
  const bits = version === 4 ? 32 : 128;
  return cidrs
    .map((c) => {
      const [ip, len] = c.split("/");
      const start = parseIp(ip)?.value ?? BigInt(0);
      return [start, start + (BigInt(1) << BigInt(bits - Number(len))) - BigInt(1)] as Span;
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function contains(list: Span[], value: bigint): boolean {
  let lo = 0;
  let hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = list[mid];
    if (value < s) hi = mid - 1;
    else if (value > e) lo = mid + 1;
    else return true;
  }
  return false;
}

export function createRelayMatcher(data: { v4: readonly string[]; v6: readonly string[] }) {
  let v4: Span[] | null = null;
  let v6: Span[] | null = null;
  return (ip: string): boolean => {
    const parsed = parseIp(ip);
    if (!parsed) return false;
    if (parsed.version === 4) return contains((v4 ??= spans(data.v4, 4)), parsed.value);
    return contains((v6 ??= spans(data.v6, 6)), parsed.value);
  };
}

export const isPrivateRelayIp = createRelayMatcher(ranges);
