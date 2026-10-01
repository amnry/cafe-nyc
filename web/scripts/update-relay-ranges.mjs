// Refreshes lib/speedtest/data/private-relay-ranges.json from Apple's published iCloud Private Relay
// egress list. Run: node scripts/update-relay-ranges.mjs   (re-run on the ETL schedule; stale ranges
// let Private Relay users through, and reassigned ranges can block real users).
import { writeFileSync } from "node:fs";
import { isIPv4 } from "node:net";

const URL_ = "https://mask-api.icloud.com/egress-ip-ranges.csv";
const OUT = new URL("../lib/speedtest/data/private-relay-ranges.json", import.meta.url);

const res = await fetch(URL_);
if (!res.ok) throw new Error(`HTTP ${res.status} from ${URL_}`);
const lines = (await res.text()).split("\n");

const v6ToBig = (ip) => {
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const g = [...h, ...Array(tail === undefined ? 0 : 8 - h.length - t.length).fill("0"), ...t];
  return g.reduce((a, x) => (a << 16n) | BigInt(parseInt(x, 16)), 0n);
};
const v4ToBig = (ip) => ip.split(".").reduce((a, x) => (a << 8n) | BigInt(x), 0n);

function collapse(ranges) {
  ranges.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const [s, e] of ranges) {
    const last = out[out.length - 1];
    if (last && s <= last[1] + 1n) last[1] = e > last[1] ? e : last[1];
    else out.push([s, e]);
  }
  return out;
}
function toCidrs(ranges, bits) {
  const cidrs = [];
  for (let [s, e] of ranges) {
    while (s <= e) {
      let size = 1n;
      let len = bits;
      while (len > 0 && s % (size * 2n) === 0n && s + size * 2n - 1n <= e) {
        size *= 2n;
        len -= 1;
      }
      cidrs.push([s, len]);
      s += size;
    }
  }
  return cidrs;
}
const fmt4 = (n) => [24n, 16n, 8n, 0n].map((sh) => Number((n >> sh) & 255n)).join(".");
const fmt6 = (n) => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(112 - 16 * i)) & 0xffffn).toString(16)).join(":");

const v4 = [];
const v6 = [];
for (const line of lines) {
  const cidr = line.split(",")[0]?.trim();
  if (!cidr?.includes("/")) continue;
  const [ip, lenStr] = cidr.split("/");
  const len = BigInt(lenStr);
  if (isIPv4(ip)) {
    const s = v4ToBig(ip);
    v4.push([s, s + (1n << (32n - len)) - 1n]);
  } else {
    const s = v6ToBig(ip);
    v6.push([s, s + (1n << (128n - len)) - 1n]);
  }
}
const data = {
  source: URL_,
  fetched_at: new Date().toISOString(),
  v4: toCidrs(collapse(v4), 32).map(([s, l]) => `${fmt4(s)}/${l}`),
  v6: toCidrs(collapse(v6), 128).map(([s, l]) => `${fmt6(s)}/${l}`),
};
writeFileSync(OUT, JSON.stringify(data));
console.log(`wrote ${data.v4.length} v4 + ${data.v6.length} v6 ranges to ${OUT.pathname}`);
