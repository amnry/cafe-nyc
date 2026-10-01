import { HOSTING_VPN_ASNS, MOBILE_ASNS } from "./asn-config";

const mobile = new Set(MOBILE_ASNS.map((e) => e.asn));
const hosting = new Set(HOSTING_VPN_ASNS.map((e) => e.asn));

export type AsnClass = "ok" | "mobile_network" | "vpn_or_hosting";

export function classifyAsn(asn: number): AsnClass {
  if (mobile.has(asn)) return "mobile_network";
  if (hosting.has(asn)) return "vpn_or_hosting";
  return "ok";
}
