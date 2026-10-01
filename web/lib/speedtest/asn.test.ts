import { describe, expect, it } from "vitest";
import { classifyAsn } from "./asn";
import { HOSTING_VPN_ASNS, MOBILE_ASNS } from "./asn-config";

describe("classifyAsn", () => {
  it("flags US mobile carriers", () => {
    for (const asn of [21928, 6167, 22394, 20057]) expect(classifyAsn(asn)).toBe("mobile_network");
  });
  it("flags hosting and VPN networks", () => {
    for (const asn of [16509, 14061, 13335, 9009]) expect(classifyAsn(asn)).toBe("vpn_or_hosting");
  });
  it("lets home and cafe ISPs through, including wireline arms of carriers", () => {
    for (const asn of [7018, 701, 7922, 12271, 20001]) expect(classifyAsn(asn)).toBe("ok");
  });
});

describe("asn-config", () => {
  const all = [...MOBILE_ASNS, ...HOSTING_VPN_ASNS];
  it("gives every ASN a bgp.he.net or PeeringDB source URL for that ASN", () => {
    for (const e of all) {
      expect(e.source, `AS${e.asn}`).toMatch(new RegExp(`^https://(bgp\\.he\\.net/AS${e.asn}|www\\.peeringdb\\.com/.+)$`));
      expect(e.name).toBeTruthy();
    }
  });
  it("has no duplicates and no ASN on both lists", () => {
    const asns = all.map((e) => e.asn);
    expect(new Set(asns).size).toBe(asns.length);
  });
});
